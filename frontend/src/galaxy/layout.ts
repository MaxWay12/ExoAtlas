import type { SystemPoint } from '../api/types'

// Условная раскладка «галактики». Из данных берутся расстояние (радиус, лог-шкала),
// склонение (высота над диском) и немного прямое восхождение. Рукав и разброс
// внутри рукава считаются из id системы, поэтому положение всегда одно и то же.

export const ARMS = 3
export const R_IN = 1.4
export const R_OUT = 11
export const TWIST = 3.6 // закрутка рукавов, рад
const D0 = 50 // пк: масштаб логарифма

export function hash01(text: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export function layoutSystems(points: SystemPoint[]): Float32Array {
  const maxPc = points.reduce((m, p) => Math.max(m, p.distance_pc), 1)
  const out = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    const rn = Math.log1p(p.distance_pc / D0) / Math.log1p(maxPc / D0) // 0..1
    const r = R_IN + rn * (R_OUT - R_IN)
    const arm = Math.floor(hash01(p.id) * ARMS)
    const spread = 0.28 + 0.5 * rn // рукав шире к краю
    const jitter = (hash01(p.id, 1) + hash01(p.id, 2) - 1) * spread
    const theta = (arm * Math.PI * 2) / ARMS + TWIST * rn + jitter + (p.ra_deg / 360 - 0.5) * 0.12
    out[i * 3] = r * Math.cos(theta)
    out[i * 3 + 1] = r * Math.sin(theta)
    out[i * 3 + 2] = (p.dec_deg / 90) * 0.5 * (1 - 0.5 * rn) + (hash01(p.id, 3) - 0.5) * 0.12
  })
  return out
}

/** Декоративная «пыль» вдоль рукавов: не данные, только фон. Детерминирована. */
export function dustLayout(count: number): { positions: Float32Array; colors: Float32Array } {
  let seed = 12345
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(Math.PI * 2 * rand())
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const rn = Math.pow(rand(), 0.8) * 1.05
    const r = R_IN + rn * (R_OUT - R_IN)
    const theta = ((i % ARMS) * Math.PI * 2) / ARMS + TWIST * rn + gauss() * (0.3 + 0.45 * rn)
    positions[i * 3] = r * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(theta)
    positions[i * 3 + 2] = gauss() * 0.16 * (1 - 0.6 * Math.min(rn, 1))
    const warm = Math.max(0, 1 - rn * 2.2) // ближе к центру теплее
    colors[i * 3] = 0.45 + 0.5 * warm
    colors[i * 3 + 1] = 0.55 + 0.3 * warm
    colors[i * 3 + 2] = 1 - 0.45 * warm
  }
  return { positions, colors }
}
