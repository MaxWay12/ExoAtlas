import type { CatalogPage, CatalogPlanet, Planet, ProjectInfo, Ranking } from './types'
import { mockPlanets, mockProject } from './mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const COLORS = ['#6ec1ff', '#c08bff', '#ff8c69', '#5fd4a0', '#ff7eb6']
const project: ProjectInfo = { name: 'ExoAtlas', team: { name: '', members: [] } }

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api' + path, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export function scenePlanets(ranking: Ranking | null): Planet[] {
  if (USE_MOCK) return mockPlanets
  const top = ranking?.items.slice(0, 5) ?? []
  return top.map((planet, index) => ({
    id: planet.name,
    name: planet.name,
    color: COLORS[index],
    size: Math.min(0.6, Math.max(0.2, (planet.radius_earth ?? 1) * 0.35)),
    angle: 360 * index / top.length,
  }))
}

export const api = {
  project: async () => USE_MOCK ? mockProject : project,
  ranking: () => get<Ranking>('/ranking'),
  catalog: (query: URLSearchParams, signal: AbortSignal) => get<CatalogPage>(`/planets?${query}`, signal),
  planet: (id: string, signal: AbortSignal) => get<CatalogPlanet>(`/planets/${encodeURIComponent(id)}`, signal),
}
