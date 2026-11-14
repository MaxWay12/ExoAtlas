import json
import math
from functools import lru_cache
from pathlib import Path

import pandas as pd

from . import team_scoring as team

RANKING_MODEL = "team_v2"
RANKING_COLUMNS = (
    "pl_bmasse", "pl_bmassprov", "pl_dens", "pl_eqt", "pl_insol",
    "pl_orbeccen", "st_teff", "st_rad", "st_mass", "st_lum",
    "pl_controv_flag", *team.LIMIT_FLAGS.values(),
)

NUMBER_FIELDS = {
    "score": "priority_score",
    "radius_earth": "pl_rade",
    "mass_earth": "pl_bmasse",
    "temperature_k": "pl_eqt",
    "insolation": "insolation_flux",
    "distance_pc": "sy_dist",
    "semi_major_axis_au": "pl_orbsmax",
    "star_temperature_k": "st_teff",
    "density_g_cm3": "density_final",
    "data_coverage_pct": "data_coverage_pct",
    "earth_similarity_percent": "earth_similarity_percent",
}


def number_or_none(value):
    value = team.num(value)
    return float(value) if math.isfinite(value) else None


@lru_cache(maxsize=1)
def seed_ranking():
    path = Path(__file__).with_name("ranking_seed.json")
    return json.loads(path.read_text(encoding="utf-8"))


def calculate_ranking(source_rows):
    data = team.prepare_data(pd.DataFrame(source_rows).replace("", None))
    top = team.select_top50(team.process_planets(data))
    items = []
    for row in top.to_dict("records"):
        items.append({
            "rank": int(row["rank"]),
            "name": row["pl_name"],
            "hostname": row.get("hostname") or None,
            "zone": row["hz_status"],
            "optimistic_zone": row["optimistic_hz_status"],
            "quality": row["confidence"],
            "category": row["esi_class"],
            "mass_source": "NASA" if number_or_none(row["pl_bmasse"]) is not None else "Нет данных",
            "mass_provenance": row["mass_provenance"] or None,
            "missing_data": row["missing_data"],
            "human_habitability": row["human_habitability_status"],
            **{name: number_or_none(row.get(column)) for name, column in NUMBER_FIELDS.items()},
        })
    return items
