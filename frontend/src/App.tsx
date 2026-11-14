import { useEffect, useMemo, useState } from 'react'
import { api, scenePlanets } from './api/client'
import { useApi } from './api/useApi'
import { Sidebar } from './components/Sidebar'
import { Scene } from './components/Scene'
import { Catalog } from './components/Catalog'
import { RankingTable, RankDetails } from './components/RankingTable'
import { DashboardCharts } from './components/DashboardCharts'

function currentPage() {
  const hash = location.hash.slice(1)
  return hash === 'top' || hash === 'catalog' ? hash : 'home'
}

export default function App() {
  const project = useApi(api.project)
  const ranking = useApi(api.ranking)
  const planets = useMemo(() => scenePlanets(ranking.data), [ranking.data])
  const [page, setPage] = useState(currentPage)
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const current = planets.find((planet) => planet.id === selected)
  const ranked = ranking.data?.items.find((planet) => planet.name === current?.name)

  function close() {
    setSelected(null)
    setOpen(false)
  }

  function select(id: string) {
    if (selected === id) return
    setSelected(id)
    setOpen(false)
  }

  useEffect(() => {
    const navigate = () => { setPage(currentPage()); close() }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="layout">
      <Sidebar project={project.data} active={page} />
      <main className={page === 'home' ? 'stage home' : 'stage data-page'}>
        {page === 'catalog' ? <Catalog /> : page === 'top' ? (
          <RankingTable ranking={ranking.data} error={ranking.error} />
        ) : (
          <>
            <section className="scene-panel" aria-labelledby="scene-title">
              <header className="scene-heading">
                <h2 id="scene-title">Топ-5 по индексу жизнепригодности</h2>
                <p>Планеты из разных систем. Размеры и движение на схеме условные.</p>
              </header>
              {planets.length > 0 && (
                <>
                  <div className="scene">
                    <Scene planets={planets} selectedId={selected} onSelect={select} onArrive={() => setOpen(true)} />
                  </div>
                  <div className="planet-picker" aria-label="Выбрать планету">
                    {planets.map((planet, i) => (
                      <button key={planet.id} aria-pressed={selected === planet.id} onClick={() => select(planet.id)}>
                        <span className="planet-dot" style={{ background: planet.color }} />
                        {i + 1}. {planet.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!planets.length && <p className="scene-status" role="status">
                {ranking.error ? 'Не удалось загрузить рейтинг. ' + ranking.error : 'Загрузка рейтинга…'}
              </p>}
              {open && current && (
                <div className="popup" role="dialog" aria-label={current.name}>
                  <h2>{current.name}</h2>
                  {ranked ? <RankDetails planet={ranked} /> : <p>{current.description}</p>}
                  <button onClick={close}>Закрыть</button>
                </div>
              )}
            </section>
            <DashboardCharts ranking={ranking.data} rankingError={ranking.error} />
          </>
        )}
      </main>
    </div>
  )
}
