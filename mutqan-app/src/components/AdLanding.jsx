import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAdLanding } from '../lib/adLanding'
import { SPECIALTIES } from '../constants'

// Route  /s/:spec  (the link used in paid ads for one specialty).
export function AdEntry() {
  const { spec } = useParams()
  const nav = useNavigate()
  const { enabled, loaded } = useAdLanding()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const ok = SPECIALTIES.some((s) => s.id === spec)
    if (!ok) { done.current = true; nav('/', { replace: true }); return }
    // give the setting a moment to load so the owner's switch is respected; never wait more than 900 ms
    const t = setTimeout(go, loaded ? 0 : 900)
    function go() { if (done.current) return; done.current = true; if (enabled) nav('/', { replace: true, state: { adGo: spec } }); else nav(`/new?specialty=${spec}&from=ad`, { replace: true }) }
    if (loaded) { clearTimeout(t); go() }
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, enabled, spec])
  return <div className="h-full flex items-center justify-center text-slate-400 text-sm" dir="rtl">جارِ التحميل…</div>
}

// Mounted in the client shell: when Home was opened by an ad link, show it for a beat and then open the chosen specialty (one-shot, so "back" never loops).
export function AdForward() {
  const loc = useLocation()
  const nav = useNavigate()
  const spec = loc.state && loc.state.adGo
  useEffect(() => {
    if (!spec || loc.pathname !== '/') return
    const t = setTimeout(() => { nav('/', { replace: true, state: null }); nav(`/new?specialty=${spec}&from=ad`) }, 650)
    return () => clearTimeout(t)
  }, [spec, loc.pathname, nav])
  return null
}
