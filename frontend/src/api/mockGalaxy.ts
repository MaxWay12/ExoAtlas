import type { SystemDetail, SystemPlanet, SystemPoint } from './types'

// Заглушка для VITE_USE_MOCK=true. Формат тот же, что у бэкенда, id — строки.

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rows = (() => {
  const r = rng(7)
  return Array.from({ length: 800 }, (_, i) => ({
    id: `mock-system-${i + 1}`,
    hostname: `Mock ${i + 1}`,
    ra_deg: r() * 360,
    dec_deg: (r() - 0.5) * 120,
    distance_pc: Math.round(10 * Math.exp(r() * 5.5)),
    planet_count: 1 + Math.floor(r() * r() * 6),
  }))
})()

export const mockSystemPoints: SystemPoint[] = rows.map(({ hostname: _h, ...point }) => point)

export function mockSystemDetail(id: string): SystemDetail | null {
  const row = rows.find((x) => x.id === id)
  if (!row) return null
  const r = rng(row.planet_count * 1000 + Number(id.split('-').pop()))
  const planets: SystemPlanet[] = Array.from({ length: row.planet_count }, (_, k) => {
    const a = +(0.05 * Math.pow(1.9, k) * (0.6 + r() * 0.8)).toFixed(3)
    return {
      id: `${id}-planet-${k + 1}`,
      system_id: id,
      name: `${row.hostname} ${'bcdefgh'[k]}`,
      hostname: row.hostname,
      distance_pc: row.distance_pc,
      discovery_year: 2000 + Math.floor(r() * 25),
      discovery_method: r() > 0.5 ? 'Transit' : 'Radial Velocity',
      radius_earth: r() > 0.15 ? +(0.5 + r() * 11).toFixed(2) : null,
      orbital_period_days: +(365 * Math.sqrt(a ** 3)).toFixed(2),
      semi_major_axis_au: r() > 0.1 ? a : null,
      temperature_k: r() > 0.3 ? Math.round(150 + r() * 900) : null,
      density_g_cm3: r() > 0.5 ? +(1 + r() * 6).toFixed(2) : null,
      star_temperature_k: 3000 + Math.round(r() * 3000),
    }
  })
  return { id, hostname: row.hostname, ra_deg: row.ra_deg, dec_deg: row.dec_deg, distance_pc: row.distance_pc, planets }
}
