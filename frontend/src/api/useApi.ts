import { useEffect, useState } from 'react'

export function useApi<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    load().then(
      (d) => alive && setData(d),
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data, error, loading: !data && !error }
}
