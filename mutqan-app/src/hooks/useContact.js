import { useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { BUSINESS_PHONE, BUSINESS_WHATSAPP } from '../constants'

// Owner-set contact numbers (pricing row `contact_numbers`) — one source for Home, quick service, floating buttons, dispatch and articles.
// Buttons render only when the number exists.
export function useContact() {
  const { data } = useLiveShared('pricing', { limit: 100 })
  return useMemo(() => {
    const r = (data || []).find((x) => (x.serviceId || x.id) === 'contact_numbers') || {}
    return { wa: String(r.whatsapp || BUSINESS_WHATSAPP || '').replace(/\D/g, ''), phone: String(r.phone || BUSINESS_PHONE || '').replace(/[^\d+]/g, '') }
  }, [data])
}
