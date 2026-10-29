// MUTQAN workflow rules shared by the AI, the customer chat and the staff screens:
// escalation reasons, the order-transfer chain + who may move an order where,
// follow-up messages per status, and the tracking facts the AI may read.
import { maps } from './lib/maps'

// ── AI escalation ─────────────────────────────────────────────────────────
export const ESCALATION_REASONS = [
  { id: 'pricing', label: 'خلاف على السعر' },
  { id: 'complaint', label: 'شكوى عميل' },
  { id: 'refund', label: 'طلب استرداد' },
  { id: 'legal', label: 'مسألة قانونية' },
  { id: 'payment', label: 'مشكلة في الدفع' },
  { id: 'repeated_failure', label: 'تعثّر المساعد المتكرر' },
  { id: 'human', label: 'العميل طلب موظفًا' },
  { id: 'high_value', label: 'عميل عالي القيمة' },
  { id: 'sensitive', label: 'عملية حساسة' },
]
const OPS_REASONS = { no_accept: 'الفني لم يقبل في الوقت المحدد', tech_late: 'تأخر الفني', forced_stale: 'مهمة إجبارية بلا قبول', manual: 'تصعيد يدوي' }
export const escalationLabel = (id) => ESCALATION_REASONS.find((r) => r.id === id)?.label || OPS_REASONS[id] || id || ''
export const URGENT_REASONS = ['complaint', 'refund', 'legal', 'payment', 'sensitive']

export const ACTIVE_STATUSES_FOR_ALERTS = ['new', 'forced', 'assigned', 'accepted', 'en_route', 'nearby', 'arrived', 'in_progress', 'completed']

// ── Order transfer chain ─────────────────────────────────────────────────
export const TRANSFER_CHAIN = [
  { id: 'ai', label: 'خدمة العملاء الذكية' },
  { id: 'operations', label: 'غرفة العمليات' },
  { id: 'technician', label: 'الفني' },
  { id: 'supervisor', label: 'مشرف الموقع' },
  { id: 'owner', label: 'المالك' },
]
export const handlerLabel = (id) => TRANSFER_CHAIN.find((s) => s.id === id)?.label || id

// Where an order sits right now in the chain.
export function currentHandler(order) {
  if (order?.handler) return order.handler
  if (order?.technicianId && ['assigned', 'accepted', 'en_route', 'nearby', 'arrived', 'in_progress'].includes(order.status)) return 'technician'
  return 'operations'
}

// Who may move an order from → to. The AI itself can only hand to operations.
const ALLOWED = {
  ai: { ai: ['operations'] },
  operations: { operations: ['supervisor', 'owner'], technician: ['operations', 'supervisor', 'owner'], supervisor: ['operations', 'owner'], owner: [] },
  technician: { technician: ['operations', 'supervisor'] },
  supervisor: { supervisor: ['operations', 'owner'], technician: ['operations', 'supervisor'], operations: ['supervisor'] },
  owner: { operations: ['supervisor', 'owner'], technician: ['operations', 'supervisor', 'owner'], supervisor: ['operations', 'owner'], owner: ['operations', 'supervisor'] },
}
export function allowedTransfers(role, from, isAssignedTech) {
  if (role === 'technician' && !isAssignedTech) return []
  return (ALLOWED[role] || {})[from] || []
}

// ── Follow-up messages (customer side) ───────────────────────────────────
export const FOLLOWUP_MESSAGES = {
  new: () => 'تم استلام طلبك.',
  accepted: (o) => `تم قبول طلبك بواسطة الفني${o.technicianName ? ` ${o.technicianName}` : ''}.`,
  en_route: () => 'الفني في الطريق.',
  arrived: () => 'وصل الفني إلى موقعك.',
  completed: () => 'هل تمت الخدمة بالشكل المطلوب؟',
}

// Timeline of follow-up events from the customer's recent orders.
export function followUpEvents(orders, { days = 14 } = {}) {
  const since = Date.now() - days * 86400000
  const out = []
  for (const o of orders || []) {
    const created = new Date(o.createdAt || 0).getTime()
    if (created && created < since) continue
    const seen = new Set()
    for (const h of o.statusHistory || []) {
      const fn = FOLLOWUP_MESSAGES[h.status]
      if (!fn || seen.has(h.status)) continue
      seen.add(h.status)
      out.push({
        id: `fu-${o.id}-${h.status}`,
        role: 'followup',
        status: h.status,
        orderId: o.id,
        content: fn(o),
        awaitingFeedback: h.status === 'completed' && !o.serviceFeedback && !o.rating,
        createdAt: new Date(h.at).getTime(),
      })
    }
    const op = o.onlinePayment
    if (op?.createdAt) {
      out.push({ id: `fu-${o.id}-paylink-${op.attempts || 1}`, role: 'followup', status: 'payment_created', orderId: o.id, content: 'تم إنشاء رابط الدفع — ننتظر تأكيد مزود الدفع.', createdAt: new Date(op.createdAt).getTime() })
    }
    if (op?.status === 'failed' && op.failedAt && o.paymentStatus !== 'paid') {
      out.push({ id: `fu-${o.id}-payfail-${op.attempts || 1}`, role: 'followup', status: 'payment_failed', orderId: o.id, content: 'لم يكتمل الدفع. تقدر تحاول مرة أخرى من صفحة الطلب أو تدفع للفني.', createdAt: new Date(op.failedAt).getTime() })
    }
    if (o.paymentStatus === 'paid' && o.paidAt) {
      out.push({ id: `fu-${o.id}-paid`, role: 'followup', status: 'paid', orderId: o.id, content: o.paymentMethod === 'online' ? 'تم تأكيد الدفع الإلكتروني من مزود الدفع.' : 'تم تسجيل الدفع.', createdAt: new Date(o.paidAt).getTime() })
    }
  }
  return out
}

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'نقدًا' },
  { id: 'card', label: 'شبكة / مدى' },
  { id: 'transfer', label: 'تحويل بنكي' },
]

// ── Tracking facts (never an ETA) ────────────────────────────────────────
export function trackingFacts(order, staleMinutes = 10) {
  const loc = order?.technicianLocation
  const moving = ['en_route', 'nearby'].includes(order?.status)
  if (!moving) return { available: false, reason: 'status' }
  if (!loc?.lat || !loc?.updatedAt) return { available: false, reason: 'no_location' }
  const ageMin = Math.max(0, Math.round((Date.now() - new Date(loc.updatedAt).getTime()) / 60000))
  let km = null
  if (order.lat != null && order.lng != null) {
    try { km = Math.round((maps.distance(loc.lat, loc.lng, order.lat, order.lng) / 1000) * 10) / 10 } catch {}
  }
  return { available: true, stale: ageMin > staleMinutes, ageMin, km }
}

export function trackingText(order, staleMinutes) {
  const t = trackingFacts(order, staleMinutes)
  if (!t.available) {
    if (t.reason === 'status') return 'لا يوجد تتبع حي لهذا الطلب في حالته الحالية.'
    return 'لا توجد بيانات موقع حية للفني حاليًا.'
  }
  const dist = t.km != null ? `على بُعد نحو ${t.km} كم من موقع الخدمة` : 'المسافة غير معروفة'
  return `آخر موقع فعلي للفني ${dist}، آخر تحديث قبل ${t.ageMin} دقيقة${t.stale ? ' (قديم — البيانات غير كافية للتأكيد)' : ''}.`
}
