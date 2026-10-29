import { lazy } from 'react'
import { autoRepairOnce } from './recover'

// lazy() that survives a new release: retry once, then silently refresh to the new build (the Suspense loader stays on screen meanwhile).
export const lazyRetry = (load) => lazy(() => load()
  .catch(() => new Promise((r) => setTimeout(r, 500)).then(load))
  .catch((e) => (autoRepairOnce('chunk-load') ? new Promise(() => {}) : Promise.reject(e))))
