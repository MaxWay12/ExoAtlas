import math
from datetime import datetime, timezone
from uuid import NAMESPACE_URL, uuid5
from xml.etree import ElementTree

import httpx
import psycopg
from psycopg.types.json import Jsonb

from .db import create_schema, database_url
from .ranking import calculate_ranking, RANKING_COLUMNS, RANKING_MODEL

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
COLUMNS = (
    "pl_name", "hostname", "ra", "dec", "sy_dist", "disc_year",
    "discoverymethod", "pl_rade", "pl_orbper", "pl_orbsmax",
)


def catalog_id(kind, name):
    return uuid5(NAMESPACE_URL, f"{TAP_URL}/{kind}/{name}")


def number(value):
    if not value:
        return None
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite numeric value in TAP result")
    return result


def parse_catalog(content, *, with_ranking=False):
    document = ElementTree.fromstring(content)
    statuses = [
        info.get("value")
        for info in document.findall(".//{*}INFO")
        if info.get("name") == "QUERY_STATUS"
    ]
    if not statuses or any(status != "OK" for status in statuses):
        raise ValueError(f"TAP did not return a complete result: {statuses}")

    table = document.find(".//{*}TABLE")
    if table is None or table.find("./{*}DATA/{*}TABLEDATA") is None:
        raise ValueError("Missing VOTable TABLEDATA")
    fields = [field.get("name", "").lower() for field in table.findall("./{*}FIELD")]
    expected = (*COLUMNS, *RANKING_COLUMNS) if with_ranking else COLUMNS
    if len(fields) != len(expected) or set(fields) != set(expected):
        raise ValueError("Unexpected TAP columns")

    systems = {}
    planets = {}
    source_rows = []
    for entry in table.findall("./{*}DATA/{*}TABLEDATA/{*}TR"):
        values = [(cell.text or "").strip() for cell in entry.findall("./{*}TD")]
        row = dict(zip(fields, values, strict=True))
        if with_ranking:
            source_rows.append(row)
        name = row["pl_name"]
        host = row["hostname"] or None
        if not name or name in planets:
            raise ValueError(f"Missing or duplicate planet name: {name!r}")

        host_id = None
        if host:
            host_id = catalog_id("system", host)
            coordinates = tuple(number(row[key]) for key in ("ra", "dec", "sy_dist"))
            previous = systems.get(host, (host_id, host, None, None, None))
            systems[host] = (host_id, host, *(
                old if old is not None else new
                for old, new in zip(previous[2:], coordinates, strict=True)
            ))

        planets[name] = (
            catalog_id("planet", name), host_id, name,
            int(row["disc_year"]) if row["disc_year"] else None,
            row["discoverymethod"] or None,
            *(number(row[key]) for key in COLUMNS[7:]),
            *(number(row.get(key)) for key in ("pl_eqt", "pl_dens", "st_teff")),
        )

    if not planets:
        raise ValueError("TAP returned an empty catalog")
    snapshot = (list(systems.values()), list(planets.values()))
    if with_ranking:
        return (*snapshot, calculate_ranking(source_rows))
    return snapshot


def fetch_catalog():
    response = httpx.get(
        TAP_URL,
        params={"query": f"SELECT {', '.join((*COLUMNS, *RANKING_COLUMNS))} FROM pscomppars ORDER BY pl_name",
                "format": "votable"},
        timeout=180,
        follow_redirects=True,
    )
    response.raise_for_status()
    downloaded_at = datetime.now(timezone.utc)
    return (*parse_catalog(response.content, with_ranking=True), downloaded_at)


def replace_catalog(connection, systems, planets, downloaded_at=None):
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM planets")
        cursor.execute("DELETE FROM systems")
        cursor.executemany(
            "INSERT INTO systems (id, hostname, ra_deg, dec_deg, distance_pc)"
            " VALUES (%s, %s, %s, %s, %s)",
            systems,
        )
        cursor.executemany(
            """
            INSERT INTO planets (
                id, system_id, name, discovery_year, discovery_method, radius_earth,
                orbital_period_days, semi_major_axis_au, temperature_k, density_g_cm3, star_temperature_k
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            planets,
        )
        cursor.execute(
            """
            INSERT INTO catalog_state (singleton, imported_at, planet_count, nasa_downloaded_at)
            VALUES (true, clock_timestamp(), %s, %s)
            ON CONFLICT (singleton) DO UPDATE
            SET imported_at = EXCLUDED.imported_at, planet_count = EXCLUDED.planet_count,
                nasa_downloaded_at = EXCLUDED.nasa_downloaded_at
            """,
            (len(planets), downloaded_at),
        )


def main():
    with psycopg.connect(database_url()) as connection:
        locked = connection.execute("SELECT pg_try_advisory_xact_lock(51351021)").fetchone()[0]
        if not locked:
            raise SystemExit("A catalog import is already running")
        systems, planets, ranking, downloaded_at = fetch_catalog()
        create_schema(connection)
        replace_catalog(connection, systems, planets, downloaded_at)
        connection.execute(
            """
            INSERT INTO habitability_ranking (singleton, calculated_at, items, model)
            VALUES (true, clock_timestamp(), %s, %s)
            ON CONFLICT (singleton) DO UPDATE
            SET calculated_at = EXCLUDED.calculated_at, items = EXCLUDED.items, model = EXCLUDED.model
            """,
            (Jsonb(ranking), RANKING_MODEL),
        )
    print(f"Imported {len(planets)} planets, {len(systems)} host stars and {len(ranking)} ranked candidates")


if __name__ == "__main__":
    main()
