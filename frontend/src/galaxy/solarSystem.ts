import type { SystemDetail } from '../api/types'
import { checkSystem } from './validate'

export const SOLAR_ID = 'solar-system'
export const SOLAR_NAME = 'Солнечная система'

// NASA NSSDC Planetary Fact Sheets: radius relative to Earth, AU, days, g/cm³.
const planets = [
  ['mercury', 'Меркурий', 0.383, 0.387, 88, 5.429],
  ['venus', 'Венера', 0.949, 0.723, 224.7, 5.243],
  ['earth', 'Земля', 1, 1, 365.2, 5.514],
  ['mars', 'Марс', 0.532, 1.524, 687, 3.934],
  ['jupiter', 'Юпитер', 11.21, 5.204, 4331, 1.326],
  ['saturn', 'Сатурн', 9.45, 9.573, 10747, 0.687],
  ['uranus', 'Уран', 4.01, 19.165, 30589, 1.27],
  ['neptune', 'Нептун', 3.88, 30.178, 59800, 1.638],
] as const

const detail: SystemDetail = {
  id: SOLAR_ID,
  hostname: SOLAR_NAME,
  ra_deg: null,
  dec_deg: null,
  distance_pc: 0,
  planets: planets.map(([id, name, radius, axis, period, density]) => ({
    id,
    name,
    system_id: SOLAR_ID,
    hostname: SOLAR_NAME,
    radius_earth: radius,
    semi_major_axis_au: axis,
    orbital_period_days: period,
    density_g_cm3: density,
    temperature_k: null,
    star_temperature_k: null,
    discovery_year: null,
    discovery_method: null,
    distance_pc: null,
  })),
}

export const solarSystem = checkSystem(detail, SOLAR_ID)
export const solarColors: Record<string, string> = {
  mercury: '#aaa39a', venus: '#f0c587', earth: '#5c9bdf', mars: '#dc7954',
  jupiter: '#d9a783', saturn: '#e5c291', uranus: '#8bd7da', neptune: '#647fe7',
}
