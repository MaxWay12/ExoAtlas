import { useState } from 'react'
import type { RankedPlanet, Ranking } from '../api/types'
import { physicalFields, PlanetFilters } from './PlanetFilters'
import type { PhysicalFilters } from './PlanetFilters'
import { nextSort, SortHeader, type TableSort } from './SortHeader'

const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 3 })
const score = new Intl.NumberFormat('ru', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const value = (numberValue: number | null, unit: string) =>
  numberValue == null ? '—' : number.format(numberValue) + ' ' + unit
const time = (date: string) => new Date(date).toLocaleString('ru', { timeZone: 'Europe/Moscow' }) + ' МСК'
const factors = [['hz_score', 'Обитаемая зона'], ['radius_score', 'Радиус'], ['density_score', 'Плотность']] as const
const columns = [
  ['rank', 'Место'], ['name', 'Планета'], ['discovery_year', 'Год'],
  ['score', 'Индекс'], ['zone', 'Обитаемая зона'], ['data_coverage_pct', 'Полнота данных'],
] as const
type SortKey = typeof columns[number][0]
const alphabetical = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })

function comparePlanets(a: RankedPlanet, b: RankedPlanet, { key, order }: TableSort<SortKey>) {
  const first = a[key]
  const second = b[key]
  if (first == null) return second == null ? a.rank - b.rank : 1
  if (second == null) return -1
  const difference = typeof first === 'number' && typeof second === 'number'
    ? first - second : alphabetical.compare(String(first), String(second))
  return (order === 'asc' ? difference : -difference) || a.rank - b.rank
}

function range(inner: number | null, outer: number | null, unit: string) {
  return inner == null || outer == null ? '—' : `${number.format(inner)}–${value(outer, unit)}`
}

function ScoreExplanation({ planet }: { planet: RankedPlanet }) {
  const breakdown = planet.score_breakdown
  const zone = planet.habitable_zone
  if (!breakdown) return null
  const formula = factors.map(([key, label]) => `${label} × ${number.format(breakdown[key].weight / 100)}`).join(' + ')
  return (
    <details className="score-explanation">
      <summary>Как рассчитан балл?</summary>
      <p>{formula}. Баллы факторов от 0 до 100.</p>
      <dl>
        {factors.map(([key, label]) => {
          const factor = breakdown[key]
          return <div className="score-factor" key={key}>
            <dt>{label} ({factor.weight}%)</dt>
            <dd>{factor.score == null ? 'Нет данных → 0 баллов'
              : `${score.format(factor.score)} × ${number.format(factor.weight / 100)} = ${score.format(factor.contribution)}`}</dd>
          </div>
        })}
        <dt><strong>Итого</strong></dt><dd><strong>{score.format(planet.score)} из 100</strong></dd>
      </dl>
      <p>Полнота — сумма весов факторов, для которых рассчитан балл. Высокая: от 80%, средняя: от 55%, низкая: ниже 55%. Вес пропущенного фактора не перераспределяется. Вклады показаны с округлением.</p>
      {zone && <>
        <p>Границы обитаемой зоны рассчитаны по модели Коппарапу. <a href="https://arxiv.org/abs/1404.5292">Коппарапу и соавт., 2014</a></p>
        <dl>
          <dt>Консервативные границы</dt><dd>{range(zone.hz_inner_au, zone.hz_outer_au, 'а.е.')}</dd>
          <dt>Оптимистические границы</dt><dd>{range(zone.optimistic_hz_inner_au, zone.optimistic_hz_outer_au, 'а.е.')}</dd>
          <dt>Орбита от перицентра до апоцентра</dt><dd>{range(zone.orbit_periastron_au, zone.orbit_apastron_au, 'а.е.')}</dd>
          <dt>Консервативный диапазон потока</dt><dd>{range(zone.hz_outer_flux, zone.hz_inner_flux, 'S⊕')}</dd>
          <dt>Оптимистический диапазон потока</dt><dd>{range(zone.optimistic_hz_outer_flux, zone.optimistic_hz_inner_flux, 'S⊕')}</dd>
        </dl>
      </>}
    </details>
  )
}

export function RankDetails({ planet }: { planet: RankedPlanet }) {
  return (
    <div className="rank-details">
      <p><strong>Место {planet.rank} · {score.format(planet.score)} балла</strong></p>
      <p>{planet.category}. {planet.quality}{planet.data_coverage_pct != null && ` (${number.format(planet.data_coverage_pct)}%)`}.</p>
      <dl>
        <dt>Консервативная зона</dt><dd>{planet.zone}</dd>
        {planet.optimistic_zone && <><dt>Оптимистическая зона</dt><dd>{planet.optimistic_zone}</dd></>}
        {planet.earth_similarity_percent != null && <><dt>Сходство с Землёй</dt><dd>{number.format(planet.earth_similarity_percent)}%</dd></>}
        <dt>Звезда</dt><dd>{planet.hostname ?? '—'}</dd>
        <dt>Радиус</dt><dd>{value(planet.radius_earth, 'R⊕')}{planet.radius_source && <> · {planet.radius_source}</>}</dd>
        <dt>Масса</dt><dd>{value(planet.mass_earth, 'M⊕')} · {planet.mass_source}{planet.mass_provenance && ' / ' + (planet.mass_provenance === 'Msini' ? 'минимальная масса (m sin i)' : planet.mass_provenance)}</dd>
        <dt>Равновесная температура</dt><dd>{value(planet.temperature_k, 'K')}{planet.temperature_k != null && ' · NASA'}</dd>
        <dt>Плотность для рейтинга</dt><dd>{value(planet.density_g_cm3, 'г/см³')}{planet.density_source && <> · {planet.density_source}</>}</dd>
        <dt>Температура звезды</dt><dd>{value(planet.star_temperature_k, 'K')}</dd>
        <dt>Поток излучения</dt><dd>{value(planet.insolation, 'S⊕')}{planet.insolation_source && <> · {planet.insolation_source}</>}</dd>
        <dt>Большая полуось</dt><dd>{value(planet.semi_major_axis_au, 'а.е.')}</dd>
        <dt>Расстояние</dt><dd>{value(planet.distance_pc, 'пк')}</dd>
      </dl>
      <ScoreExplanation planet={planet} />
      <p>Пригодность для человека. {planet.human_habitability}</p>
      <details><summary>Недостающие данные</summary><p>{planet.missing_data}</p></details>
    </div>
  )
}

export function RankingTable({ ranking, error }: { ranking: Ranking | null; error: string | null }) {
  const [filters, setFilters] = useState<PhysicalFilters>({})
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<TableSort<SortKey>>({ key: 'rank', order: 'asc' })
  const items = ranking?.items.filter((planet) => (
    (!query || [planet.name, planet.hostname].some((name) => name?.toLowerCase().includes(query))) &&
    physicalFields.every(({ key, property }) => {
      const min = filters[`${key}_min`]
      const max = filters[`${key}_max`]
      const value = planet[property]
      return (min === undefined || (value != null && value >= min)) &&
        (max === undefined || (value != null && value <= max))
    })
  )).sort((a, b) => comparePlanets(a, b, sort)) ?? []
  return (
    <section aria-labelledby="ranking-title">
      <h2 id="ranking-title">Топ-50 по индексу жизнепригодности</h2>
      <p className="muted">В рейтинге до 50 кандидатов. Обитаемая зона даёт 50% веса, радиус — 35%, плотность — 15%. Пропуски снижают итоговый балл.</p>
      <PlanetFilters onApply={(ranges, search) => { setFilters(ranges); setQuery(search.toLowerCase()) }} />
      {error ? <p role="alert">Рейтинг недоступен. {error}</p> : !ranking ? <p role="status">Загрузка рейтинга…</p> : (
        <>
          <p className="muted">{ranking.calculated_at
            ? 'Последний пересчёт · ' + time(ranking.calculated_at)
            : 'Резервный снимок рейтинга'}</p>
          <p className="muted">Последняя успешная загрузка NASA · {ranking.nasa_downloaded_at ? time(ranking.nasa_downloaded_at) : 'время загрузки не записано'}. Обновление в 00:00 и 12:00 МСК. Источник: <a href="https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html">NASA Exoplanet Archive TAP (PSCompPars)</a>.</p>
          <p role="status">{items.length ? `Найдено планет: ${items.length} из ${ranking.items.length}` : 'Планеты не найдены.'}</p>
          {!!items.length && <div className="table-scroll">
            <table>
              <thead><tr>{columns.map(([key, label]) => (
                <SortHeader key={key} label={label} order={sort.key === key ? sort.order : undefined}
                  onSort={() => setSort((previous) => nextSort(previous, key))} />
              ))}</tr></thead>
              <tbody>{items.map((planet) => (
                <tr key={planet.name}>
                  <td><span className={planet.rank === 1 ? 'rank-number rank-first' : planet.rank <= 5 ? 'rank-number rank-leader' : 'rank-number'}>{planet.rank}</span></td>
                  <td><details><summary>{planet.name}</summary><RankDetails planet={planet} /></details></td>
                  <td>{planet.discovery_year ?? '—'}</td>
                  <td>{score.format(planet.score)}</td><td>{planet.zone}</td><td>{planet.quality}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
        </>
      )}
    </section>
  )
}
