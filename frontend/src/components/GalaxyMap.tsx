import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useApi } from '../api/useApi'
import type { Ranking, SystemPlanet } from '../api/types'
import { cleanPoints } from '../galaxy/validate'
import { useSystemDetail } from '../galaxy/useSystemDetail'
import { planetLooks, starColor } from '../galaxy/look'
import { GalaxyScene } from './GalaxyScene'
import { SystemScene } from './SystemScene'
import { RankDetails } from './RankingTable'

const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 3 })
const value = (v: number | null, unit: string) => (v == null ? '—' : number.format(v) + ' ' + unit)

function PlanetInfo({ planet }: { planet: SystemPlanet }) {
  return (
    <div className="rank-details">
      <dl>
        <dt>Радиус</dt><dd>{value(planet.radius_earth, 'R⊕')}</dd>
        <dt>Орбитальный период</dt><dd>{value(planet.orbital_period_days, 'сут.')}</dd>
        <dt>Большая полуось</dt><dd>{value(planet.semi_major_axis_au, 'а.е.')}</dd>
        <dt>Равновесная температура</dt><dd>{value(planet.temperature_k, 'K')}</dd>
        <dt>Плотность</dt><dd>{value(planet.density_g_cm3, 'г/см³')}</dd>
        <dt>Температура звезды</dt><dd>{value(planet.star_temperature_k, 'K')}</dd>
        <dt>Открыта</dt><dd>{planet.discovery_year ?? '—'}{planet.discovery_method && ` · ${planet.discovery_method}`}</dd>
        <dt>Расстояние</dt><dd>{value(planet.distance_pc, 'пк')}</dd>
      </dl>
      {planet.semi_major_axis_au == null && <p className="muted">Большая полуось неизвестна: орбита на схеме условная.</p>}
    </div>
  )
}

export function GalaxyMap({ ranking }: { ranking: Ranking | null }) {
  const systems = useApi(api.systems)
  const { points, dropped } = useMemo(() => cleanPoints(systems.data ?? []), [systems.data])
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points])

  const [systemId, setSystemId] = useState<string | null>(null)
  const [planetId, setPlanetId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const tip = useRef<HTMLDivElement>(null)

  const detail = useSystemDetail(systemId)
  const checked = detail?.checked
  const looks = useMemo(() => (checked ? planetLooks(checked.planets) : []), [checked])
  const star = useMemo(() => (checked ? starColor(checked.planets) : '#fff1a8'), [checked])
  const planet = checked?.planets.find((p) => p.id === planetId) ?? null
  // Рейтинг привязываем только при совпадении и имени планеты, и звезды системы
  const ranked = planet && checked
    ? ranking?.items.find((r) => r.name === planet.name && r.hostname === checked.system.hostname)
    : undefined
  const hovered = hoverId ? byId.get(hoverId) : undefined

  const openSystem = (id: string) => { setSystemId(id); setPlanetId(null); setHoverId(null) }
  const back = () => { setSystemId(null); setPlanetId(null) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (planetId) setPlanetId(null)
      else if (systemId) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [planetId, systemId])

  const onHover = (id: string | null, x: number, y: number) => {
    if (tip.current) tip.current.style.transform = `translate(${x + 14}px, ${y + 14}px)`
    setHoverId((prev) => (prev === id ? prev : id))
  }

  return (
    <section className="galaxy" aria-labelledby="galaxy-title">
      <header className="scene-heading">
        <h2 id="galaxy-title">{systemId ? (checked?.system.hostname ?? 'Система…') : 'Карта планетных систем'}</h2>
        <p>{systemId
          ? checked && `${checked.planets.length} планет · ${value(checked.system.distance_pc, 'пк')} от Солнца. Размеры и движение на схеме условные.`
          : 'Каждая точка — система из каталога. Чем больше в ней планет, тем теплее цвет. Положение условное: расстояние от центра отражает расстояние от Солнца.'}
        </p>
      </header>

      {systemId === null && (
        <div className="galaxy-canvas">
          {points.length > 0 && <GalaxyScene points={points} selectedId={null} onSelect={openSystem} onHover={onHover} />}
          <div className="galaxy-tip" ref={tip} hidden={!hovered}>
            {hovered && `${hovered.hostname ?? 'Система'} · ${hovered.planet_count} пл. · ${value(hovered.distance_pc, 'пк')}`}
          </div>
          {points.length > 0 && <p className="galaxy-hint">Нажмите на точку, чтобы увидеть планеты системы.</p>}
        </div>
      )}

      {systemId !== null && (
        <div className="galaxy-canvas">
          {checked && <SystemScene looks={looks} star={star} selectedId={planetId} onSelect={setPlanetId} />}
          <button className="galaxy-back" onClick={back}>← К карте систем</button>
          {checked && (
            <div className="planet-picker" aria-label="Выбрать планету">
              {looks.map(({ planet: p, color }) => (
                <button key={p.id} aria-pressed={planetId === p.id} onClick={() => setPlanetId(p.id)}>
                  <span className="planet-dot" style={{ background: color }} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {checked && checked.rejected.length > 0 && (
            <p className="galaxy-warning" role="alert">
              Не показано планет: {checked.rejected.length}. Данные не прошли проверку: {checked.rejected.map((r) => `${r.name} — ${r.reason}`).join('; ')}.
            </p>
          )}
          {!detail && <p className="scene-status" role="status">Загрузка системы…</p>}
          {detail?.error && <p className="scene-status" role="alert">Не удалось загрузить систему. {detail.error}</p>}
          {planet && (
            <div className="popup" role="dialog" aria-label={planet.name}>
              <h2>{planet.name}</h2>
              {ranked && <RankDetails planet={ranked} />}
              {!ranked && <PlanetInfo planet={planet} />}
              <button onClick={() => setPlanetId(null)}>Закрыть</button>
            </div>
          )}
        </div>
      )}

      {systemId === null && !systems.data && !systems.error && <p className="scene-status" role="status">Загрузка карты…</p>}
      {systems.data && !points.length && <p className="scene-status" role="status">В каталоге пока нет систем с координатами.</p>}
      {systems.error && <p className="scene-status" role="alert">Не удалось загрузить системы. {systems.error}</p>}
      {systemId === null && points.length > 0 && dropped > 0 && <p className="galaxy-warning" role="status">Пропущено систем с некорректными данными: {dropped}.</p>}
    </section>
  )
}
