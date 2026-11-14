CREATE TABLE IF NOT EXISTS systems (
    id uuid PRIMARY KEY,
    hostname text NOT NULL UNIQUE,
    ra_deg double precision,
    dec_deg double precision,
    distance_pc double precision
);

CREATE TABLE IF NOT EXISTS planets (
    id uuid PRIMARY KEY,
    system_id uuid REFERENCES systems(id),
    name text NOT NULL UNIQUE,
    discovery_year integer,
    discovery_method text,
    radius_earth double precision,
    orbital_period_days double precision,
    semi_major_axis_au double precision
);

CREATE INDEX IF NOT EXISTS planets_system_id_idx ON planets(system_id);

ALTER TABLE planets
    ADD COLUMN IF NOT EXISTS temperature_k double precision,
    ADD COLUMN IF NOT EXISTS density_g_cm3 double precision,
    ADD COLUMN IF NOT EXISTS star_temperature_k double precision;

CREATE TABLE IF NOT EXISTS habitability_ranking (
    singleton boolean PRIMARY KEY CHECK (singleton),
    calculated_at timestamptz NOT NULL,
    items jsonb NOT NULL CHECK (jsonb_array_length(items) = 50)
);

CREATE TABLE IF NOT EXISTS catalog_state (
    singleton boolean PRIMARY KEY CHECK (singleton),
    imported_at timestamptz NOT NULL,
    planet_count integer NOT NULL CHECK (planet_count > 0)
);
