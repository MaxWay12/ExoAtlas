from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


PHYSICAL_RANGES = {
    "radius": "radius_earth",
    "temperature": "temperature_k",
    "density": "density_g_cm3",
    "star_temperature": "star_temperature_k",
    "orbit": "semi_major_axis_au",
}


class Filters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    q: str | None = Field(default=None, min_length=1, max_length=150)
    method: str | None = Field(default=None, min_length=1, max_length=100)
    year_from: int | None = Field(default=None, ge=0, le=9999)
    year_to: int | None = Field(default=None, ge=0, le=9999)
    radius_min: float | None = Field(default=None, ge=0)
    radius_max: float | None = Field(default=None, ge=0)
    temperature_min: float | None = Field(default=None, ge=0)
    temperature_max: float | None = Field(default=None, ge=0)
    density_min: float | None = Field(default=None, ge=0)
    density_max: float | None = Field(default=None, ge=0)
    star_temperature_min: float | None = Field(default=None, ge=0)
    star_temperature_max: float | None = Field(default=None, ge=0)
    orbit_min: float | None = Field(default=None, ge=0)
    orbit_max: float | None = Field(default=None, ge=0)
    distance_min: float | None = Field(default=None, ge=0)
    distance_max: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def check_ranges(self):
        for lower, upper in (
            ("year_from", "year_to"),
            ("distance_min", "distance_max"),
            *((f"{field}_min", f"{field}_max") for field in PHYSICAL_RANGES),
        ):
            minimum, maximum = getattr(self, lower), getattr(self, upper)
            if minimum is not None and maximum is not None and minimum > maximum:
                raise ValueError(f"{lower} must be <= {upper}")
        return self


class PlanetQuery(Filters):
    page: int = Field(default=1, ge=1, le=1_000_000)
    page_size: int = Field(default=50, ge=1, le=100)
    sort: Literal["name", "year", "radius", "distance"] = "name"
    order: Literal["asc", "desc"] = "asc"


class System(BaseModel):
    id: UUID
    hostname: str
    ra_deg: float | None
    dec_deg: float | None
    distance_pc: float | None


class Planet(BaseModel):
    id: UUID
    name: str
    system_id: UUID | None
    hostname: str | None
    distance_pc: float | None
    discovery_year: int | None
    discovery_method: str | None
    radius_earth: float | None
    orbital_period_days: float | None
    semi_major_axis_au: float | None
    temperature_k: float | None = None
    density_g_cm3: float | None = None
    star_temperature_k: float | None = None


class PlanetPage(BaseModel):
    items: list[Planet]
    total: int
    page: int
    page_size: int


class SystemDetail(System):
    planets: list[Planet]


class SystemPoint(BaseModel):
    id: UUID
    ra_deg: float
    dec_deg: float
    distance_pc: float
    planet_count: int


class YearCount(BaseModel):
    year: int | None
    count: int


class MethodCount(BaseModel):
    method: str | None
    count: int


class Stats(BaseModel):
    total: int
    by_year: list[YearCount]
    by_method: list[MethodCount]


class CatalogState(BaseModel):
    imported_at: datetime | None
    planet_count: int
