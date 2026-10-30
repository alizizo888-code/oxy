import { useLiveShared } from './useLive'
import { useMemo } from 'react'

// Paid-ads landing experiment: a link like  #/s/ac  opens the Home first, then moves on to that specialty's page (so "back" returns to Home).
// Owner switch: pricing row `ad_landing` { enabled }. Default ON; OFF = the link goes straight to the specialty page.
export function useAdLanding() {
  const { data } = useLiveShared('pricing', { limit: 100 })
  return useMemo(() => { const r = (data || []).find((x) => (x.serviceId || x.id) === 'ad_landing'); return { enabled: r ? r.enabled !== false : true, loaded: data != null } }, [data])
}
