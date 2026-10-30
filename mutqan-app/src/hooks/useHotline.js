import { useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'

// Owner switch + optional TURN relay for the in-app hotline (pricing row `hotline`).
export function useHotlineConfig() {
  const { data } = useLiveShared('pricing', { limit: 100 })
  return useMemo(() => {
    const r = (data || []).find((x) => (x.serviceId || x.id) === 'hotline') || {}
    return { enabled: r.enabled !== false, turn: r.turnUrl ? { url: r.turnUrl, user: r.turnUser, pass: r.turnPass } : null }
  }, [data])
}
