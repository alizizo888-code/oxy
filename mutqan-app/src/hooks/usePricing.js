import { useCallback, useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { SPECIALTIES } from '../constants'
import { normalizeRule, defaultInternal } from '../pricing'

// Customer-facing price rules (readable by everyone, editable only by team admins:
// the owner and the operations supervisor). One row per service, keyed by service id.
export function usePricing() {
  const { data, loading } = useLiveShared('pricing', { limit: 100 })
  const rules = useMemo(() => {
    const byId = Object.fromEntries((data || []).map((r) => [r.serviceId || r.id, r]))
    return Object.fromEntries(SPECIALTIES.map((s) => [s.id, normalizeRule(s.id, byId[s.id])]))
  }, [data])

  const saveRule = useCallback(async (serviceId, rule) => {
    const gid = await team.groupId()
    const clean = normalizeRule(serviceId, rule)
    await db.upsertShared('pricing', clean, serviceId, { groupId: gid, writableBy: 'admins' })
  }, [])

  return { rules, loading, saveRule }
}

// Internal economics (commission / margin) — readable only by team admins.
export function usePricingInternal() {
  const { data } = useLiveShared('pricing_internal', { limit: 100 })
  const internal = useMemo(() => {
    const byId = Object.fromEntries((data || []).map((r) => [r.serviceId || r.id, r]))
    return Object.fromEntries(SPECIALTIES.map((s) => [s.id, { ...defaultInternal(s.id), ...(byId[s.id] || {}) }]))
  }, [data])

  const saveInternal = useCallback(async (serviceId, row) => {
    const gid = await team.groupId()
    const commissionPct = Math.min(100, Math.max(0, Number(row.commissionPct) || 0))
    await db.upsertShared(
      'pricing_internal',
      { serviceId, commissionPct, marginPct: 100 - commissionPct },
      serviceId,
      { groupId: gid, visibleTo: 'creator-and-admin', writableBy: 'admins' }
    )
  }, [])

  return { internal, saveInternal }
}
