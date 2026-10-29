import { useEffect, useState, useCallback } from 'react'

// Install-as-app helper: Android/desktop Chrome give a real install prompt; iPhone needs "Add to Home Screen".
let deferred = null
const subs = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()) })
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
const ua = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '')
export const isIOS = () => /iPad|iPhone|iPod/.test(ua()) || (/Macintosh/.test(ua()) && typeof document !== 'undefined' && 'ontouchend' in document)
export const isAndroid = () => /Android/i.test(ua())
export const isIOSSafari = () => isIOS() && /Safari/i.test(ua()) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua())

export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  const install = useCallback(async () => {
    if (!deferred) return 'unavailable'
    deferred.prompt()
    const r = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }))
    deferred = null; subs.forEach((f) => f())
    return r.outcome
  }, [])
  return { canPrompt: !!deferred, installed: isStandalone(), ios: isIOS(), iosSafari: isIOSSafari(), android: isAndroid(), install }
}

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const base = (window.__MUTQAN__?.app ? new URL(window.__MUTQAN__.app).pathname : '/app/')
  if (!location.pathname.startsWith(base) && location.pathname !== '/') return
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'goto' && e.data.url) location.hash = e.data.url })
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  // A new app version took over: reload once so web and installed app always run the same code.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')
    if (!typing) location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((reg) => {
      setInterval(() => reg.update().catch(() => {}), 10 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
    }).catch(() => {})
  })
}
