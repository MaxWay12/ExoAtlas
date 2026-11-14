import json
import math
from functools import lru_cache
from pathlib import Path

import pandas as pd

from . import team_scoring as team

RANKING_MODEL = "team_v2_explained"
RANKING_COLUMNS = (
    "pl_bmasse", "pl_bmassprov", "pl_dens", "pl_eqt", "pl_insol",
    "pl_orbeccen", "st_teff", "st_rad", "st_mass", "st_lum",
    "pl_controv_flag", "pl_rade_reflink", *team.LIMIT_FLAGS.values(),
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
    source = pd.DataFrame(source_rows).replace("", None)
    # Keep reference markup out of the scoring pipeline and API.
    references = dict(zip(source["pl_name"], source.pop("pl_rade_reflink"))) if "pl_rade_reflink" in source else {}
    data = team.prepare_data(source)
    top = team.select_top50(team.process_planets(data))
    items = []
    for row in top.to_dict("records"):
        discovery_year = number_or_none(row.get("disc_year"))
        reference = str(references.get(row["pl_name"]) or "").casefold()
        radius_source = (
            "Оценка NASA (расчёт)" if "calculated_value" in reference or "calculated value" in reference
            else "NASA, из публикации" if reference else "NASA, ссылка на источник отсутствует"
        )
        breakdown = {}
        for factor, weight in team.WEIGHTS.items():
            score = number_or_none(row[factor])
            breakdown[factor] = {
                "weight": weight, "score": score,
                "contribution": 0.0 if score is None else score * weight / 100,
            }
        items.append({
            "rank": int(row["rank"]),
            "name": row["pl_name"],
            "discovery_year": int(discovery_year) if discovery_year is not None else None,
            "hostname": row.get("hostname") or None,
            "zone": row["hz_status"],
            "optimistic_zone": row["optimistic_hz_status"],
            "quality": row["confidence"],
            "category": row["esi_class"],
            "radius_source": radius_source,
            "density_source": row["density_source"],
            "insolation_source": row["insolation_source"],
            "score_breakdown": breakdown,
            "habitable_zone": {
                key: number_or_none(row[key])
                for key in (
                    "hz_inner_au", "hz_outer_au", "optimistic_hz_inner_au", "optimistic_hz_outer_au",
                    "hz_inner_flux", "hz_outer_flux", "optimistic_hz_inner_flux", "optimistic_hz_outer_flux",
                    "orbit_periastron_au", "orbit_apastron_au",
                )
            },
            "mass_source": "NASA" if number_or_none(row["pl_bmasse"]) is not None else "Нет данных",
            "mass_provenance": row["mass_provenance"] or None,
            "missing_data": row["missing_data"],
            "human_habitability": row["human_habitability_status"],
            **{name: number_or_none(row.get(column)) for name, column in NUMBER_FIELDS.items()},
        })
    return items
