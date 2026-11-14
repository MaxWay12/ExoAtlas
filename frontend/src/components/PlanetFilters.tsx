import { useState } from 'react'
import type { FormEvent } from 'react'

export const physicalFields = [
  { key: 'radius', property: 'radius_earth', label: 'Радиус', unit: 'R⊕', min: 0.5, max: 3 },
  { key: 'temperature', property: 'temperature_k', label: 'Равновесная температура', unit: 'К', min: 150, max: 500 },
  { key: 'density', property: 'density_g_cm3', label: 'Плотность', unit: 'г/см³', min: 1, max: 20 },
  { key: 'star_temperature', property: 'star_temperature_k', label: 'Температура звезды', unit: 'К', min: 3500, max: 7500 },
  { key: 'orbit', property: 'semi_major_axis_au', label: 'Большая полуось орбиты', unit: 'а.е.', min: 0.1, max: 3 },
] as const

type RangeKey = typeof physicalFields[number]['key']
type Bound = 'min' | 'max'
type FilterKey = `${RangeKey}_${Bound}`
export type PhysicalFilters = Partial<Record<FilterKey, number>>
type Draft = Partial<Record<FilterKey, string>>

const methodology: Draft = Object.fromEntries(physicalFields.flatMap(({ key, min, max }) => [
  [`${key}_min`, String(min)], [`${key}_max`, String(max)],
]))

export function PlanetFilters({ onApply }: { onApply: (filters: PhysicalFilters, query: string) => void }) {
  const [draft, setDraft] = useState<Draft>({})
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const filters: PhysicalFilters = {}
    for (const { key, label } of physicalFields) {
      const min = draft[`${key}_min`]
      const max = draft[`${key}_max`]
      if (min && max && Number(min) > Number(max)) {
        setError(`${label}: значение «от» должно быть не больше значения «до».`)
        return
      }
      if (min) filters[`${key}_min`] = Number(min)
      if (max) filters[`${key}_max`] = Number(max)
    }
    setError('')
    onApply(filters, query.trim())
  }

  return (
    <form className="planet-filters catalog-search" onSubmit={apply} onReset={() => {
      setDraft({})
      setQuery('')
      setError('')
      onApply({}, '')
    }}>
      <label>Планета или звезда<input type="search" maxLength={150} placeholder="TRAPPIST-1" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <details className="physical-filters">
        <summary>Физические параметры</summary>
        <div className="filter-ranges">
          {physicalFields.map(({ key, label, unit }) => (
            <fieldset key={key}>
              <legend>{label} ({unit})</legend>
              <div className="range-inputs">
                {(['min', 'max'] as const).map((bound) => {
                  const name = `${key}_${bound}` as const
                  return <label key={bound}>{bound === 'min' ? 'От' : 'До'}
                    <input type="number" min="0" step="any" value={draft[name] ?? ''}
                      onChange={(event) => { setDraft({ ...draft, [name]: event.target.value }); setError('') }} />
                  </label>
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <button type="button" onClick={() => { setDraft(methodology); setError('') }}>Подставить диапазоны из PDF</button>
        <p className="muted">При заданном диапазоне учитываются планеты с известным или расчётным значением.</p>
      </details>
      {error && <p className="filter-error" role="alert">{error}</p>}
      <button type="submit">Применить</button>
      <button type="reset">Сбросить</button>
    </form>
  )
}
