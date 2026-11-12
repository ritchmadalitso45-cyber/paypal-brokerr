import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/client'
export function useResource(path, revision = 0, poll = false) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const load = useCallback(async signal => {
    try { const data = await api(path, { signal }); if (!signal?.aborted) setState({ data, loading: false, error: '' }) }
    catch (error) { if (!signal?.aborted) setState({ data: null, loading: false, error: error.message }) }
  }, [path])
  useEffect(() => {
    const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal) })
    const timer = poll ? setInterval(() => { if (document.visibilityState === 'visible') void load(controller.signal) }, 30000) : null
    return () => { controller.abort(); clearInterval(timer) }
  }, [load, revision, poll])
  return { ...state, reload: () => load() }
}
