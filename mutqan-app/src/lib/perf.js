import { useEffect, useState } from 'react'

// Performance mode: auto (decided from the device) | lite | full. "lite" removes decorative animation that can freeze weak phones.
const KEY = 'mutqan_perf'
const get = () => { try { return localStorage.getItem(KEY) || 'auto' } catch { return 'auto' } }
export function isLowEnd() {
  const n = typeof navigator === 'undefined' ? {} : navigator
  return (n.deviceMemory && n.deviceMemory <= 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || n.connection?.saveData === true || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
}
export const perfMode = () => get()
export const isLite = () => { const m = get(); return m === 'lite' || (m === 'auto' && isLowEnd()) }
export function applyPerf() {
  const el = document.documentElement
  el.classList.toggle('lite', isLite())
}
export function setPerfMode(m) { try { localStorage.setItem(KEY, m) } catch { /* ignore */ } applyPerf(); window.dispatchEvent(new Event('mutqan:perf')) }
export function initPerf() {
  applyPerf()
  // Pause every decorative animation while the page is in the background (saves battery and memory).
  const sync = () => document.documentElement.classList.toggle('bg-paused', document.visibilityState === 'hidden')
  document.addEventListener('visibilitychange', sync); sync()
}
export function useLite() {
  const [v, setV] = useState(isLite)
  useEffect(() => { const f = () => setV(isLite()); window.addEventListener('mutqan:perf', f); return () => window.removeEventListener('mutqan:perf', f) }, [])
  return v
}
