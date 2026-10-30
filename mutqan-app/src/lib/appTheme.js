import { useCallback, useEffect, useMemo, useState } from 'react'
import { PALETTES } from './palettes'
import { useLiveShared } from './useLive'
import { db } from './db'
import { team } from './team'

// Colour themes. The id "winter" re-uses the brand's own colours and adds the snowy backdrop (reference design);
// "default" = the brand look. Anything else overrides the sky/blue scales through CSS variables.
export const THEMES = {
  default: { name: 'الافتراضي', icon: '🎨', hint: 'هوية التطبيق الأصلية' },
  winter: { name: 'شتوي ثلجي', icon: '❄️', hint: 'خلفية ثلجية وأزرق جليدي',
    sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
    blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' } },
  ...PALETTES,
}
export const THEME_IDS = Object.keys(THEMES)
const KEY = 'mq_palette'
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}` }
const VARNAMES = []
for (const g of ['sky', 'blue']) for (const s of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) VARNAMES.push(`--${g}-${s}`)

export function applyPalette(id) {
  const el = document.documentElement
  const t = THEMES[id] || THEMES.default
  for (const v of VARNAMES) el.style.removeProperty(v)
  el.style.removeProperty('--color-primary'); el.style.removeProperty('--color-secondary')
  if (t.sky && t.blue) {
    for (const [g, scale] of [['sky', t.sky], ['blue', t.blue]]) for (const [s, hex] of Object.entries(scale)) el.style.setProperty(`--${g}-${s}`, hex2rgb(hex))
    el.style.setProperty('--color-primary', hex2rgb(t.sky[600])); el.style.setProperty('--color-secondary', hex2rgb(t.blue[900]))
  }
  if (id && id !== 'default') el.setAttribute('data-palette', id); else el.removeAttribute('data-palette')
}
export const getLocalPalette = () => { try { const v = localStorage.getItem(KEY); return THEMES[v] ? v : '' } catch { return '' } }
const setLocalPalette = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY) } catch { /* private mode */ } }

// Owner default for everybody (public `pricing` row `app_theme`) + the person's own choice (this device).
export function useAppTheme() {
  const { data } = useLiveShared('pricing', { limit: 100 })
  const shared = useMemo(() => { const id = (data || []).find((r) => (r.serviceId || r.id) === 'app_theme')?.themeId; return THEMES[id] ? id : 'default' }, [data])
  const [mine, setMine] = useState(getLocalPalette)
  const active = mine || shared
  const choose = useCallback((id) => { setLocalPalette(id); setMine(id) }, [])
  const setShared = useCallback(async (id) => {
    const gid = await team.groupId()
    await db.upsertShared('pricing', { serviceId: 'app_theme', themeId: id, updatedAt: new Date().toISOString() }, 'app_theme', { groupId: gid, writableBy: 'admins' })
  }, [])
  return { active, mine, shared, choose, setShared }
}

// Mounted once at the app root: applies the active theme.
export function ThemeBoot() {
  const { active } = useAppTheme()
  useEffect(() => { applyPalette(active) }, [active])
  return null
}
// Apply the saved choice immediately at start-up (before data arrives) to avoid a colour flash.
try { applyPalette(getLocalPalette()) } catch { /* ignore */ }
