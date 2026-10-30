import { useEffect, useState } from 'react'
const KEY = 'mutqan_theme'
export function getTheme() { try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' } }
export function applyTheme(t) {
  const el = document.documentElement
  el.classList.toggle('dark', t === 'dark')
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#050b16' : '#071a33')
  try { localStorage.setItem(KEY, t) } catch { /* private mode */ }
}
export function useTheme() {
  const [t, setT] = useState(getTheme)
  useEffect(() => { applyTheme(t) }, [t])
  return [t, () => setT((x) => (x === 'dark' ? 'light' : 'dark'))]
}

// Staff screens (technician / operations / supervisor / owner) are dark by design. This switch lightens them with the same invert trick the customer app uses for its dark mode.
const SKEY = 'mutqan_staff_light'
export const getStaffLight = () => { try { return localStorage.getItem(SKEY) === '1' } catch { return false } }
export function useStaffTheme() {
  const [light, setLight] = useState(getStaffLight)
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove('dark')                       // the customer's dark class would invert the (already dark) staff UI the wrong way
    el.classList.toggle('staff-light', light)
    try { localStorage.setItem(SKEY, light ? '1' : '0') } catch { /* private mode */ }
    return () => { el.classList.remove('staff-light'); applyTheme(getTheme()) }
  }, [light])
  return [light, () => setLight((x) => !x)]
}
