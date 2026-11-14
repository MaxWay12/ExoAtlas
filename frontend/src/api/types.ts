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
