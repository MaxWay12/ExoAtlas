import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { checkSystem, type CheckedSystem } from './validate'

interface State { id: string; checked?: CheckedSystem; error?: string }

/**
 * Загружает систему по id. Результат отдаётся только если он относится к
 * ТЕКУЩЕМУ id: запоздавший ответ прежней системы не может подмениться на новую.
 */
export function useSystemDetail(id: string | null): State | null {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    if (!id) { setState(null); return }
    const controller = new AbortController()
    setState(null)
    api.system(id, controller.signal).then(
      (detail) => {
        try { setState({ id, checked: checkSystem(detail, id) }) }
        catch (e) { setState({ id, error: (e as Error).message }) }
      },
      (e: Error) => { if (e.name !== 'AbortError') setState({ id, error: e.message }) },
    )
    return () => controller.abort()
  }, [id])

  return state && state.id === id ? state : null
}
