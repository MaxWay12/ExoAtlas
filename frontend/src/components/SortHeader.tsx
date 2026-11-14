export type SortOrder = 'asc' | 'desc'
export type TableSort<Key extends string> = { key: Key; order: SortOrder }

export function nextSort<Key extends string>(sort: TableSort<Key>, key: Key): TableSort<Key> {
  return { key, order: sort.key === key && sort.order === 'asc' ? 'desc' : 'asc' }
}

export function SortHeader({ label, order, onSort }: { label: string; order?: SortOrder; onSort: () => void }) {
  return (
    <th scope="col" aria-sort={order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : undefined}>
      <button type="button" className="sort-header" onClick={onSort}>
        {label} <span aria-hidden="true">{order === 'asc' ? '↑' : order === 'desc' ? '↓' : '↕'}</span>
      </button>
    </th>
  )
}
