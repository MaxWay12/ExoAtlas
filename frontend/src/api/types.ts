// ===== КОНТРАКТ С БЭКЕНДОМ =====
// Бэкендер: достаточно отдавать JSON в этих формах. Подробности — в README.md

export interface ProjectInfo {
  name: string
  team: {
    name: string
    members: string[] // ФИО участников
  }
}

export interface Planet {
  id: string
  name: string
  color: string // CSS-цвет, например "#6ec1ff"
  size: number // радиус, ~0.2–0.6
  angle: number // стартовая позиция на орбите, градусы 0–360
  description?: string // текст для окошка при клике на планету
}

export interface ChartPoint {
  label: string
  value: number
}

export interface RankedPlanet {
  rank: number
  name: string
  hostname: string | null
  score: number
  zone: string
  optimistic_zone?: string
  data_coverage_pct?: number | null
  earth_similarity_percent?: number | null
  radius_source?: string
  density_source?: string
  insolation_source?: string
  score_breakdown?: Record<'hz_score' | 'radius_score' | 'density_score', {
    weight: number
    score: number | null
    contribution: number
  }>
  habitable_zone?: {
    hz_inner_au: number | null
    hz_outer_au: number | null
    optimistic_hz_inner_au: number | null
    optimistic_hz_outer_au: number | null
    hz_inner_flux: number | null
    hz_outer_flux: number | null
    optimistic_hz_inner_flux: number | null
    optimistic_hz_outer_flux: number | null
    orbit_periastron_au: number | null
    orbit_apastron_au: number | null
  }
  quality: string
  category: string
  radius_earth: number | null
  mass_earth: number | null
  temperature_k: number | null
  density_g_cm3: number | null
  star_temperature_k: number | null
  insolation: number | null
  distance_pc: number | null
  semi_major_axis_au: number | null
  mass_source: string
  mass_provenance: string | null
  missing_data: string
  human_habitability: string
}

export interface Ranking {
  nasa_downloaded_at?: string | null
  source: 'team_csv' | 'team_script'
  calculated_at: string | null
  items: RankedPlanet[]
}

export interface CatalogPlanet {
  id: string
  name: string
  hostname: string | null
  discovery_year: number | null
  discovery_method: string | null
  radius_earth: number | null
  distance_pc: number | null
  orbital_period_days: number | null
  semi_major_axis_au: number | null
  temperature_k: number | null
  density_g_cm3: number | null
  star_temperature_k: number | null
}

export interface CatalogPage {
  items: CatalogPlanet[]
  total: number
  page: number
  page_size: number
}

// ===== Карта систем: зеркало моделей бэкенда (backend/catalog/models.py) =====
// GET /api/systems → SystemPoint[]; GET /api/systems/{id} → SystemDetail
export interface SystemPoint {
  id: string // uuid системы — единственный ключ связи
  hostname?: string | null // сейчас бэкенд не отдаёт; если добавят, появится в подсказке
  ra_deg: number
  dec_deg: number
  distance_pc: number
  planet_count: number
}

export type SystemPlanet = CatalogPlanet & { system_id: string | null }

export interface SystemDetail {
  id: string
  hostname: string
  ra_deg: number | null
  dec_deg: number | null
  distance_pc: number | null
  planets: SystemPlanet[]
}
