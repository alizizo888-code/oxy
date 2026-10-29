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
