import { nativeNotify, nativeAskPermission } from './nativeNotify'
import { post, currentUser, onUser } from './_api'

// In-app notifications without a push server: every signed-in device polls /push inbox every few
// seconds while the app is open, then shows a system notification (if allowed) and fires an event.
// (True background push needs a VAPID service worker — a later phase.)
const SEEN_KEY = 'mutqan_push_since'
let timer = null
let since = 0
try { since = Number(localStorage.getItem(SEEN_KEY)) || 0 } catch { /* private mode */ }
const timers = new Map()
const seen = new Set()   // ids already shown (the server may repeat the boundary second)

const supported = () => typeof Notification !== 'undefined'
export const notificationState = () => (supported() ? Notification.permission : 'unsupported')

const iconUrl = () => `${window.__MUTQAN__?.app || '/app/'}icon-192.png`
async function showSystem(m) {
  const hi = m.priority === 'high'
  const opts = { body: m.body || '', tag: m.id, icon: iconUrl(), badge: iconUrl(), dir: 'rtl', lang: 'ar', vibrate: m.silent || soundCfg?.vibrate === false ? [] : hi ? [220, 90, 220, 90, 320] : [120], silent: !!m.silent, requireInteraction: hi, renotify: true, data: { url: m.url || '' } }
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) { await reg.showNotification(m.title || 'متقن', opts); return }
  } catch { /* fall back */ }
  try {
    const n = new Notification(m.title || 'متقن', opts)
    n.onclick = () => { window.focus(); if (m.url) location.hash = String(m.url).replace(/^#/, '') }
  } catch { /* unsupported */ }
}

let soundCfg = null
export const setSoundConfig = (c) => { soundCfg = c }
const inQuiet = (q) => {
  if (!q?.on) return false
  const d = new Date(); const cur = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return q.from <= q.to ? cur >= q.from && cur < q.to : cur >= q.from || cur < q.to
}
// Owner controls: which events are really "high", and quiet hours (no sound/vibration, banner still shows).
function resolve(m) {
  const c = soundCfg
  if (!c) return m
  let priority = m.priority === 'high' ? 'high' : 'normal'
  if (m.event && c.highEvents && m.event in c.highEvents) priority = c.highEvents[m.event] ? 'high' : 'normal'
  const silent = c.enabled === false || inQuiet(c.quiet)
  return { ...m, priority, silent }
}

async function poll() {
  if (!currentUser() || document.visibilityState === 'hidden') return
  try {
    const r = await post('/push', { op: 'inbox', since: since || undefined })
    const now = Date.parse(r.now) || Date.now()
    const items = r.items || []
    if (!since) { for (const m of items) seen.add(m.id) }  // first poll ever: remember, don't replay old messages
    else {
      for (const m of items) {
        if (seen.has(m.id)) continue
        seen.add(m.id); if (seen.size > 300) seen.delete(seen.values().next().value)
        const rm = resolve(m)
        window.dispatchEvent(new CustomEvent('mutqan:push', { detail: rm }))
        if (supported() && Notification.permission === 'granted') {
          showSystem(rm)
        }
        nativeNotify(rm)
      }
    }
    since = now
    try { localStorage.setItem(SEEN_KEY, String(since)) } catch { /* ignore */ }
  } catch { /* offline / signed out */ }
}

export function startInbox() {
  if (timer) return
  nativeAskPermission()
  timer = setInterval(poll, 4000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll() })
  onUser(() => { since = 0; poll() })
  poll()
}

const send = (target, message) => post('/push', { op: 'send', target, message })

export const push = {
  send: (userId, message) => send({ user: userId }, message),
  sendToRole: (_gid, role, message) => send({ role }, message),
  sendToAdmins: (_gid, message) => send({ admins: true }, message),
  async requestPermission() { return supported() ? Notification.requestPermission() : 'unsupported' },
  async subscribe() { startInbox(); return { ok: true } },
  diagnose() {
    if (!supported()) return { ok: false, reason: 'unsupported', hint: 'هذا المتصفح لا يدعم الإشعارات. أضف التطبيق للشاشة الرئيسية أو استخدم متصفحًا حديثًا.' }
    return { ok: true, permission: Notification.permission }
  },
  // Follow-up reminders fire only while the app stays open (no server scheduler on shared hosting).
  async scheduleIn(ms, message) {
    const id = 'sch-' + Math.random().toString(36).slice(2, 9)
    const t = setTimeout(() => {
      timers.delete(id)
      window.dispatchEvent(new CustomEvent('mutqan:push', { detail: { id, ...message } }))
      if (supported() && Notification.permission === 'granted') { try { new Notification(message.title || 'متقن', { body: message.body || '' }) } catch { /* ignore */ } }
    }, Math.max(1000, ms))
    timers.set(id, t)
    return { id }
  },
  async cancelSchedule(id) { clearTimeout(timers.get(id)); timers.delete(id); return { ok: true } },
}
