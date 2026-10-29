import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initPerf } from './lib/perf'
import { logError, autoRepairOnce, CHUNK_RE } from './lib/recover'
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); autoRepairOnce('preload') })
import './index.css'
import { auth } from './lib/auth'
import { startInbox } from './lib/push'
import { registerServiceWorker } from './lib/install'

initPerf()
registerServiceWorker()
window.addEventListener('error', (e) => { logError(e.error || e.message, 'window'); if (CHUNK_RE.test(String(e.message))) autoRepairOnce('chunk-load') })
window.addEventListener('unhandledrejection', (e) => { logError(e.reason, 'promise'); if (CHUNK_RE.test(String(e.reason?.message))) autoRepairOnce('chunk-load') })
auth.refresh()
startInbox()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
)

// Boot splash: keep it for a short, fixed beat so it reads as an app launch, then fade out.
try { clearTimeout(window.__mqWatch) } catch { /* ignore */ }
const splash = document.getElementById('boot-splash')
if (splash) {
  setTimeout(() => {
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 400)
  }, 950)
}
