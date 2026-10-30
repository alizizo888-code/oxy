import { useEffect, useRef, useState, useCallback } from 'react'
import { db, onLocalWrite } from './db'

// Live data without websockets (works on any shared host): one cheap "stamps" request every few
// seconds for ALL collections on screen; a collection is refetched only when its stamp changed.
const subs = new Map()       // coll -> Set(refetch fns)
const lastStamp = new Map()  // coll -> last seen stamp
let timer = null
let busy = false
let fails = 0
let lastTouch = Date.now()

const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

// Adaptive cadence: 2.5 s while the screen is in use, 8 s after 5 idle minutes, 30 s when hidden (installed app in the background still catches up),
// exponential back-off (up to 30 s) while the network/server is failing.
function nextDelay() {
  const base = !visible() ? 30000 : Date.now() - lastTouch > 300000 ? 8000 : 2500
  return fails ? Math.min(30000, Math.max(base, 2500 * 2 ** Math.min(fails, 4))) : base
}
async function tick() {
  if (busy || subs.size === 0) return
  busy = true
  try {
    const stamps = await db.stamps([...subs.keys()])
    for (const [coll, stamp] of Object.entries(stamps || {})) {
      if (lastStamp.get(coll) !== stamp) {
        const first = !lastStamp.has(coll)
        lastStamp.set(coll, stamp)
        if (!first) subs.get(coll)?.forEach((fn) => fn())
      }
    }
    fails = 0
  } catch { fails++ /* offline or logged out: back off, retry */ }
  finally { busy = false }
}

function ensureTimer() {
  if (timer || typeof window === 'undefined') return
  const loop = async () => { await tick(); timer = setTimeout(loop, nextDelay()) }
  timer = setTimeout(loop, 2500)
  const touch = () => { lastTouch = Date.now() }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, touch, { passive: true }))
  const resync = () => { touch(); fails = 0; if (visible()) { subs.forEach((s) => s.forEach((fn) => fn())) } tick() }
  document.addEventListener('visibilitychange', resync)
  window.addEventListener('focus', resync)
  window.addEventListener('pageshow', resync)
  window.addEventListener('online', resync)
}
onLocalWrite((coll) => { subs.get(coll)?.forEach((fn) => fn()) })

export function useLiveShared(coll, query = {}) {
  const [state, setState] = useState({ data: [], loading: true, error: null })
  const key = JSON.stringify(query || {})
  const qref = useRef(query)
  qref.current = query
  const alive = useRef(true)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const n = ++seq.current
    const q = qref.current || {}
    try {
      const rows = await db.selectShared(coll, q.filters || {}, { limit: q.limit, order: q.order, offset: q.offset })
      if (alive.current && n === seq.current) setState({ data: Array.isArray(rows) ? rows : [], loading: false, error: null })
    } catch (e) {
      if (alive.current && n === seq.current) setState((s) => ({ data: s.data, loading: false, error: e }))
    }
  }, [coll, key])

  useEffect(() => {
    alive.current = true
    setState((s) => (s.loading ? s : { ...s, loading: true }))
    load()
    let set = subs.get(coll)
    if (!set) { set = new Set(); subs.set(coll, set) }
    set.add(load)
    ensureTimer()
    return () => {
      alive.current = false
      set.delete(load)
      if (set.size === 0) { subs.delete(coll); lastStamp.delete(coll) }
    }
  }, [coll, load])

  return { ...state, refetch: load }
}

export const useLive = useLiveShared
