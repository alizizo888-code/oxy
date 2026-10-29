import { db } from './lib/db'
import { team } from './lib/team'
import { push } from './lib/push'
import { specialtyLabel } from './constants'

// MUTQAN notification system — every notification is fired by a REAL change in
// the order (status, live location, payment). Each event can be switched on/off
// per recipient (customer · technician · operations) from the notifications settings page.
export const NOTIFY_EVENTS = [
  { id: 'assigned', label: 'مهمة جديدة / استلام الطلب', sub: 'للفني: وصلته مهمة · للعميل: استلم فني طلبك', to: { client: true, tech: true, ops: true } },
  { id: 'accepted', label: 'قبول الفني للطلب', sub: 'الفني وافق على المهمة', to: { client: true, tech: false, ops: true } },
  { id: 'rejected', label: 'رفض الفني للمهمة', sub: 'يعود الطلب لغرفة العمليات', to: { client: false, tech: false, ops: true } },
  { id: 'contact', label: 'الفني يحتاج التواصل مع العميل', sub: 'زر عند الفني يطلب من العميل الرد / التواصل', to: { client: true, tech: false, ops: true } },
  { id: 'en_route', label: 'الفني في الطريق', sub: 'بدأ التحرك لموقع العميل', to: { client: true, tech: false, ops: true } },
  { id: 'distance', label: 'تنبيه المسافة', sub: 'الفني على بُعد كذا من العميل (حسب المسافات المحددة)', to: { client: true, tech: false, ops: false } },
  { id: 'nearby', label: 'الفني قريب من العميل', sub: 'دخل الفني نطاق القرب المحدد', to: { client: true, tech: false, ops: true } },
  { id: 'arrived', label: 'وصول الفني', sub: 'الفني وصل إلى الموقع', to: { client: true, tech: false, ops: true } },
  { id: 'started', label: 'بدء تنفيذ العمل', sub: 'الفني بدأ الخدمة', to: { client: true, tech: false, ops: true } },
  { id: 'progress', label: 'العمل ما زال جاريًا', sub: 'تحديث من الفني أن العمل لم ينتهِ بعد', to: { client: true, tech: false, ops: true } },
  { id: 'completed', label: 'انتهاء العمل', sub: 'الفني أنهى الخدمة', to: { client: true, tech: false, ops: true } },
  { id: 'paid', label: 'تم الدفع', sub: 'تسجيل أو تأكيد الدفع', to: { client: true, tech: true, ops: true } },
  { id: 'transfer', label: 'تم استلام التحويل', sub: 'عند الدفع بتحويل بنكي / تطبيق دفع', to: { client: true, tech: true, ops: true } },
]

export const DEFAULT_SOUND = {
  enabled: true, volume: 0.7, normalTone: 'chime', highTone: 'bell', highRepeat: 3, vibrate: true, bannerSecs: 6, highBannerSecs: 12,
  quiet: { on: false, from: '23:00', to: '07:00' },
  // which events ring as HIGH priority (louder, repeated, stays on screen)
  highEvents: { new_order: true, tech_application: true, rejected: true, contact: true, wa_handoff: true, wa_message: false },
}
export const HIGH_EVENT_LABELS = { new_order: 'طلب جديد', tech_application: 'طلب انضمام فني', rejected: 'رفض فني للمهمة', contact: 'الفني يطلب التواصل', arrived: 'وصول الفني', completed: 'انتهاء العمل', paid: 'تم الدفع', accepted: 'قبول الفني', assigned: 'إسناد طلب', wa_handoff: 'واتساب: عميل يحتاج موظف / أدنى سعر', wa_message: 'واتساب: رسالة عميل جديدة' }
export const mergeSound = (s) => ({ ...DEFAULT_SOUND, ...(s || {}), quiet: { ...DEFAULT_SOUND.quiet, ...(s?.quiet || {}) }, highEvents: { ...DEFAULT_SOUND.highEvents, ...(s?.highEvents || {}) } })

export const DEFAULT_NOTIFY_SETTINGS = {
  enabled: true,
  events: Object.fromEntries(NOTIFY_EVENTS.map((e) => [e.id, { enabled: true, ...e.to }])),
  distanceMilestonesKm: [3, 1, 0.5],
  nearbyMeters: 300,
  keepDays: 60,
}

export function mergeNotifySettings(row) {
  const r = row || {}
  const events = {}
  for (const e of NOTIFY_EVENTS) events[e.id] = { ...DEFAULT_NOTIFY_SETTINGS.events[e.id], ...(r.events?.[e.id] || {}) }
  return {
    ...DEFAULT_NOTIFY_SETTINGS,
    ...r,
    events,
    sound: mergeSound(r.sound),
    distanceMilestonesKm: Array.isArray(r.distanceMilestonesKm) && r.distanceMilestonesKm.length ? r.distanceMilestonesKm : DEFAULT_NOTIFY_SETTINGS.distanceMilestonesKm,
  }
}

export const fmtDistance = (meters) => (meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} كم` : `${Math.max(10, Math.round(meters / 10) * 10)} متر`)

// Message text per event and audience — built from the order's real data only.
function messages(eventId, order, extra) {
  const svc = specialtyLabel(order.specialtyId)
  const tech = order.technicianName || 'الفني'
  const client = order.clientName || 'العميل'
  const d = extra.meters != null ? fmtDistance(extra.meters) : ''
  const note = extra.note ? ` — ${extra.note}` : ''
  switch (eventId) {
    case 'assigned': return {
      tech: { title: '🔔 مهمة جديدة', body: `${svc} — ${client}` },
      client: { title: 'تم استلام طلبك', body: `استلم ${tech} طلب ${svc}` },
      ops: { title: 'تم إسناد طلب', body: `${svc} ← ${tech}` },
    }
    case 'accepted': return {
      client: { title: '✅ قبل الفني طلبك', body: `${tech} وافق على طلب ${svc}` },
      ops: { title: 'قبول مهمة', body: `${tech} قبل ${svc} — ${client}` },
    }
    case 'rejected': return { ops: { title: '⚠️ رفض فني للمهمة', body: `${tech} رفض ${svc} — ${client}، يحتاج إعادة إسناد` } }
    case 'contact': return {
      client: { title: '📞 الفني يحتاج التواصل معك', body: `${tech} يرجو تواصلك بخصوص ${svc}${note}` },
      ops: { title: 'فني يطلب التواصل مع العميل', body: `${tech} ← ${client} (${svc})${note}` },
    }
    case 'en_route': return { client: { title: '🚗 الفني في الطريق', body: `${tech} تحرك الآن إلى موقعك` }, ops: { title: 'فني في الطريق', body: `${tech} ← ${client} (${svc})` } }
    case 'distance': return { client: { title: `📍 الفني على بُعد ${d}`, body: `${tech} يقترب من موقعك — المسافة الحالية ${d}` } }
    case 'nearby': return {
      client: { title: '📍 الفني قريب منك', body: `${tech} على بُعد ${d || 'مسافة قصيرة'} من موقعك` },
      ops: { title: 'الفني قريب من العميل', body: `${tech} على بُعد ${d} من ${client}` },
    }
    case 'arrived': return {
      client: { title: '🏁 وصل الفني', body: `${tech} وصل إلى موقعك` },
      ops: { title: 'وصول فني', body: `${tech} وصل إلى ${client} (${svc})` },
    }
    case 'started': return { client: { title: '🛠️ بدأ تنفيذ العمل', body: `${tech} بدأ تنفيذ ${svc}` }, ops: { title: 'بدء تنفيذ', body: `${tech} بدأ ${svc} — ${client}` } }
    case 'progress': return { client: { title: '⏳ العمل ما زال جاريًا', body: `${tech}: العمل مستمر ولم ينتهِ بعد${note}` }, ops: { title: 'تحديث: العمل جارٍ', body: `${tech} — ${client}${note}` } }
    case 'completed': return {
      client: { title: '✅ انتهى العمل', body: `اكتملت خدمة ${svc} — هل تمت بالشكل المطلوب؟` },
      ops: { title: 'انتهاء مهمة', body: `${tech} أنهى ${svc} — ${client}` },
    }
    case 'paid': return {
      client: { title: '💳 تم الدفع', body: `تم تسجيل دفع طلب ${svc}${extra.amount ? ` (${extra.amount} ر.س)` : ''} — شكرًا لك` },
      tech: { title: 'تم الدفع', body: `${svc} — ${client}` },
      ops: { title: 'تم الدفع', body: `${svc} — ${client}${extra.method ? ` · ${extra.method}` : ''}` },
    }
    case 'transfer': return {
      client: { title: '🏦 تم استلام التحويل', body: `استلمنا تحويلك لطلب ${svc} — شكرًا لك` },
      tech: { title: 'تم استلام التحويل', body: `${svc} — ${client}` },
      ops: { title: 'تم استلام تحويل', body: `${svc} — ${client}${extra.method ? ` · ${extra.method}` : ''}` },
    }
    default: return {}
  }
}

// Client pushes that server-side follow-up triggers already send (when enabled)
const SERVER_COVERED = ['accepted', 'en_route', 'arrived', 'completed', 'paid']

async function inbox(gid, { userId, audience, eventId, msg, order, url, keepDays }) {
  const expiresAt = new Date(Date.now() + (keepDays || 60) * 86400000).toISOString()
  const scoped = audience === 'ops'
    ? { groupId: gid, visibleTo: 'creator-and-admin', writableBy: 'admins' }
    : { groupId: gid, visibleTo: `user:${userId}`, writableBy: `user:${userId}`, writableFields: ['read'] }
  return db.insertShared('notifications', {
    userId: userId || null, audience, event: eventId, title: msg.title, body: msg.body, url,
    orderId: order.id, read: false, at: new Date().toISOString(),
  }, undefined, { ...scoped, expiresAt })
}

/**
 * Fire one MUTQAN notification for a real order event.
 * @param {string} eventId  one of NOTIFY_EVENTS
 * @param {object} order    the order row (uses its current data)
 * @param {object} opts     { settings, serverPush, extra: { meters, note, amount, method } }
 */
export async function loadNotifySettings() {
  try { return mergeNotifySettings((await db.selectShared('notify_settings', {}, { limit: 1 }))?.[0]) } catch { return mergeNotifySettings(null) }
}

export async function notify(eventId, order, { settings, serverPush = false, extra = {} } = {}) {
  const S = settings ? mergeNotifySettings(settings) : await loadNotifySettings()
  const cfg = S.events[eventId]
  if (!S.enabled || !cfg?.enabled || !order) return
  const msgs = messages(eventId, order, extra)
  let gid = null
  try { gid = await team.groupId() } catch { return }
  const jobs = []
  const clientUrl = `#/order/${order.id}`
  const staffUrl = `#/staff/order/${order.id}`

  if (cfg.client && msgs.client && order.clientId) {
    jobs.push(inbox(gid, { userId: order.clientId, audience: 'client', eventId, msg: msgs.client, order, url: clientUrl, keepDays: S.keepDays }))
    if (!(serverPush && SERVER_COVERED.includes(eventId))) {
      jobs.push(push.send(order.clientId, { ...msgs.client, url: clientUrl }))
    }
  }
  if (cfg.tech && msgs.tech && order.technicianId) {
    jobs.push(inbox(gid, { userId: order.technicianId, audience: 'tech', eventId, msg: msgs.tech, order, url: staffUrl, keepDays: S.keepDays }))
    jobs.push(push.send(order.technicianId, { ...msgs.tech, url: staffUrl, sound: 'bell' }))
  }
  if (cfg.ops && msgs.ops) {
    jobs.push(inbox(gid, { userId: null, audience: 'ops', eventId, msg: msgs.ops, order, url: staffUrl, keepDays: S.keepDays }))
    jobs.push(push.sendToAdmins(gid, { ...msgs.ops, url: staffUrl, priority: S.sound.highEvents[eventId] ? 'high' : 'normal', event: eventId }))
  }
  await Promise.allSettled(jobs)
}

// Which distance milestones (km) were just crossed since the last notified one.
export function crossedMilestone(meters, milestonesKm, alreadyKm = []) {
  const sorted = [...milestonesKm].map(Number).filter((n) => n > 0).sort((a, b) => a - b)
  const hit = sorted.find((km) => meters <= km * 1000 && !alreadyKm.includes(km))
  if (hit == null) return null
  // Mark this and every larger milestone as done so we never go "backwards"
  return { km: hit, done: [...new Set([...alreadyKm, ...sorted.filter((k) => k >= hit)])] }
}
