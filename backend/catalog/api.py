from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from psycopg import Connection, sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .db import create_schema, database_url
from .ranking import RANKING_MODEL, seed_ranking
from .models import (
    CatalogState, Filters, Planet, PlanetPage, PlanetQuery, Stats, SystemDetail,
    SystemPoint, PHYSICAL_RANGES,
)

FROM_PLANETS = sql.SQL(" FROM planets p LEFT JOIN systems s ON s.id = p.system_id")
SELECT_PLANETS = sql.SQL("SELECT p.*, s.hostname, s.distance_pc") + FROM_PLANETS
SORT_COLUMNS = {
    "name": sql.SQL("p.name"),
    "year": sql.SQL("p.discovery_year"),
    "radius": sql.SQL("p.radius_earth"),
    "distance": sql.SQL("s.distance_pc"),
}
RANGE_FILTERS = {
    "year_from": "p.discovery_year >= %s",
    "year_to": "p.discovery_year <= %s",
    "distance_min": "s.distance_pc >= %s",
    "distance_max": "s.distance_pc <= %s",
    **{
        f"{field}_{bound}": f"p.{column} {operator} %s"
        for field, column in PHYSICAL_RANGES.items()
        for bound, operator in (("min", ">="), ("max", "<="))
    },
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    with ConnectionPool(
        database_url(), kwargs={"row_factory": dict_row}, min_size=1, max_size=5,
        open=False,
    ) as pool:
        pool.wait(timeout=10)
        with pool.connection() as connection:
            create_schema(connection)
        app.state.pool = pool
        yield


app = FastAPI(title="Exoplanet Catalog", version="0.1.0", lifespan=lifespan)

CATALOG_DIR = Path(__file__).parent
FRONTEND_DIR = CATALOG_DIR / "frontend"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"

if FRONTEND_INDEX.is_file():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="frontend-assets")


@app.get("/", response_class=FileResponse, include_in_schema=False)
def homepage():
    return FileResponse(
        FRONTEND_INDEX if FRONTEND_INDEX.is_file() else CATALOG_DIR / "dashboard.html",
        media_type="text/html",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/check", response_class=FileResponse, include_in_schema=False)
def dashboard():
    return FileResponse(CATALOG_DIR / "dashboard.html", media_type="text/html")


def read_connection(request: Request):
    with request.app.state.pool.connection() as connection:
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        yield connection


Database = Annotated[Connection, Depends(read_connection)]


def planet_where(filters: Filters, *, require_coordinates: bool = False):
    conditions = (
        ["s.ra_deg IS NOT NULL", "s.dec_deg IS NOT NULL", "s.distance_pc > 0"]
        if require_coordinates else []
    )
    params = []
    if filters.q is not None:
        term = filters.q.replace("!", "!!").replace("%", "!%").replace("_", "!_")
        conditions.append("(p.name ILIKE %s ESCAPE '!' OR s.hostname ILIKE %s ESCAPE '!')")
        params.extend((f"%{term}%", f"%{term}%"))
    if filters.method is not None:
        conditions.append("p.discovery_method = %s")
        params.append(filters.method)
    for field, predicate in RANGE_FILTERS.items():
        value = getattr(filters, field)
        if value is not None:
            conditions.append(predicate)
            params.append(value)
    return sql.SQL(" WHERE " + " AND ".join(conditions) if conditions else ""), params


@app.get("/api/planets", response_model=PlanetPage)
def list_planets(filters: Annotated[PlanetQuery, Query()], db: Database):
    where, params = planet_where(filters)
    total = db.execute(sql.SQL("SELECT count(*) AS total") + FROM_PLANETS + where, params)
    ordering = sql.SQL(" ORDER BY {} {} NULLS LAST, p.id LIMIT %s OFFSET %s").format(
        SORT_COLUMNS[filters.sort], sql.SQL(filters.order.upper()),
    )
    offset = (filters.page - 1) * filters.page_size
    items = db.execute(SELECT_PLANETS + where + ordering, [*params, filters.page_size, offset])
    return {
        "items": items.fetchall(),
        "total": total.fetchone()["total"],
        "page": filters.page,
        "page_size": filters.page_size,
    }


@app.get("/api/planets/{planet_id}", response_model=Planet)
def get_planet(planet_id: UUID, db: Database):
    row = db.execute(SELECT_PLANETS + sql.SQL(" WHERE p.id = %s"), (planet_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Planet not found")
    return row


@app.get("/api/stats", response_model=Stats)
def stats(filters: Annotated[Filters, Query()], db: Database):
    where, params = planet_where(filters)
    source = FROM_PLANETS + where
    years = db.execute(
        sql.SQL("SELECT p.discovery_year AS year, count(*) AS count") + source
        + sql.SQL(" GROUP BY p.discovery_year ORDER BY year NULLS LAST"),
        params,
    ).fetchall()
    methods = db.execute(
        sql.SQL("SELECT p.discovery_method AS method, count(*) AS count") + source
        + sql.SQL(" GROUP BY p.discovery_method ORDER BY count DESC, method NULLS LAST"),
        params,
    ).fetchall()
    return {"total": sum(row["count"] for row in years), "by_year": years, "by_method": methods}


@app.get("/api/systems", response_model=list[SystemPoint])
def system_points(filters: Annotated[Filters, Query()], db: Database):
    where, params = planet_where(filters, require_coordinates=True)
    query = (
        sql.SQL("SELECT s.id, s.ra_deg, s.dec_deg, s.distance_pc, count(*) AS planet_count")
        + FROM_PLANETS + where
        + sql.SQL(" GROUP BY s.id ORDER BY s.id")
    )
    return db.execute(query, params).fetchall()


@app.get("/api/systems/{system_id}", response_model=SystemDetail)
def get_system(system_id: UUID, db: Database):
    system = db.execute("SELECT * FROM systems WHERE id = %s", (system_id,)).fetchone()
    if system is None:
        raise HTTPException(404, "System not found")
    planets = db.execute(
        SELECT_PLANETS
        + sql.SQL(" WHERE s.id = %s ORDER BY p.orbital_period_days NULLS LAST, p.name"),
        (system_id,),
    ).fetchall()
    return {**system, "planets": planets}


@app.get("/api/catalog", response_model=CatalogState)
def catalog_state(db: Database):
    row = db.execute("SELECT imported_at, planet_count FROM catalog_state").fetchone()
    return row or {"imported_at": None, "planet_count": 0}


@app.get("/api/ranking")
def ranking(db: Database, limit: Annotated[int, Query(ge=1, le=50)] = 50):
    row = db.execute(
        "SELECT calculated_at, items FROM habitability_ranking WHERE model = %s",
        (RANKING_MODEL,),
    ).fetchone()
    if row is None:
        return {"source": "team_csv", "calculated_at": None, "items": seed_ranking()[:limit]}
    return {"source": "team_script", "calculated_at": row["calculated_at"], "items": row["items"][:limit]}
