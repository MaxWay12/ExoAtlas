"""Расчёт рейтинга из planet.py команды."""

import numpy as np
import pandas as pd

from .physical import density_from_mass, estimate_mass

NUMBER_OF_PLANETS = 50

# Допустимый диапазон радиусов в радиусах Земли
MIN_RADIUS = 0.5
MAX_RADIUS = 3.0

# Диапазон плотности (г/см³) — защита от аномалий
MIN_DENSITY = 1.0
MAX_DENSITY = 20.0

# Константы
SOLAR_TEMPERATURE = 5772.0

# 2. ПОДГОТОВКА ДАННЫХ
def prepare_data(data):

    print("Обработка полученных данных...")

    numeric_columns = [
        "disc_year",
        "pl_rade",
        "pl_bmasse",
        "pl_eqt",
        "pl_insol",
        "pl_orbsmax",
        "pl_orbeccen",
        "sy_dist",
        "st_teff",
        "st_rad",
        "st_mass"
    ]

    for column in numeric_columns:

        if column in data.columns:

            data[column] = pd.to_numeric(
                data[column],
                errors="coerce"
            )

    # Удаляем записи без названия и радиуса.
    data = data.dropna(
        subset=["pl_name", "pl_rade"]
    ).copy()

    # Оставляем планеты заданного диапазона размеров.
    data = data[
        (data["pl_rade"] >= MIN_RADIUS)
        &
        (data["pl_rade"] <= MAX_RADIUS)
    ].copy()

    # Удаляем повторяющиеся названия.
    data = data.drop_duplicates(
        subset=["pl_name"]
    )

    data = data.reset_index(drop=True)

    if len(data) < NUMBER_OF_PLANETS:

        raise RuntimeError(
            f"Найдено только {len(data)} планет "
            f"с радиусом от {MIN_RADIUS} до {MAX_RADIUS} "
            "радиусов Земли. Получить ТОП-50 невозможно."
        )

    print(
        "После предварительного отбора осталось:",
        len(data)
    )

    return data

# 2.1. ИМПУТАЦИЯ МАССЫ И ПЛОТНОСТИ (НОВОЕ)
def impute_mass_and_density(data):

    print("Импутация массы и плотности...")

    # Сохраняем источник массы
    data["mass_source"] = np.where(
        data["pl_bmasse"].notna(),
        "NASA",
        "Расчёт (масса-радиус)"
    )

    # Заполняем пропуски массы
    mask_mass = data["pl_bmasse"].isna() & data["pl_rade"].notna()
    data.loc[mask_mass, "pl_bmasse"] = data.loc[mask_mass, "pl_rade"].apply(estimate_mass)

    # Расчёт плотности (если нет опубликованной)
    def calculate_density(row):
        if pd.notna(row["pl_dens"]):
            return row["pl_dens"]
        if pd.isna(row["pl_bmasse"]) or pd.isna(row["pl_rade"]) or row["pl_rade"] <= 0:
            return np.nan
        return density_from_mass(row["pl_bmasse"], row["pl_rade"])

    # Предполагаем, что pl_dens уже есть в данных
    if "pl_dens" not in data.columns:
        data["pl_dens"] = np.nan

    data["density_final"] = data.apply(calculate_density, axis=1)

    print(f"Восстановлено масс: {mask_mass.sum()}")

    return data

# 3. РАСЧЕТ СВЕТИМОСТИ ЗВЕЗДЫ
def calculate_luminosity(row):

    star_radius = row.get("st_rad")
    star_temperature = row.get("st_teff")

    if pd.isna(star_radius) or pd.isna(star_temperature):
        return np.nan

    if star_radius <= 0 or star_temperature <= 0:
        return np.nan

    # Светимость относительно Солнца.
    luminosity = (
        star_radius ** 2
        *
        (star_temperature / SOLAR_TEMPERATURE) ** 4
    )

    return luminosity

# 4. РАСЧЕТ ПОТОКА ИЗЛУЧЕНИЯ
def calculate_insolation(row):

    # Если поток уже опубликован NASA, используем его.
    published_flux = row.get("pl_insol")

    if pd.notna(published_flux) and published_flux > 0:
        return published_flux

    # Иначе рассчитываем поток по светимости звезды и большой полуоси орбиты.
    luminosity = calculate_luminosity(row)

    orbital_distance = row.get("pl_orbsmax")

    if (
        pd.isna(luminosity)
        or pd.isna(orbital_distance)
        or orbital_distance <= 0
    ):
        return np.nan

    # Поток в единицах потока Земли.
    flux = luminosity / (orbital_distance ** 2)

    return flux

# 5. ГРАНИЦЫ ОБИТАЕМОЙ ЗОНЫ (РАСШИРЕНО ДО 2500 K)
def calculate_hz_limits(star_temperature):

    if pd.isna(star_temperature):
        return np.nan, np.nan

    # Приближение Коппарапу применяется в диапазоне эффективных температур 2500–7200 K.
    if not 2500 <= star_temperature <= 7200:
        return np.nan, np.nan

    t = star_temperature - 5780.0

    # Внутренняя граница: Runaway Greenhouse.
    inner = (
        1.107
        + 1.332e-4 * t
        + 1.58e-8 * t**2
        - 8.308e-12 * t**3
        - 1.931e-15 * t**4
    )

    # Внешняя граница: Maximum Greenhouse.
    outer = (
        0.356
        + 6.171e-5 * t
        + 1.698e-9 * t**2
        - 3.198e-12 * t**3
        - 5.575e-16 * t**4
    )

    return inner, outer

# 6. ОПРЕДЕЛЕНИЕ ПОЛОЖЕНИЯ ПЛАНЕТЫ
def determine_habitable_zone(row):

    flux = row["insolation_flux"]
    star_temperature = row["st_teff"]

    if pd.isna(flux):
        return "Недостаточно данных"

    inner, outer = calculate_hz_limits(star_temperature)

    if pd.isna(inner) or pd.isna(outer):
        return "Невозможно определить"

    # Внутренняя граница получает больший поток,
    # внешняя — меньший.
    if outer <= flux <= inner:
        return "В обитаемой зоне"

    if flux > inner:
        return "Внутри внутренней границы"

    return "За внешней границей"

# 7. ОЦЕНКА СХОДСТВА С ЗЕМЛЕЙ
def calculate_radius_score(radius):

    if pd.isna(radius) or radius <= 0:
        return 0

    # Максимальный балл при радиусе, близком к радиусу Земли.
    score = np.exp(
        -abs(np.log(radius)) / 0.7
    )

    return float(score)


def calculate_flux_score(flux):

    if pd.isna(flux) or flux <= 0:
        return 0

    # Максимальный балл при потоке, близком к земному.
    score = np.exp(
        -abs(np.log(flux)) / 1.1
    )

    return float(score)


def calculate_temperature_score(temperature):

    if pd.isna(temperature) or temperature <= 0:
        return 0

    # 255 K — приблизительная равновесная температура Земли без учета парникового эффекта.
    score = np.exp(
        -abs(temperature - 255.0) / 100.0
    )

    return float(score)

# 8. РАСЧЕТ ИТОГОВОГО РЕЙТИНГА
def calculate_priority_score(row):

    radius_score = calculate_radius_score(
        row["pl_rade"]
    )

    flux_score = calculate_flux_score(
        row["insolation_flux"]
    )

    temperature_score = calculate_temperature_score(
        row["pl_eqt"]
    )

    # Бонус за попадание в рассчитанную обитаемую зону.
    hz_bonus = (
        15
        if row["hz_status"] == "В обитаемой зоне"
        else 0
    )

    # Дополнительный балл за наличие массы.
    mass_bonus = (
        5
        if pd.notna(row["pl_bmasse"])
        else 0
    )

    # Небольшой бонус за известную орбитальную эксцентричность.
    eccentricity = row["pl_orbeccen"]

    eccentricity_bonus = 0

    if pd.notna(eccentricity):

        if 0 <= eccentricity <= 0.3:
            eccentricity_bonus = 5

        elif eccentricity <= 0.5:
            eccentricity_bonus = 2

    # Бонус за наличие основных параметров звезды.
    stellar_bonus = 0

    if pd.notna(row["st_teff"]):
        stellar_bonus += 3

    if pd.notna(row["st_rad"]):
        stellar_bonus += 3

    if pd.notna(row["st_mass"]):
        stellar_bonus += 2

    # Итоговый авторский рейтинг.
    score = (
        radius_score * 25
        +
        flux_score * 30
        +
        temperature_score * 15
        +
        hz_bonus
        +
        mass_bonus
        +
        eccentricity_bonus
        +
        stellar_bonus
    )

    return round(float(score), 2)

# 9. ОЦЕНКА ПОЛНОТЫ ДАННЫХ
def determine_data_quality(row):

    available = 0

    important_fields = [
        "pl_rade",
        "pl_bmasse",
        "pl_eqt",
        "insolation_flux",
        "pl_orbeccen",
        "st_teff",
        "st_rad",
        "st_mass",
        "sy_dist"
    ]

    for field in important_fields:

        if pd.notna(row.get(field)):
            available += 1

    if available >= 8:
        return "Высокая"

    if available >= 5:
        return "Средняя"

    return "Низкая"

# 10. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ КАНДИДАТА
def determine_category(row):

    status = row["hz_status"]

    if status == "В обитаемой зоне":

        return "Каменистый кандидат в обитаемой зоне"

    if status == "Внутри внутренней границы":

        return "Кандидат с повышенным потоком излучения"

    if status == "За внешней границей":

        return "Кандидат с пониженным потоком излучения"

    return "Кандидат с недостаточными данными"

# 11. ФОРМИРОВАНИЕ СПИСКА НЕДОСТАЮЩИХ ДАННЫХ
def determine_missing_data(row):

    missing = []

    fields = {
        "pl_bmasse": "Масса планеты",
        "pl_eqt": "Равновесная температура",
        "insolation_flux": "Поток излучения",
        "pl_orbeccen": "Эксцентриситет орбиты",
        "st_teff": "Температура звезды",
        "st_rad": "Радиус звезды",
        "st_mass": "Масса звезды",
        "sy_dist": "Расстояние до системы"
    }

    for field, description in fields.items():

        if pd.isna(row.get(field)):
            missing.append(description)

    missing.extend([
        "Состав атмосферы",
        "Атмосферное давление",
        "Наличие жидкой воды на поверхности",
        "Уровень радиации",
        "Магнитное поле",
        "Пригодность атмосферы для дыхания"
    ])

    if not missing:
        return "Нет пропусков в основных параметрах; свойства атмосферы не подтверждены"

    return "; ".join(missing)

# 12. ОБРАБОТКА ВСЕХ ПЛАНЕТ
def process_planets(data):

    print("Расчет характеристик экзопланет...")

    # Расчет потока излучения.
    data["insolation_flux"] = data.apply(
        calculate_insolation,
        axis=1
    )

    # Определение обитаемой зоны.
    data["hz_status"] = data.apply(
        determine_habitable_zone,
        axis=1
    )

    # Расстояние до обитаемой зоны в а.е.
    data["luminosity_solar"] = data.apply(
        calculate_luminosity,
        axis=1
    )

    def get_hz_distances(row):

        inner_flux, outer_flux = calculate_hz_limits(
            row["st_teff"]
        )

        luminosity = row["luminosity_solar"]

        if (
            pd.isna(inner_flux)
            or pd.isna(outer_flux)
            or pd.isna(luminosity)
            or luminosity <= 0
        ):
            return pd.Series(
                [np.nan, np.nan]
            )

        inner_distance = np.sqrt(
            luminosity / inner_flux
        )

        outer_distance = np.sqrt(
            luminosity / outer_flux
        )

        return pd.Series(
            [inner_distance, outer_distance]
        )

    data[
        ["hz_inner_au", "hz_outer_au"]
    ] = data.apply(
        get_hz_distances,
        axis=1
    )

    # Расчет рейтинга.
    data["priority_score"] = data.apply(
        calculate_priority_score,
        axis=1
    )

    # Оценка качества данных.
    data["data_quality"] = data.apply(
        determine_data_quality,
        axis=1
    )

    # Категория планеты.
    data["candidate_category"] = data.apply(
        determine_category,
        axis=1
    )

    # Недостающие характеристики.
    data["missing_data"] = data.apply(
        determine_missing_data,
        axis=1
    )

    # Отдельный статус пригодности для человека.
    data["human_habitability_status"] = (
        "Не подтверждена: нет достаточных данных "
        "об атмосфере, давлении, воде и радиации"
    )

    return data

# 13. ВЫБОР ТОП-50
def select_top50(data):

    print("Формирование рейтинга ТОП-50...")

    # Фильтр по плотности (защита от аномалий)
    data = data[
        (data["density_final"].isna()) |
        (
            (data["density_final"] >= MIN_DENSITY) &
            (data["density_final"] <= MAX_DENSITY)
        )
    ].copy()

    print(f"После фильтра плотности: {len(data)}")

    # Сначала сортируем по итоговому рейтингу. При одинаковом рейтинге выше ставится планета с более полными данными.
    quality_order = {
        "Высокая": 3,
        "Средняя": 2,
        "Низкая": 1
    }

    data["quality_order"] = data[
        "data_quality"
    ].map(quality_order)

    data = data.sort_values(
        by=[
            "priority_score",
            "quality_order",
            "pl_rade"
        ],
        ascending=[
            False,
            False,
            True
        ]
    )

    top50 = data.head(
        NUMBER_OF_PLANETS
    ).copy()

    top50 = top50.reset_index(drop=True)

    top50.insert(
        0,
        "rank",
        range(1, len(top50) + 1)
    )

    if len(top50) != NUMBER_OF_PLANETS:

        raise RuntimeError(
            f"Получено {len(top50)} планет вместо 50."
        )

    return top50

# 14. ПОДГОТОВКА ИТОГОВОГО CSV
def prepare_output(top50):

    output_columns = [
        "rank",
        "pl_name",
        "hostname",
        "disc_year",
        "discoverymethod",
        "pl_rade",
        "pl_bmasse",
        "mass_source",
        "pl_bmassprov",
        "pl_eqt",
        "insolation_flux",
        "pl_orbsmax",
        "pl_orbeccen",
        "sy_dist",
        "st_teff",
        "st_rad",
        "st_mass",
        "luminosity_solar",
        "hz_inner_au",
        "hz_outer_au",
        "hz_status",
        "priority_score",
        "data_quality",
        "candidate_category",
        "human_habitability_status",
        "missing_data"
    ]

    # Оставляем только существующие столбцы.
    output_columns = [
        column
        for column in output_columns
        if column in top50.columns
    ]

    result = top50[output_columns].copy()

    # Переименовываем столбцы для удобства чтения.
    result = result.rename(
        columns={
            "rank": "Место в рейтинге",
            "pl_name": "Название планеты",
            "hostname": "Родительская звезда",
            "disc_year": "Год открытия",
            "discoverymethod": "Метод обнаружения",
            "pl_rade": "Радиус (радиусы Земли)",
            "pl_bmasse": "Масса (массы Земли)",
            "mass_source": "Источник массы",
            "pl_bmassprov": "Происхождение оценки массы",
            "pl_eqt": "Равновесная температура (K)",
            "insolation_flux": "Поток излучения (потоки Земли)",
            "pl_orbsmax": "Большая полуось орбиты (а.е.)",
            "pl_orbeccen": "Эксцентриситет орбиты",
            "sy_dist": "Расстояние до системы (пк)",
            "st_teff": "Температура звезды (K)",
            "st_rad": "Радиус звезды (радиусы Солнца)",
            "st_mass": "Масса звезды (массы Солнца)",
            "luminosity_solar": "Светимость звезды (светимости Солнца)",
            "hz_inner_au": "Внутренняя граница HZ (а.е.)",
            "hz_outer_au": "Внешняя граница HZ (а.е.)",
            "hz_status": "Положение относительно HZ",
            "priority_score": "Итоговый рейтинг",
            "data_quality": "Полнота данных",
            "candidate_category": "Категория кандидата",
            "human_habitability_status": "Пригодность для человека",
            "missing_data": "Недостающие данные"
        }
    )

    return result
