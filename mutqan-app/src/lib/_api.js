// Tiny HTTP + session layer for the Mutqan WordPress backend (/wp-json/mutqan/v1).
// Session token lives in localStorage; guests get an anonymous id so a visitor can chat/order before signing up.
const CFG = (typeof window !== 'undefined' && window.__MUTQAN__) || {}
export const API_BASE = (CFG.api || (import.meta.env && import.meta.env.VITE_API) || '/wp-json/mutqan/v1').replace(/\/$/, '')
export const APP_URL = CFG.app || (typeof location !== 'undefined' ? location.origin + '/app/' : '')

const TOKEN_KEY = 'mutqan_token'
const ANON_KEY = 'mutqan_anon'
const USER_KEY = 'mutqan_user'
const mem = {}

function lsGet(k) { try { return localStorage.getItem(k) } catch { return mem[k] ?? null } }
function lsSet(k, v) { try { localStorage.setItem(k, v) } catch { mem[k] = v } }
function lsDel(k) { try { localStorage.removeItem(k) } catch { delete mem[k] } }

export function randomId() {
  try {
    const a = new Uint8Array(16); crypto.getRandomValues(a)
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
  } catch { return (Date.now().toString(16) + Math.random().toString(16).slice(2)).padEnd(32, '0').slice(0, 32) }
}

export const getToken = () => lsGet(TOKEN_KEY) || ''
export function getAnonId() {
  let id = lsGet(ANON_KEY)
  if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) { id = randomId(); lsSet(ANON_KEY, id) }
  return id
}

let user = null
try { user = JSON.parse(lsGet(USER_KEY) || 'null') } catch { user = null }
const listeners = new Set()

// Mirror of the session in IndexedDB: some browsers / installed PWAs wipe localStorage on their own,
// which looked like "the owner is logged out again". The mirror restores it on the next launch.
const IDB = 'mutqan_session'
function idb(mode, fn) {
  return new Promise((resolve) => {
    try {
      const rq = indexedDB.open(IDB, 1)
      rq.onupgradeneeded = () => rq.result.createObjectStore('s')
      rq.onerror = () => resolve(null)
      rq.onsuccess = () => {
        try {
          const tx = rq.result.transaction('s', mode); const st = tx.objectStore('s'); const r = fn(st)
          tx.oncomplete = () => { resolve(r && r.result !== undefined ? r.result : null); rq.result.close() }
          tx.onerror = () => resolve(null)
        } catch { resolve(null) }
      }
    } catch { resolve(null) }
  })
}
// Second mirror: a long-lived cookie (survives when the browser clears localStorage/IndexedDB but keeps cookies).
const CK = 'mq_sess'
const ckSet = (token) => { try { document.cookie = token ? `${CK}=${token}; Max-Age=${90 * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}` : `${CK}=; Max-Age=0; Path=/` } catch { /* ignore */ } }
const ckGet = () => { try { const m = document.cookie.match(new RegExp('(?:^|; )' + CK + '=([a-f0-9]{64})')); return m ? m[1] : '' } catch { return '' } }
// Ask the browser not to evict this site's storage (installed PWAs are otherwise cleared under pressure).
try { navigator.storage?.persist?.() } catch { /* ignore */ }
const mirrorSet = (token, u) => idb('readwrite', (st) => (token && u ? st.put({ token, user: u }, 'cur') : st.delete('cur')))
export async function restoreSession() {
  if (lsGet(TOKEN_KEY) && user) return false
  const saved = await idb('readonly', (st) => st.get('cur'))
  if (saved && saved.token && saved.user && !lsGet(TOKEN_KEY)) { setSession(saved.token, saved.user); return true }
  // Everything local was wiped but the cookie survived: restore the token; the user object is re-fetched by auth.refresh().
  const ck = ckGet()
  if (ck && !lsGet(TOKEN_KEY)) { lsSet(TOKEN_KEY, ck); return true }
  return false
}

export const currentUser = () => user
export function setSession(token, u) {
  if (token) lsSet(TOKEN_KEY, token); else lsDel(TOKEN_KEY)
  user = u || null
  if (u) lsSet(USER_KEY, JSON.stringify(u)); else lsDel(USER_KEY)
  mirrorSet(token, u); ckSet(token)
  listeners.forEach((fn) => { try { fn(user) } catch { /* listener errors never break auth */ } })
}
export function onUser(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

// Human-readable reason for a failed save: the server's own message when there is one.
export function errText(e, fallback = 'تعذر الحفظ') {
  if (e && e.code === 'NETWORK') return 'لا يوجد اتصال بالخادم — تحقق من الإنترنت وأعد المحاولة.'
  if (e && e.message && e instanceof ApiError) return `${fallback}: ${e.message}${e.code && !/^HTTP_/.test(e.code) ? ` (${e.code})` : e.status ? ` (${e.status})` : ''}`
  return fallback
}

export function headers(extra) {
  const h = { 'X-Mutqan-Anon': getAnonId(), ...extra }
  const t = getToken()
  if (t) h['X-Mutqan-Token'] = t
  return h
}

let verifying = null
// Signed out only when the server says "no user" twice in a row; network errors keep the session.
function verifySession() {
  if (verifying) return verifying
  verifying = (async () => {
    const t = getToken(); if (!t) return
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(API_BASE + '/auth', { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ op: 'me' }), credentials: 'omit' })
        const j = await r.json()
        if (j && j.data && j.data.user) { setSession(t, j.data.user); return }
        if (!(r.ok && j && j.data)) return        // server error — not proof of sign-out
      } catch { return }                           // offline — keep session
      await new Promise((ok) => setTimeout(ok, 1200))
    }
    setSession('', null)
  })().finally(() => { verifying = null })
  return verifying
}

async function send(path, init, timeoutMs = 25000) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  let res
  try { res = await fetch(API_BASE + path, { ...init, signal: ctl.signal, credentials: 'omit' }) }
  catch (e) { throw new ApiError('تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.', 'NETWORK', 0) }
  finally { clearTimeout(timer) }
  let json = null
  try { json = await res.json() } catch { /* non-JSON error page */ }
  if (!res.ok || !json || json.error) {
    const e = json && json.error
    // Never drop the session on a single 401 (cache hiccup, cold server): confirm it with /auth me first.
    if ((res.status === 401 || res.status === 403) && getToken() && (!e || e.code === 'unauthorized' || e.code === 'forbidden') && !path.startsWith('/auth')) {
      await verifySession()
      // The server no longer knows this session (expired / wiped): say so instead of a vague "forbidden".
      if (!getToken()) throw new ApiError('انتهت جلستك على الخادم — سجّل الدخول من جديد بحساب المالك ثم أعد المحاولة.', 'SESSION_EXPIRED', 401)
    }
    throw new ApiError((e && e.message) || 'حدث خطأ غير متوقع.', (e && e.code) || 'HTTP_' + res.status, res.status)
  }
  return json.data
}

export const post = (path, body) => send(path, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body || {}) })
export const get = (path) => send(path, { method: 'GET', headers: headers() })
export const upload = (path, form) => send(path, { method: 'POST', headers: headers(), body: form }, 90000)
