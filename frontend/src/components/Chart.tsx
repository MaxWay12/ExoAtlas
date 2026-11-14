import type { ChartPoint } from '../api/types'

interface ChartProps {
  title: string
  kind: 'bar' | 'line'
  data: { points: ChartPoint[]; unknown: number } | null
  error: string | null
}

function Plot({ points, kind }: { points: ChartPoint[]; kind: ChartProps['kind'] }) {
  const left = 27, right = 248, top = 21, bottom = 112
  const max = Math.max(5, Math.ceil(Math.max(...points.map(({ value }) => value)) / 5) * 5)
  const spacing = (right - left) / points.length
  const x = (index: number) => left + (index + 0.5) * spacing
  const y = (value: number) => bottom - value / max * (bottom - top)
  const description = points.map(({ label, value }) => `${label}: ${value}`).join('; ')

  return (
    <svg viewBox="0 0 256 136" role="img" aria-label={`Количество планет по диапазонам. ${description}`}>
      {[0, max].map((tick) => (
        <g key={tick}>
          <line className="chart-gridline" x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
          <text x={left - 5} y={y(tick) + 4} textAnchor="end">{tick}</text>
        </g>
      ))}
      {kind === 'line' && (
        <polyline className="chart-line" points={points.map(({ value }, index) => `${x(index)},${y(value)}`).join(' ')} />
      )}
      {points.map(({ label, value }, index) => (
        <g key={label}>
          <title>{label}: {value}</title>
          {kind === 'bar'
            ? <rect className="chart-bar" x={x(index) - spacing / 4} y={y(value)} width={spacing / 2} height={bottom - y(value)} rx="2" />
            : <circle className="chart-dot" cx={x(index)} cy={y(value)} r="3" />}
          <text className="chart-count" x={x(index)} y={y(value) - 7} textAnchor="middle">{value}</text>
          <text x={x(index)} y={130} textAnchor="middle">{label}</text>
        </g>
      ))}
    </svg>
  )
}

export function Chart({ title, kind, data, error }: ChartProps) {
  return (
    <section className="chart" aria-label={title}>
      <h2>{title}</h2>
      {error ? <p role="alert">Статистика недоступна. {error}</p>
        : !data ? <p role="status">Загрузка…</p> : (
          <>
            {data.points.length > 0 && <Plot points={data.points} kind={kind} />}
            {data.unknown > 0 && <p className="chart-missing">Планет без данных: {data.unknown}</p>}
            {!data.points.length && !data.unknown && <p>Нет данных.</p>}
          </>
        )}
    </section>
  )
}
