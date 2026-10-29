import { useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { push } from '../lib/push'
import { mergePolicy, newCertificateNo } from '../warranty'

// Policy: one public-read row, only admins (owner / operations) edit it.
export function useWarrantyPolicy() {
  const { data, loading } = useLiveShared('warranty_policy', { limit: 1 })
  const policy = useMemo(() => mergePolicy(data?.[0]), [data])
  return { policy, loading }
}

export async function saveWarrantyPolicy(policy) {
  const gid = await team.groupId()
  const { id, ...rest } = policy
  await db.upsertShared('warranty_policy', { ...rest, updatedAt: new Date().toISOString() }, 'default', { groupId: gid, writableBy: 'admins' })
}

// Registry: staff-only records (customers never read other people's warranties).
export async function saveWarranty(rec) {
  const gid = await team.groupId()
  const { id, ...rest } = rec
  const wid = id || `w-${Date.now().toString(36)}`
  await db.upsertShared(
    'warranties',
    { ...rest, certificateNo: rest.certificateNo || newCertificateNo(), updatedAt: new Date().toISOString() },
    wid,
    { groupId: gid, visibleTo: 'creator-and-admin', writableBy: 'admins' }
  )
  return wid
}

// Claim: created by the customer (or MUTQAN AI on their behalf), readable by them
// and admins; only admins can change its status.
export async function submitClaim(claim) {
  const gid = await team.groupId()
  const row = await db.insertShared(
    'warranty_claims',
    { ...claim, status: 'new', createdAt: new Date().toISOString() },
    undefined,
    { groupId: gid, visibleTo: 'creator-and-admin', writableBy: 'admins' }
  )
  try {
    await push.sendToAdmins(gid, {
      title: 'طلب ضمان جديد',
      body: `${claim.customerName || 'عميل'} — ${claim.problem?.slice(0, 60) || ''}`,
      url: '#/staff/warranties',
      sound: 'bell',
    })
  } catch {}
  return row
}
