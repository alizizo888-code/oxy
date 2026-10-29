// MUTQAN warranty engine — every warranty fact the app (and MUTQAN AI) shows is
// computed from real records: a completed order's completion date, or a warranty
// registered by staff in the warranty registry. Nothing is assumed.
import { SPECIALTIES, specialtyLabel } from './constants'

export const DEFAULT_POLICY = {
  defaultDays: 30,
  days: {}, // per-service override: { ac: 90, solar: 365 }
  terms: '',
  exclusions: '',
  claimPhotoRequired: false,
}

export const CLAIM_STATUS = {
  new: { label: 'جديد — بانتظار الفحص', cls: 'bg-sky-500/15 text-sky-300' },
  reviewing: { label: 'قيد الفحص', cls: 'bg-amber-500/15 text-amber-300' },
  approved: { label: 'مقبول ضمن الضمان', cls: 'bg-emerald-500/15 text-emerald-300' },
  rejected: { label: 'مرفوض', cls: 'bg-rose-500/15 text-rose-300' },
}

const DAY = 86400000

export function mergePolicy(row) {
  const r = row || {}
  return { ...DEFAULT_POLICY, ...r, days: { ...DEFAULT_POLICY.days, ...(r.days || {}) } }
}

export const policyDaysFor = (policy, specialtyId) => {
  const v = Number(policy?.days?.[specialtyId])
  return Number.isFinite(v) && v >= 0 && policy?.days?.[specialtyId] !== '' ? v : Number(policy?.defaultDays ?? 30)
}

function build(startIso, days, extra) {
  const start = new Date(startIso)
  if (!startIso || Number.isNaN(start.getTime())) return { known: false, ...extra }
  const end = new Date(start.getTime() + days * DAY)
  const remainingDays = Math.ceil((end.getTime() - Date.now()) / DAY)
  return {
    known: true,
    start: start.toISOString(),
    end: end.toISOString(),
    days,
    active: remainingDays > 0,
    remainingDays: Math.max(0, remainingDays),
    ...extra,
  }
}

// Warranty of an in-app order — starts at the real completion time.
export function orderWarranty(order, policy) {
  if (!order || !['completed', 'closed'].includes(order.status)) return { known: false, reason: 'not_completed' }
  const completedAt = order.completedAt || [...(order.statusHistory || [])].reverse().find((h) => h.status === 'completed')?.at
  const days = Number.isFinite(Number(order.warrantyDays)) && order.warrantyDays !== null && order.warrantyDays !== ''
    ? Number(order.warrantyDays)
    : policyDaysFor(policy, order.specialtyId)
  return build(completedAt, days, { source: 'order', orderId: order.id, specialtyId: order.specialtyId })
}

// Warranty registered manually in the registry (device, installation, contract…).
export function recordWarranty(rec) {
  return build(rec?.startDate, Number(rec?.days) || 0, { source: 'registry', recordId: rec?.id, specialtyId: rec?.specialtyId, certificateNo: rec?.certificateNo })
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

export function warrantyText(w) {
  if (!w?.known) return w?.reason === 'not_completed' ? 'الضمان يبدأ بعد اكتمال الخدمة' : 'لا توجد بيانات ضمان مسجلة'
  return w.active
    ? `ساري حتى ${fmtDate(w.end)} — متبقي ${w.remainingDays} يوم (مدة الضمان ${w.days} يوم)`
    : `منتهي منذ ${fmtDate(w.end)} (كانت المدة ${w.days} يوم)`
}

export function policyForPrompt(policy) {
  const p = mergePolicy(policy)
  const overrides = SPECIALTIES.filter((s) => p.days[s.id] !== undefined && p.days[s.id] !== '')
    .map((s) => `${s.label}: ${p.days[s.id]} يوم`)
  return [
    `سياسة الضمان المعتمدة من إدارة مُتقن: المدة الافتراضية ${p.defaultDays} يوم من تاريخ اكتمال الخدمة.`,
    overrides.length ? `مدد خاصة: ${overrides.join('، ')}.` : null,
    p.terms ? `الشروط: ${p.terms}` : null,
    p.exclusions ? `ما لا يشمله الضمان: ${p.exclusions}` : null,
  ].filter(Boolean).join('\n')
}

export const newCertificateNo = () => 'W-' + Date.now().toString(36).toUpperCase().slice(-6)

export { specialtyLabel }
