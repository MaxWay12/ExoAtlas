import type { SystemPlanet } from '../api/types'

// Внешний вид планет и звезды для схемы системы. Всё условное, кроме порядка орбит.

export function starColor(planets: SystemPlanet[]): string {
  const t = planets.find((p) => p.star_temperature_k != null)?.star_temperature_k
  if (t == null) return '#fff1a8'
  return t < 3700 ? '#ff9f7a' : t < 5200 ? '#ffc27a' : t < 6000 ? '#fff1a8' : '#f4f7ff'
}

export function planetColor(p: SystemPlanet): string {
  const t = p.temperature_k
  if (t == null) return '#b9a8ff'
  return t < 250 ? '#6ec1ff' : t < 350 ? '#5fd4a0' : t < 700 ? '#ffc27a' : '#ff7a5a'
}

export interface PlanetLook {
  planet: SystemPlanet
  orbit: number // радиус орбиты на схеме
  orbitKnown: boolean // false — большая полуось неизвестна, орбита условная
  size: number
  color: string
  start: number // стартовый угол, рад
  speed: number // условная угловая скорость
}

export function planetLooks(planets: SystemPlanet[]): PlanetLook[] {
  const axes = planets.map((p) => p.semi_major_axis_au).filter((a): a is number => a != null && a > 0)
  const maxA = Math.max(...axes, 0.01)
  let unknown = 0
  return planets.map((planet, i) => {
    const a = planet.semi_major_axis_au
    const known = a != null && a > 0
    const orbit = known ? 1.8 + 4.2 * Math.sqrt(a / maxA) : 6.6 + 0.6 * unknown++
    const r = planet.radius_earth
    return {
      planet,
      orbit,
      orbitKnown: known,
      size: r == null ? 0.16 : Math.min(0.42, Math.max(0.14, 0.12 + 0.07 * Math.sqrt(r))),
      color: planetColor(planet),
      start: i * 2.4,
      speed: 0.5 / Math.pow(orbit, 1.5),
    }
  })
}
