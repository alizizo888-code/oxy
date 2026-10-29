// Customer relationship helpers for the field map: customers are derived from orders, the CRM card is stored in `customer_profiles`.
export const CRM_STATUS = [
  { id: 'new', label: 'عميل جديد', color: '#22c55e' },
  { id: 'regular', label: 'عميل قديم', color: '#3b82f6' },
  { id: 'vip', label: 'عميل مميز VIP', color: '#f59e0b' },
  { id: 'loyal', label: 'عميل ولاء', color: '#a855f7' },
  { id: 'blocked', label: 'محظور', color: '#ef4444' },
]
export const CRM_FINANCE = [
  { id: 'ok', label: 'ملتزم بالسداد' },
  { id: 'late', label: 'يتأخر في السداد' },
  { id: 'debt', label: 'عليه مديونية' },
  { id: 'prepay', label: 'يدفع مقدمًا' },
  { id: 'unknown', label: 'غير محدد' },
]
export const CRM_STYLE = [
  { id: 'calm', label: 'هادئ ومتعاون' },
  { id: 'bargain', label: 'يفاوض كثيرًا' },
  { id: 'demanding', label: 'متطلب' },
  { id: 'rushed', label: 'مستعجل' },
  { id: 'difficult', label: 'صعب التعامل' },
]
export const crmLabel = (list, id) => list.find((x) => x.id === id)?.label || ''

// Stable customer key from an order: phone first, then creator, then the order id itself.
export const customerKey = (o) => {
  const ph = String(o?.clientPhone || '').replace(/\D/g, '')
  return ph ? `p${ph.slice(-9)}` : o?.userId ? `u${o.userId}` : `o${o?.id}`
}

const DAY = 86400000
const ts = (v) => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : 0 }

// Group orders into customers (newest order gives the map position). profiles = customer_profiles rows keyed by customer key.
export function buildCustomers(orders, profiles = []) {
  const prof = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  const by = new Map()
  for (const o of orders || []) {
    if (o.lat == null || o.lng == null) continue
    const k = customerKey(o)
    const cur = by.get(k) || { key: k, name: o.clientName || '', phone: o.clientPhone || '', orders: [], lat: o.lat, lng: o.lng, lastAt: 0 }
    cur.orders.push(o)
    const t = ts(o.createdAt)
    if (t >= cur.lastAt) { cur.lastAt = t; cur.lat = o.lat; cur.lng = o.lng; cur.address = o.address; cur.name = o.clientName || cur.name; cur.phone = o.clientPhone || cur.phone; cur.lastOrder = o }
    by.set(k, cur)
  }
  const now = Date.now()
  return [...by.values()].map((c) => {
    const p = prof[c.key] || {}
    const auto = c.orders.length <= 1 && now - c.lastAt < 30 * DAY ? 'new' : 'regular'
    return { ...c, profile: p, status: p.status || auto, auto }
  })
}

export function seenAgo(t) {
  const v = ts(t)
  if (!v) return 'لم يظهر بعد'
  const m = Math.max(0, Math.round((Date.now() - v) / 60000))
  if (m < 2) return 'الآن'
  if (m < 60) return `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return `قبل ${h} ساعة`
  const d = Math.round(h / 24)
  return d < 30 ? `قبل ${d} يوم` : new Date(v).toLocaleDateString('ar-SA')
}
export const isOnline = (t) => Date.now() - ts(t) < 10 * 60000
