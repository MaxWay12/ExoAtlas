import type { SystemDetail, SystemPlanet, SystemPoint } from '../api/types'

// Проверки на границе с API: сюда попадают сырые данные, дальше в UI идёт только проверенное.

export interface CheckedSystem {
  system: SystemDetail
  planets: SystemPlanet[]
  rejected: { name: string; reason: string }[] // планеты, не прошедшие проверку
}

/** Планета принадлежит системе, только если её system_id равен id системы. Имена не сравниваем. */
export function checkSystem(detail: SystemDetail, requestedId: string): CheckedSystem {
  if (detail.id !== requestedId) {
    throw new Error('Сервер вернул другую систему, чем была запрошена')
  }
  const seen = new Set<string>()
  const planets: SystemPlanet[] = []
  const rejected: CheckedSystem['rejected'] = []
  for (const planet of detail.planets) {
    if (planet.system_id !== detail.id) rejected.push({ name: planet.name, reason: 'принадлежит другой системе' })
    else if (planet.hostname != null && planet.hostname !== detail.hostname) rejected.push({ name: planet.name, reason: 'звезда не совпадает с системой' })
    else if (seen.has(planet.id)) rejected.push({ name: planet.name, reason: 'повтор в списке' })
    else { seen.add(planet.id); planets.push(planet) }
  }
  return { system: detail, planets, rejected }
}

/** Выбрасывает точки без id, с неконечными координатами и повторы id. */
export function cleanPoints(items: SystemPoint[]): { points: SystemPoint[]; dropped: number } {
  const seen = new Set<string>()
  const points = items.filter((p) => {
    const ok = !!p.id && !seen.has(p.id) &&
      [p.ra_deg, p.dec_deg, p.distance_pc].every(Number.isFinite) && p.distance_pc > 0
    if (ok) seen.add(p.id)
    return ok
  })
  return { points, dropped: items.length - points.length }
}
