// Self-healing helpers: when something breaks (stale cache after an update, a crashed screen) the user gets a one-tap fix instead of a white page.
export const lastError = () => { try { return localStorage.getItem('mutqan_last_error') || '' } catch { return '' } }
export function logError(e, where = '') {
  try { localStorage.setItem('mutqan_last_error', `${new Date().toISOString().slice(0, 16)} ${where} ${String(e?.message || e).slice(0, 300)}`) } catch { /* ignore */ }
}
export async function hardRefresh() {
  try { const regs = await navigator.serviceWorker?.getRegistrations?.(); await Promise.all((regs || []).map((r) => r.unregister())) } catch { /* ignore */ }
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))) } catch { /* ignore */ }
  const u = new URL(location.href); u.searchParams.set('r', String(Date.now()))
  location.replace(u.toString())
}
// Automatic repair for the classic "old cached file after a new release" failure (a lazy chunk whose hash no longer exists).
// Loop-safe: at most 3 automatic repairs per 5 minutes; returns true when a repair was started (the caller should stay silent).
export const CHUNK_RE = /Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|Unable to preload|module script/i
export function autoRepairOnce(reason) {
  try {
    const now = Date.now()
    const list = JSON.parse(sessionStorage.getItem('mq_repairs') || '[]').filter((t) => now - t < 5 * 60 * 1000)
    if (list.length >= 3) return false
    list.push(now); sessionStorage.setItem('mq_repairs', JSON.stringify(list))
  } catch { /* storage blocked: still try once per page load */ if (window.__mqRepaired) return false }
  window.__mqRepaired = true
  logError(reason, 'auto-repair'); hardRefresh(); return true
}
