import csv
from functools import lru_cache
from io import StringIO
from pathlib import Path

from .physical import density_from_mass

RANKING_COLUMNS = (
    "pl_bmasse", "pl_bmassprov", "pl_eqt", "pl_insol", "pl_orbeccen",
    "st_teff", "st_rad", "st_mass",
)

NUMBER_FIELDS = {
    "radius_earth": "Радиус (радиусы Земли)",
    "mass_earth": "Масса (массы Земли)",
    "temperature_k": "Равновесная температура (K)",
    "insolation": "Поток излучения (потоки Земли)",
    "distance_pc": "Расстояние до системы (пк)",
    "semi_major_axis_au": "Большая полуось орбиты (а.е.)",
    "star_temperature_k": "Температура звезды (K)",
}


def read_ranking(rows):
    items = []
    for row in rows:
        item = {
            "rank": int(row["Место в рейтинге"]),
            "name": row["Название планеты"],
            "hostname": row["Родительская звезда"] or None,
            "score": float(row["Итоговый рейтинг"]),
            "zone": row["Положение относительно HZ"],
            "quality": row["Полнота данных"],
            "category": row["Категория кандидата"],
            "mass_source": row["Источник массы"],
            "mass_provenance": row["Происхождение оценки массы"] or None,
            "missing_data": row["Недостающие данные"],
            "human_habitability": row["Пригодность для человека"],
            **{name: float(row[column]) if row[column] else None for name, column in NUMBER_FIELDS.items()},
        }
        item["density_g_cm3"] = density_from_mass(item["mass_earth"], item["radius_earth"])
        items.append(item)
    if [item["rank"] for item in items] != list(range(1, 51)):
        raise ValueError("Expected 50 ranked candidates")
    return items


@lru_cache(maxsize=1)
def seed_ranking():
    path = Path(__file__).with_name("ranking_seed.csv")
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return read_ranking(csv.DictReader(stream))


def calculate_ranking(source_rows):
    import pandas as pd

    from . import team_scoring as team

    data = team.prepare_data(pd.DataFrame(source_rows).replace("", None))
    data = team.impute_mass_and_density(data)
    top = team.select_top50(team.process_planets(data))
    output = team.prepare_output(top)
    return read_ranking(csv.DictReader(StringIO(output.to_csv(index=False))))
