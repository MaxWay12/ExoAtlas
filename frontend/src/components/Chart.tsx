import type { ChartData } from '../api/types'

// Лёгкий SVG-график без библиотек. Нужна красота — подключите recharts/chart.js.
export function Chart({ data, error }: { data: ChartData | null; error: string | null }) {
  if (error) return <section className="chart" role="alert">Статистика недоступна. {error}</section>
  if (!data) return <section className="chart">Загрузка…</section>
  if (!data.points.length) return <section className="chart"><h2>{data.title}</h2>Нет данных.</section>
  const W = 270, H = 150, pad = 14
  const max = Math.max(...data.points.map((p) => p.value), 1)
  const step = (W - pad * 2) / data.points.length
  const y = (v: number) => H - 15 - (v / max) * (H - 30)

  return (
    <section className="chart" aria-label={data.title}>
      <h2>{data.title}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={data.title}>
        <path d={`M${pad} 8V${H - 15}H${W - 6}`} fill="none" stroke="#6b7099" />
        {data.kind === 'bar'
          ? data.points.map((p, i) => (
              <rect key={p.label} x={pad + i * step + step * 0.15} y={y(p.value)} width={step * 0.7} height={H - 15 - y(p.value)} fill="#6ec1ff">
                <title>{p.label} — {p.value}</title>
              </rect>
            ))
          : (
              <polyline
                fill="none" stroke="#ffd23f" strokeWidth="2.5"
                points={data.points.map((p, i) => `${pad + i * step + step / 2},${y(p.value)}`).join(' ')}
              />
            )}
        {data.kind === 'line' && data.points.map((p, i) => (
          <circle key={p.label} cx={pad + i * step + step / 2} cy={y(p.value)} r="4" fill="transparent">
            <title>{p.label} — {p.value}</title>
          </circle>
        ))}
      </svg>
    </section>
  )
}
