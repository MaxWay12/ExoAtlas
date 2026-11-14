import type { ChartPoint } from '../api/types'

export function Chart({ title, points, error }: { title: string; points: ChartPoint[] | null; error: string | null }) {
  const total = points?.reduce((sum, point) => sum + point.value, 0) || 1
  return (
    <section className="chart" aria-label={title}>
      <h2>{title}</h2>
      {error ? <p role="alert">Статистика недоступна. {error}</p>
        : !points ? <p role="status">Загрузка…</p>
          : !points.length ? <p>Нет данных.</p> : (
            <ul className="chart-bars">{points.map(({ label, value }) => (
              <li key={label}>
                <div><span>{label}</span><strong aria-label={`${value} планет`}>{value}</strong></div>
                <div className="chart-track" aria-hidden="true"><span style={{ width: `${value / total * 100}%` }} /></div>
              </li>
            ))}</ul>
          )}
    </section>
  )
}
