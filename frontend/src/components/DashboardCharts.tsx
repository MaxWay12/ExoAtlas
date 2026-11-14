import type { RankedPlanet, Ranking } from '../api/types'
import { Chart } from './Chart'

const format = new Intl.NumberFormat('ru')

function distribution(items: RankedPlanet[], property: 'radius_earth' | 'temperature_k', bounds: number[]) {
  const points = bounds.map((bound, index) => ({
    label: index === 0 ? `<${format.format(bound)}` : `${format.format(bounds[index - 1])}–${format.format(bound)}`,
    value: 0,
  }))
  points.push({ label: `≥${format.format(bounds[bounds.length - 1])}`, value: 0 })
  let unknown = 0
  for (const planet of items) {
    const value = planet[property]
    if (value == null) {
      unknown += 1
    } else {
      const index = bounds.findIndex((bound) => value < bound)
      points[index === -1 ? bounds.length : index].value += 1
    }
  }
  return { points: items.length > unknown ? points : [], unknown }
}

export function DashboardCharts({ ranking, rankingError }: { ranking: Ranking | null; rankingError: string | null }) {
  return (
    <div className="dashboard-charts">
      <Chart title="Радиус планет рейтинга (R⊕)" kind="bar" error={rankingError}
        data={ranking ? distribution(ranking.items, 'radius_earth', [1, 1.5, 2, 2.5]) : null} />
      <Chart title="Равновесная температура планет рейтинга (К)" kind="line" error={rankingError}
        data={ranking ? distribution(ranking.items, 'temperature_k', [150, 250, 350, 500]) : null} />
    </div>
  )
}
