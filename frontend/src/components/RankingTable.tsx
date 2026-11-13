import type { RankedPlanet, Ranking } from '../api/types'

const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 3 })
const score = new Intl.NumberFormat('ru', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const value = (numberValue: number | null, unit: string) =>
  numberValue == null ? '—' : number.format(numberValue) + ' ' + unit

export function RankDetails({ planet }: { planet: RankedPlanet }) {
  return (
    <div className="rank-details">
      <p><strong>Место {planet.rank} · {score.format(planet.score)} балла</strong></p>
      <p>{planet.category}. Полнота данных — {planet.quality.toLowerCase()}.</p>
      <dl>
        <dt>Звезда</dt><dd>{planet.hostname ?? '—'}</dd>
        <dt>Радиус</dt><dd>{value(planet.radius_earth, 'R⊕')}</dd>
        <dt>Масса</dt><dd>{value(planet.mass_earth, 'M⊕')} · {planet.mass_source}{planet.mass_provenance && ' / ' + planet.mass_provenance}</dd>
        <dt>Равновесная температура</dt><dd>{value(planet.temperature_k, 'K')}</dd>
        <dt>Поток излучения</dt><dd>{value(planet.insolation, 'S⊕')}</dd>
        <dt>Большая полуось</dt><dd>{value(planet.semi_major_axis_au, 'а.е.')}</dd>
        <dt>Расстояние</dt><dd>{value(planet.distance_pc, 'пк')}</dd>
      </dl>
      <p>Пригодность для человека. {planet.human_habitability}</p>
      <details><summary>Недостающие данные</summary><p>{planet.missing_data}</p></details>
    </div>
  )
}

export function RankingTable({ ranking, error }: { ranking: Ranking | null; error: string | null }) {
  return (
    <section aria-labelledby="ranking-title">
      <h2 id="ranking-title">Топ-50 по индексу жизнепригодности</h2>
      <p className="muted">Индекс команды учитывает радиус, поток излучения, температуру и бонусы за обитаемую зону и параметры системы.</p>
      {error ? <p role="alert">Рейтинг недоступен. {error}</p> : !ranking ? <p role="status">Загрузка рейтинга…</p> : (
        <>
          <p className="muted">{ranking.calculated_at
            ? 'Последний пересчёт · ' + new Date(ranking.calculated_at).toLocaleString('ru', { timeZone: 'Europe/Moscow' }) + ' МСК'
            : 'Исходная таблица команды'}</p>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Место</th><th>Планета</th><th>Индекс</th><th>Обитаемая зона</th><th>Полнота данных</th></tr></thead>
              <tbody>{ranking.items.map((planet) => (
                <tr key={planet.name}>
                  <td>{planet.rank}</td>
                  <td><details><summary>{planet.name}</summary><RankDetails planet={planet} /></details></td>
                  <td>{score.format(planet.score)}</td><td>{planet.zone}</td><td>{planet.quality}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
