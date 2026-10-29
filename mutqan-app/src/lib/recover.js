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
// One automatic repair per session for the classic "old cached file after a new release" failure.
export function autoRepairOnce(reason) {
  try { if (sessionStorage.getItem('mutqan_repaired')) return false; sessionStorage.setItem('mutqan_repaired', '1') } catch { return false }
  logError(reason, 'auto-repair'); hardRefresh(); return true
}
