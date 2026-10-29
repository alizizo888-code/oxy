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
const mirrorSet = (token, u) => idb('readwrite', (st) => (token && u ? st.put({ token, user: u }, 'cur') : st.delete('cur')))
export async function restoreSession() {
  if (lsGet(TOKEN_KEY) && user) return false
  const saved = await idb('readonly', (st) => st.get('cur'))
  if (saved && saved.token && saved.user && !lsGet(TOKEN_KEY)) { setSession(saved.token, saved.user); return true }
  return false
}

export const currentUser = () => user
export function setSession(token, u) {
  if (token) lsSet(TOKEN_KEY, token); else lsDel(TOKEN_KEY)
  user = u || null
  if (u) lsSet(USER_KEY, JSON.stringify(u)); else lsDel(USER_KEY)
  mirrorSet(token, u)
  listeners.forEach((fn) => { try { fn(user) } catch { /* listener errors never break auth */ } })
}
export function onUser(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

export function headers(extra) {
  const h = { 'X-Mutqan-Anon': getAnonId(), ...extra }
  const t = getToken()
  if (t) h['X-Mutqan-Token'] = t
  return h
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
    if (res.status === 401 && getToken() && (!e || e.code === 'unauthorized')) { setSession('', null) } // expired session
    throw new ApiError((e && e.message) || 'حدث خطأ غير متوقع.', (e && e.code) || 'HTTP_' + res.status, res.status)
  }
  return json.data
}

export const post = (path, body) => send(path, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body || {}) })
export const get = (path) => send(path, { method: 'GET', headers: headers() })
export const upload = (path, form) => send(path, { method: 'POST', headers: headers(), body: form }, 90000)
