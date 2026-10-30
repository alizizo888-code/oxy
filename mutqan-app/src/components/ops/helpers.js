import { maps } from '../../lib/maps'
import { remainingCapacity, isTechAvailable } from '../../assignment'

export const DONE = ['completed', 'closed']
export const RUNNING = ['accepted', 'en_route', 'nearby', 'arrived', 'in_progress']
export const isToday = (iso) => { if (!iso) return false; const d = new Date(iso), n = new Date(); return d.toDateString() === n.toDateString() }
export const minsAgo = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0)
export const ageText = (iso) => { const m = minsAgo(iso); return m < 1 ? 'الآن' : m < 60 ? `${m} د` : m < 1440 ? `${Math.floor(m / 60)} س` : `${Math.floor(m / 1440)} يوم` }
export const isUnassigned = (o) => ['new', 'forced'].includes(o.status) && !o.technicianId && !o.inhouse
export const techPos = (t) => (t.lat != null && t.lng != null ? { lat: t.lat, lng: t.lng, live: minsAgo(t.lastSeenAt) <= 10 } : t.homeLat != null ? { lat: t.homeLat, lng: t.homeLng, live: false } : null)
export const kmText = (d) => (Number.isFinite(d) ? (d < 1 ? `${Math.round(d * 1000)} م` : `${d.toFixed(1)} كم`) : 'موقع غير معروف')
export function distTo(t, o) {
  const p = techPos(t)
  if (!p || o?.lat == null) return Infinity
  try { return maps.distance(p.lat, p.lng, o.lat, o.lng) } catch { return Infinity }
}
// Technicians ranked for one order: available first, then nearest.
export function rankTechs(order, profiles, orders) {
  return (profiles || []).map((t) => ({ t, dist: distTo(t, order), rem: remainingCapacity(t, orders), ok: isTechAvailable(t, orders), pos: techPos(t) }))
    .sort((a, b) => (b.ok - a.ok) || (a.dist - b.dist) || (b.rem - a.rem))
}
export const sourceLabel = (o) => (o.source === 'whatsapp_manual' ? 'واتساب (يدوي)' : o.routing === 'operations' ? 'الموقع' : o.source === 'whatsapp' ? 'واتساب' : 'التطبيق')
