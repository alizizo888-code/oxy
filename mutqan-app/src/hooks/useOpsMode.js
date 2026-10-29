import { useCallback, useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'

// Owner switch: "in-house execution" (هندمة الأعمال). Stored as one admin-written row in `pricing`.
export function useOpsMode() {
  const { data } = useLiveShared('pricing', { limit: 100 })
  const inhouse = useMemo(() => !!(data || []).find((r) => (r.serviceId || r.id) === 'ops_mode')?.inhouse, [data])
  const setInhouse = useCallback(async (on) => {
    const gid = await team.groupId()
    await db.upsertShared('pricing', { serviceId: 'ops_mode', inhouse: !!on, updatedAt: new Date().toISOString() }, 'ops_mode', { groupId: gid, writableBy: 'admins' })
  }, [])
  return { inhouse, setInhouse }
}

export const isInhouseActive = (o) => !!o?.inhouse && !['completed', 'closed', 'cancelled'].includes(o.status)
export const INHOUSE_CLIENT_MSG = 'تم إسناد طلبك لفني، وجارٍ اتخاذ الإجراء اللازم.'
