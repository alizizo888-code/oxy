import { useEffect, useRef, useState, useCallback } from 'react'
import { db, onLocalWrite } from './db'

// Live data without websockets (works on any shared host): one cheap "stamps" request every few
// seconds for ALL collections on screen; a collection is refetched only when its stamp changed.
const subs = new Map()       // coll -> Set(refetch fns)
const lastStamp = new Map()  // coll -> last seen stamp
let timer = null
let busy = false

const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

async function tick() {
  if (busy || !visible() || subs.size === 0) return
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
  } catch { /* offline or logged out: try again next tick */ }
  finally { busy = false }
}

function ensureTimer() {
  if (timer || typeof window === 'undefined') return
  // One tiny "stamps" request every 2.5 s while the screen is visible: web and installed app see the same change within seconds.
  timer = setInterval(tick, 2500)
  const resync = () => { if (visible()) { subs.forEach((s) => s.forEach((fn) => fn())); tick() } }
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
