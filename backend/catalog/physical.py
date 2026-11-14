EARTH_DENSITY = 5.514
SOLAR_RADIUS_AU = 0.00465047


def estimate_mass(radius):
    if radius < 1.5:
        return 1.1 * radius ** 3.4
    return 1.7 * radius ** 1.3


def density_from_mass(mass, radius):
    if mass is None or radius is None or radius <= 0:
        return None
    return EARTH_DENSITY * mass / radius ** 3


def estimate_temperature(star_temperature, star_radius, orbit):
    if any(value is None or value <= 0 for value in (star_temperature, star_radius, orbit)):
        return None
    return star_temperature * (SOLAR_RADIUS_AU * star_radius / (2 * orbit)) ** 0.5
