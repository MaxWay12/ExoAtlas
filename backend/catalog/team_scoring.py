"""Модель рейтинга из final_exoplanet_top50.py команды."""

import numpy as np
import pandas as pd

TOP_N = 50

MIN_RADIUS_EARTH = 0.5
MAX_RADIUS_EARTH = 2.0
EXPANDED_MAX_RADIUS_EARTH = 2.1

MIN_DENSITY = 0.5
MAX_DENSITY = 20.0

MIN_STAR_TEMP_K = 2600.0
MAX_STAR_TEMP_K = 7200.0

EARTH_DENSITY = 5.514
EARTH_RADIUS = 1.0
EARTH_FLUX = 1.0
EARTH_GRAVITY = 1.0
EARTH_EQ_TEMP_K = 255.0
SOLAR_TEMPERATURE_K = 5772.0
KOPPARAPU_REFERENCE_TEMP_K = 5780.0

STRICT_MASS_PROVENANCE = {"Mass"}

WEIGHTS = {
    # Scenario priorities on a 100-point scale, not calibrated probabilities.
    "hz_score": 50.0,
    "radius_score": 35.0,
    "density_score": 15.0,
}

DIAGNOSTIC_SCORES = ("flux_score", "gravity_score", "temperature_score", "eccentricity_score")
SIGMA_RADIUS = 0.35
SIGMA_FLUX = 0.50
SIGMA_DENSITY = 0.50
SIGMA_GRAVITY = 0.40
SIGMA_ECCENTRICITY = 0.20
SIGMA_TEMP_K = 100.0

LIMIT_FLAGS = {
    "pl_rade": "pl_radelim",
    "pl_bmasse": "pl_bmasselim",
    "pl_dens": "pl_denslim",
    "pl_eqt": "pl_eqtlim",
    "pl_insol": "pl_insollim",
    "pl_orbsmax": "pl_orbsmaxlim",
    "pl_orbeccen": "pl_orbeccenlim",
    "st_teff": "st_tefflim",
    "st_rad": "st_radlim",
    "st_lum": "st_lumlim",
}


# ------------------------------------------------------------
# 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ------------------------------------------------------------

def num(value):
    try:
        x = float(value)
        return x if np.isfinite(x) else np.nan
    except (TypeError, ValueError):
        return np.nan


def gaussian_log_score(value, target, sigma):
    x, x0, s = num(value), num(target), num(sigma)
    if not (np.isfinite(x) and np.isfinite(x0) and np.isfinite(s)):
        return np.nan
    if x <= 0 or x0 <= 0 or s <= 0:
        return np.nan
    z = np.log(x / x0) / s
    return float(100.0 * np.exp(-0.5 * z * z))


def esi_component(value, earth_value):
    x, x0 = num(value), num(earth_value)
    if not (np.isfinite(x) and np.isfinite(x0)) or x <= 0 or x0 <= 0:
        return np.nan
    return float(1.0 - abs((x - x0) / (x + x0)))


def prepare_data(data, max_radius=EXPANDED_MAX_RADIUS_EARTH):
    print("Подготовка данных...")
    data = data.copy()

    required = {"pl_name", "pl_rade", "st_teff"}
    if missing := required - set(data.columns):
        raise ValueError(f"В исходном CSV отсутствуют поля: {', '.join(sorted(missing))}")
    for column in ("pl_bmasse", "pl_dens", "pl_eqt", "pl_insol", "pl_orbsmax",
                   "pl_orbeccen", "st_rad", "st_lum", "pl_controv_flag"):
        if column not in data:
            data[column] = np.nan
    if "pl_bmassprov" not in data:
        data["pl_bmassprov"] = ""
    if "discoverymethod" not in data:
        data["discoverymethod"] = ""
    if "data_retrieved_utc" not in data:
        data["data_retrieved_utc"] = ""

    text_columns = {"pl_name", "hostname", "discoverymethod", "pl_bmassprov", "data_retrieved_utc"}
    for col in data.columns:
        if col not in text_columns:
            data[col] = pd.to_numeric(data[col], errors="coerce").replace([np.inf, -np.inf], np.nan)

    for column, flag in LIMIT_FLAGS.items():
        if flag in data:
            data.loc[data[flag].fillna(0).ne(0), column] = np.nan
    # Для этих методов pl_orbsmax может содержать проекцию, а не полуось.
    projected = data["discoverymethod"].isin(["Imaging", "Microlensing"])
    data.loc[projected, "pl_orbsmax"] = np.nan

    data["pl_name"] = data["pl_name"].astype("string").str.strip()
    data["pl_bmassprov"] = data["pl_bmassprov"].fillna("").astype(str).str.strip()

    data = data.dropna(subset=["pl_name", "pl_rade"]).copy()
    data = data[data["pl_name"].ne("")]
    data = data[data["pl_rade"].between(
        MIN_RADIUS_EARTH, max_radius
    )].copy()

    data = data[data["pl_controv_flag"].ne(1)]

    data = data.drop_duplicates(subset=["pl_name"], keep="first")
    data.reset_index(drop=True, inplace=True)

    print(f"После фильтра радиуса и статуса: {len(data)}")
    return data


# ------------------------------------------------------------
# 5. МАССА, ПЛОТНОСТЬ И ГРАВИТАЦИЯ
# ------------------------------------------------------------

def calculate_mass_density_gravity(data):
    data = data.copy()
    mass = data["pl_bmasse"]
    radius = data["pl_rade"]
    provenance = data["pl_bmassprov"].fillna("").astype(str).str.strip()

    valid_mass = (
        provenance.isin(STRICT_MASS_PROVENANCE)
        & mass.notna() & radius.notna()
        & (mass > 0) & (radius > 0)
    )

    data["mass_provenance"] = provenance
    data["mass_used_for_derived_values"] = valid_mass

    derived_density = pd.Series(np.nan, index=data.index, dtype=float)
    derived_density.loc[valid_mass] = (
        EARTH_DENSITY * mass.loc[valid_mass] / radius.loc[valid_mass] ** 3
    )

    published_density = data["pl_dens"]
    # В PSCompPars плотность может быть оценкой на основе массы из архива.
    # При строгом режиме используем её для балла только с массой типа Mass.
    valid_catalog_density = valid_mass & published_density.gt(0)

    data["density_calculated"] = derived_density
    data["density_final"] = published_density.where(
        valid_catalog_density, derived_density
    )
    data["density_source"] = np.where(
        valid_catalog_density,
        "NASA: pl_dens",
        np.select(
            [derived_density.notna(), published_density.gt(0)],
            ["Расчёт по NASA Mass и радиусу", "NASA: pl_dens; без Mass исключена из рейтинга"],
            default="Нет надёжных данных",
        )
    )

    gravity = pd.Series(np.nan, index=data.index, dtype=float)
    gravity.loc[valid_mass] = (
        mass.loc[valid_mass] / radius.loc[valid_mass] ** 2
    )
    data["gravity_earth"] = gravity
    data["gravity_source"] = np.where(
        gravity.notna(), "Расчёт по NASA Mass и радиусу", "Не рассчитана"
    )

    return data


# ------------------------------------------------------------
# 6. СВЕТИМОСТЬ
# ------------------------------------------------------------

def calculate_luminosity(data):
    data = data.copy()
    r = data["st_rad"]
    t = data["st_teff"]
    valid = r.notna() & t.notna() & (r > 0) & (t > 0)

    luminosity = pd.Series(np.nan, index=data.index, dtype=float)
    luminosity.loc[valid] = (
        r.loc[valid] ** 2 * (t.loc[valid] / SOLAR_TEMPERATURE_K) ** 4
    )
    catalog_luminosity = 10.0 ** data["st_lum"]
    data["luminosity_solar"] = catalog_luminosity.where(
        np.isfinite(catalog_luminosity) & catalog_luminosity.gt(0), luminosity
    )
    return data


# ------------------------------------------------------------
# 7. ПОТОК ИЗЛУЧЕНИЯ
# ------------------------------------------------------------

def calculate_insolation(data):
    data = data.copy()
    published = data["pl_insol"]
    valid_published = published.notna() & (published > 0)

    luminosity = data["luminosity_solar"]
    a = data["pl_orbsmax"]
    e = data["pl_orbeccen"]

    valid_e = e.isna() | (e.ge(0) & e.lt(1))
    valid_calc = (
        luminosity.notna() & a.notna()
        & (luminosity > 0) & (a > 0) & valid_e
    )

    e_used = e.fillna(0.0)
    calculated = pd.Series(np.nan, index=data.index, dtype=float)
    calculated.loc[valid_calc] = (
        luminosity.loc[valid_calc]
        / (
            a.loc[valid_calc] ** 2
            * np.sqrt(1.0 - e_used.loc[valid_calc] ** 2)
        )
    )

    data["insolation_flux"] = published.where(valid_published, calculated)

    source = pd.Series("Нет данных", index=data.index, dtype="object")
    source.loc[valid_calc] = np.where(
        e.loc[valid_calc].isna(),
        "Расчёт; e неизвестен, принято e=0",
        "Расчёт по светимости, большой полуоси и эксцентриситету"
    )
    source.loc[valid_published] = "NASA: pl_insol"
    data["insolation_source"] = source
    return data


# ------------------------------------------------------------
# 8. МОДЕЛЬ ОБИТАЕМОЙ ЗОНЫ KOPPARAPU
# ------------------------------------------------------------

def calculate_hz_flux_limits(star_temperature):
    t_star = num(star_temperature)
    if not np.isfinite(t_star):
        return np.nan, np.nan
    if not MIN_STAR_TEMP_K <= t_star <= MAX_STAR_TEMP_K:
        return np.nan, np.nan

    t = t_star - KOPPARAPU_REFERENCE_TEMP_K

    inner = (
        1.107 + 1.332e-4 * t + 1.580e-8 * t**2
        - 8.308e-12 * t**3 - 1.931e-15 * t**4
    )
    outer = (
        0.356 + 6.171e-5 * t + 1.698e-9 * t**2
        - 3.198e-12 * t**3 - 5.575e-16 * t**4
    )

    if inner <= 0 or outer <= 0 or outer >= inner:
        return np.nan, np.nan
    return float(inner), float(outer)


def calculate_optimistic_hz_flux_limits(star_temperature):
    t_star = num(star_temperature)
    if not MIN_STAR_TEMP_K <= t_star <= MAX_STAR_TEMP_K:
        return np.nan, np.nan
    t = t_star - KOPPARAPU_REFERENCE_TEMP_K

    # Recent Venus / Early Mars (Kopparapu et al., 2014, Table 1).
    inner = 1.776 + 2.136e-4 * t + 2.533e-8 * t**2 - 1.332e-11 * t**3 - 3.097e-15 * t**4
    outer = 0.320 + 5.547e-5 * t + 1.526e-9 * t**2 - 2.874e-12 * t**3 - 5.011e-16 * t**4
    return inner, outer


def optimistic_orbit_status(inner, outer, peri, apo, a):
    if np.isfinite(peri):
        if peri >= inner and apo <= outer:
            return "Вся орбита в оптимистической HZ"
        if peri <= outer and apo >= inner:
            return "Орбита пересекает оптимистическую HZ"
        return "Орбита вне оптимистической HZ"
    if inner <= a <= outer:
        return "В оптимистической HZ по круговому приближению"
    return "Вне оптимистической HZ по круговому приближению"


def optimistic_flux_status(flux, s_inner, s_outer):
    if not flux > 0 or not np.isfinite(s_inner):
        return "Недостаточно данных для проверки оптимистической HZ"
    if s_outer <= flux <= s_inner:
        return "Поток соответствует оптимистической HZ; геометрия неизвестна"
    return "Поток вне границ оптимистической HZ"


def calculate_habitable_zone(data):
    data = data.copy()
    geometry = []
    for _, row in data.iterrows():
        s_inner, s_outer = calculate_hz_flux_limits(row["st_teff"])
        luminosity = num(row["luminosity_solar"])
        a = num(row["pl_orbsmax"])
        e = num(row["pl_orbeccen"])
        flux = num(row["insolation_flux"])
        r_inner = np.sqrt(luminosity / s_inner) if luminosity > 0 else np.nan
        r_outer = np.sqrt(luminosity / s_outer) if luminosity > 0 else np.nan
        has_ellipse = a > 0 and 0 <= e < 1
        r_peri = a * (1.0 - e) if has_ellipse else np.nan
        r_apo = a * (1.0 + e) if has_ellipse else np.nan

        if not np.isfinite(s_inner):
            status = (
                "Температура звезды вне диапазона модели HZ"
                if np.isfinite(num(row["st_teff"]))
                else "Неизвестна температура звезды"
            )
        elif has_ellipse and np.isfinite(r_inner):
            if r_peri >= r_inner and r_apo <= r_outer:
                status = "Вся орбита в консервативной HZ"
            elif r_apo < r_inner:
                status = "Орбита внутри внутренней границы HZ"
            elif r_peri > r_outer:
                status = "Орбита за внешней границей HZ"
            else:
                status = "Орбита пересекает границу HZ"
        elif a > 0 and np.isfinite(r_inner):
            if r_inner <= a <= r_outer:
                status = "В HZ по круговой аппроксимации; эксцентриситет неизвестен"
            elif a < r_inner:
                status = "Внутри внутренней границы HZ; e неизвестен"
            else:
                status = "За внешней границей HZ; e неизвестен"
        elif not flux > 0:
            status = "Недостаточно данных для проверки HZ"
        elif s_outer <= flux <= s_inner:
            status = "Поток соответствует HZ; орбитальная проверка невозможна"
        elif flux > s_inner:
            status = "Поток выше внутренней границы HZ"
        else:
            status = "Поток ниже внешней границы HZ"
        opt_inner_flux, opt_outer_flux = calculate_optimistic_hz_flux_limits(row["st_teff"])
        opt_inner = np.sqrt(luminosity / opt_inner_flux) if luminosity > 0 else np.nan
        opt_outer = np.sqrt(luminosity / opt_outer_flux) if luminosity > 0 else np.nan
        if a > 0 and np.isfinite(opt_inner):
            opt_status = optimistic_orbit_status(opt_inner, opt_outer, r_peri, r_apo, a)
        else:
            opt_status = optimistic_flux_status(flux, opt_inner_flux, opt_outer_flux)
        geometry.append((
            status, r_inner, r_outer, r_peri, r_apo, s_inner, s_outer, opt_status,
            opt_inner, opt_outer, opt_inner_flux, opt_outer_flux,
        ))
    columns = [
        "hz_status", "hz_inner_au", "hz_outer_au", "orbit_periastron_au",
        "orbit_apastron_au", "hz_inner_flux", "hz_outer_flux", "optimistic_hz_status",
        "optimistic_hz_inner_au", "optimistic_hz_outer_au",
        "optimistic_hz_inner_flux", "optimistic_hz_outer_flux",
    ]
    data[columns] = pd.DataFrame(geometry, columns=columns, index=data.index)
    return data


# ------------------------------------------------------------
# 9. БАЛЛЫ ФИЗИЧЕСКИХ ПОКАЗАТЕЛЕЙ
# ------------------------------------------------------------

OPTIMISTIC_HZ_SCORES = {
    "Вся орбита в оптимистической HZ": 65.0,
    "В оптимистической HZ по круговому приближению": 55.0,
    "Орбита пересекает оптимистическую HZ": 50.0,
    "Поток соответствует оптимистической HZ; геометрия неизвестна": 45.0,
}


def calculate_hz_score(row):
    status = row["hz_status"]
    if status == "Вся орбита в консервативной HZ":
        return 100.0
    if status.startswith("В HZ по круговой аппроксимации"):
        return 85.0
    if status.startswith("Поток соответствует HZ"):
        return 70.0
    if status == "Орбита пересекает границу HZ":
        return 60.0
    optimistic_score = OPTIMISTIC_HZ_SCORES.get(row["optimistic_hz_status"])
    if optimistic_score is not None:
        return optimistic_score
    if status in (
        "Температура звезды вне диапазона модели HZ",
        "Неизвестна температура звезды",
        "Недостаточно данных для проверки HZ",
    ):
        return np.nan
    return 0.0


def calculate_flux_score(row):
    flux = num(row["insolation_flux"])
    s_inner = num(row["hz_inner_flux"])
    s_outer = num(row["hz_outer_flux"])
    if not np.isfinite(flux) or flux <= 0:
        return np.nan

    if (
        np.isfinite(s_inner) and np.isfinite(s_outer)
        and s_inner > 0 and s_outer > 0
    ):
        target = np.sqrt(s_inner * s_outer)
    else:
        target = EARTH_FLUX

    return gaussian_log_score(flux, target, SIGMA_FLUX)


def calculate_temperature_score(temperature):
    t = num(temperature)
    if not np.isfinite(t) or t <= 0:
        return np.nan
    z = (t - EARTH_EQ_TEMP_K) / SIGMA_TEMP_K
    return float(100.0 * np.exp(-0.5 * z**2))


def calculate_eccentricity_score(eccentricity):
    e = num(eccentricity)
    if not np.isfinite(e) or not 0 <= e < 1:
        return np.nan
    z = e / SIGMA_ECCENTRICITY
    return float(100.0 * np.exp(-0.5 * z**2))


def calculate_esi_proxy(row):
    r_score = esi_component(row["pl_rade"], EARTH_RADIUS)
    f_score = esi_component(row["insolation_flux"], EARTH_FLUX)

    available = int(np.isfinite(r_score)) + int(np.isfinite(f_score))
    completeness = 100.0 * available / 2.0
    esi = (
        float(np.sqrt(r_score * f_score))
        if available == 2 else np.nan
    )

    if not np.isfinite(esi):
        esi_class = "Недостаточно данных"
    elif esi >= 0.80:
        esi_class = "Высокое сходство по выбранным параметрам"
    elif esi >= 0.60:
        esi_class = "Умеренное сходство по выбранным параметрам"
    else:
        esi_class = "Низкое сходство по выбранным параметрам"

    return pd.Series({
        "esi_radius_component": r_score,
        "esi_flux_component": f_score,
        "earth_similarity_index_proxy": esi,
        "earth_similarity_percent": esi * 100.0 if np.isfinite(esi) else np.nan,
        "esi_data_completeness_pct": completeness,
        "esi_class": esi_class,
    })


def calculate_scores(data):
    data = data.copy()
    if data.empty:
        for column in (*WEIGHTS, *DIAGNOSTIC_SCORES, "physical_score_known_only", "data_coverage_pct",
                       "priority_score", "confidence", "esi_radius_component",
                       "esi_flux_component", "earth_similarity_index_proxy",
                       "earth_similarity_percent", "esi_data_completeness_pct", "esi_class"):
            data[column] = pd.Series(index=data.index, dtype="object")
        return data

    data["hz_score"] = data.apply(calculate_hz_score, axis=1)
    data["flux_score"] = data.apply(calculate_flux_score, axis=1)
    data["radius_score"] = data["pl_rade"].apply(
        lambda x: gaussian_log_score(x, EARTH_RADIUS, SIGMA_RADIUS)
    )
    data["density_score"] = data["density_final"].apply(
        lambda x: gaussian_log_score(x, EARTH_DENSITY, SIGMA_DENSITY)
    )
    data["gravity_score"] = data["gravity_earth"].apply(
        lambda x: gaussian_log_score(x, EARTH_GRAVITY, SIGMA_GRAVITY)
    )
    data["temperature_score"] = data["pl_eqt"].apply(
        calculate_temperature_score
    )
    data["eccentricity_score"] = data["pl_orbeccen"].apply(
        calculate_eccentricity_score
    )

    def known_parameter_mean(row):
        numerator, denominator = 0.0, 0.0
        for column, weight in WEIGHTS.items():
            value = num(row[column])
            if np.isfinite(value):
                numerator += value * weight
                denominator += weight
        return numerator / denominator if denominator > 0 else np.nan

    data["physical_score_known_only"] = data.apply(
        known_parameter_mean, axis=1
    )

    def coverage(row):
        available_weight = sum(
            weight for column, weight in WEIGHTS.items()
            if np.isfinite(num(row[column]))
        )
        return 100.0 * available_weight / sum(WEIGHTS.values())

    data["data_coverage_pct"] = data.apply(coverage, axis=1)

    data["priority_score"] = (
        data["physical_score_known_only"]
        * data["data_coverage_pct"] / 100.0
    )

    def coverage_level(row):
        c = row["data_coverage_pct"]
        if c >= 80:
            return "Высокая полнота"
        if c >= 55:
            return "Средняя полнота"
        return "Низкая полнота"

    data["confidence"] = data.apply(coverage_level, axis=1)

    esi = data.apply(calculate_esi_proxy, axis=1)
    data = pd.concat([data, esi], axis=1)
    return data


# ------------------------------------------------------------
# 10. ОТБОР ДО 50 КАНДИДАТОВ
# ------------------------------------------------------------

def is_hz_candidate(status):
    return (
        status == "Вся орбита в консервативной HZ"
        or status.startswith("В HZ по круговой аппроксимации")
        or status.startswith("Поток соответствует HZ")
    )


def select_top50(data, strict=False):
    print("Формирование ТОП-50...")
    data = data.copy()

    # Каталожная плотность за пределами диапазона исключает объект,
    # даже если происхождение массы не позволяет начислить балл плотности.
    density_for_filter = data["pl_dens"].where(data["pl_dens"].gt(0), data["density_final"])
    known_density = density_for_filter.notna()
    valid_density = density_for_filter.between(MIN_DENSITY, MAX_DENSITY)
    data = data[(~known_density) | valid_density].copy()
    print(f"После фильтра плотности: {len(data)}")

    conservative = data["hz_status"].map(is_hz_candidate).astype(bool)
    if strict:
        data["is_hz_candidate"] = conservative & data["pl_rade"].le(MAX_RADIUS_EARTH)
    else:
        in_optimistic_zone = data["optimistic_hz_status"].isin(OPTIMISTIC_HZ_SCORES)
        data["is_hz_candidate"] = (conservative | in_optimistic_zone) & data["pl_rade"].le(
            EXPANDED_MAX_RADIUS_EARTH
        )
    candidates = data[data["is_hz_candidate"]].copy()
    print(f"Кандидатов в HZ: {len(candidates)}")

    candidates = candidates.sort_values(
        by=[
            "priority_score",
            "data_coverage_pct",
            "earth_similarity_index_proxy",
            "pl_rade",
            "pl_name",
        ],
        ascending=[False, False, False, True, True],
        na_position="last",
    )

    top = candidates.head(TOP_N).copy().reset_index(drop=True)
    top.insert(0, "rank", range(1, len(top) + 1))
    return top


# ------------------------------------------------------------
# 11. НЕИЗВЕСТНЫЕ УСЛОВИЯ
# ------------------------------------------------------------

def determine_missing_data(row):
    missing = []
    fields = {
        "pl_bmasse": "Опубликованная масса планеты",
        "density_final": "Плотность",
        "gravity_earth": "Гравитация",
        "pl_eqt": "Равновесная температура",
        "insolation_flux": "Поток излучения",
        "pl_orbeccen": "Эксцентриситет",
        "st_teff": "Температура звезды",
        "st_rad": "Радиус звезды",
        "st_mass": "Масса звезды",
        "sy_dist": "Расстояние до системы",
    }
    for key, label in fields.items():
        if pd.isna(row.get(key)):
            missing.append(label)

    missing.extend([
        "Состав и давление атмосферы",
        "Наличие жидкой воды на поверхности",
        "Температура поверхности",
        "Радиационная обстановка у поверхности",
        "Магнитное поле",
        "Пригодность атмосферы для дыхания",
        "Активность звезды и частота вспышек",
    ])
    return "; ".join(missing)


def process_planets(data):
    print("Расчёт характеристик и индексов...")
    data = calculate_mass_density_gravity(data)
    data = calculate_luminosity(data)
    data = calculate_insolation(data)
    data = calculate_habitable_zone(data)
    data = calculate_scores(data)

    data["missing_data"] = [determine_missing_data(row) for _, row in data.iterrows()]
    data["human_habitability_status"] = (
        "Не установлена: рейтинг не подтверждает наличие пригодной "
        "для дыхания атмосферы, безопасного давления, жидкой воды "
        "или безопасного уровня радиации."
    )
    return data
