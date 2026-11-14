import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CatalogPage, CatalogPlanet } from '../api/types'
import { physicalFields, PlanetFilters } from './PlanetFilters'
import type { PhysicalFilters } from './PlanetFilters'

const pageSize = 25
const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 5 })

export function Catalog() {
  const [search, setSearch] = useState({ query: '', filters: {} as PhysicalFilters })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CatalogPage | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<CatalogPlanet | null>(null)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError('')
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (search.query) params.set('q', search.query)
    for (const [key, value] of Object.entries(search.filters)) params.set(key, String(value))
    api.catalog(params, controller.signal).then(
      (result) => { if (!controller.signal.aborted) setData(result) },
      (cause: Error) => { if (!controller.signal.aborted) setError(cause.message) },
    )
    return () => controller.abort()
  }, [search, page])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    setDetail(null)
    setDetailError('')
    api.planet(selected, controller.signal).then(
      (result) => { if (!controller.signal.aborted) setDetail(result) },
      (cause: Error) => { if (!controller.signal.aborted) setDetailError(cause.message) },
    )
    return () => controller.abort()
  }, [selected])

  return (
    <section aria-labelledby="catalog-title">
      <h2 id="catalog-title">Все экзопланеты</h2>
      <PlanetFilters onApply={(filters, query) => {
        setSearch({ query, filters })
        setPage(1)
        setSelected(null)
      }} />
      {error ? <p role="alert">Каталог недоступен. {error}</p> : !data ? <p role="status">Загрузка каталога…</p> : (
        <>
          <p role="status">{data.total ? `Найдено планет: ${number.format(data.total)}` : 'Планеты не найдены.'}</p>
          {!!data.items.length && <div className="table-scroll">
            <table>
              <thead><tr><th>Планета</th><th>Звезда</th><th>Год</th><th>Метод открытия</th><th>Радиус (R⊕)</th><th>Расстояние (пк)</th></tr></thead>
              <tbody>{data.items.map((planet) => (
                <tr key={planet.id}>
                  <td><button className="table-link" onClick={() => setSelected(planet.id)}>{planet.name}</button></td>
                  <td>{planet.hostname ?? '—'}</td><td>{planet.discovery_year ?? '—'}</td>
                  <td>{planet.discovery_method ?? '—'}</td>
                  <td>{planet.radius_earth == null ? '—' : number.format(planet.radius_earth)}</td>
                  <td>{planet.distance_pc == null ? '—' : number.format(planet.distance_pc)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
          {data.total > pageSize && <nav className="pagination" aria-label="Страницы каталога">
            <button disabled={page <= 1} onClick={() => { setSelected(null); setPage(page - 1) }}>Назад</button>
            <span>{page} / {Math.ceil(data.total / pageSize)}</span>
            <button disabled={page * pageSize >= data.total} onClick={() => { setSelected(null); setPage(page + 1) }}>Далее</button>
          </nav>}
        </>
      )}
      {selected && <div className="popup" role="dialog" aria-label={detail?.name ?? 'Планета'}>
        {detailError ? <p role="alert">{detailError}</p> : !detail || detail.id !== selected ? <p>Загрузка…</p> : (
          <>
            <h3>{detail.name}</h3>
            <p>Звезда · {detail.hostname ?? '—'}</p>
            <p>Период орбиты (дни) · {detail.orbital_period_days ?? '—'}</p>
            {physicalFields.map(({ property, label, unit }) => (
              <p key={property}>{label} ({unit}) · {detail[property] == null ? '—' : number.format(detail[property])}</p>
            ))}
          </>
        )}
        <button onClick={() => setSelected(null)}>Закрыть</button>
      </div>}
    </section>
  )
}
