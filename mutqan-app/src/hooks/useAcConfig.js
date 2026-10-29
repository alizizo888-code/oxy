import { useCallback, useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { normalizeAc } from '../acPricing'

// AC price table lives in the public `pricing` collection as the row "ac_calc".
export function useAcConfig() {
  const { data, loading } = useLiveShared('pricing', { limit: 100 })
  const { data: offersAll } = useLiveShared('offers', { limit: 100 })
  const { data: media } = useLiveShared('ac_media', { limit: 200 })
  const cfg = useMemo(() => normalizeAc((data || []).find((r) => (r.serviceId || r.id) === 'ac_calc')), [data])
  const offers = useMemo(
    () => (offersAll || []).filter((o) => o.acMode).sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99)),
    [offersAll]
  )
  const saveCfg = useCallback(async (next) => {
    const gid = await team.groupId()
    await db.upsertShared('pricing', { ...normalizeAc(next), serviceId: 'ac_calc' }, 'ac_calc', { groupId: gid, writableBy: 'admins' })
  }, [])
  return { cfg, offers, media: media || [], loading, saveCfg }
}
