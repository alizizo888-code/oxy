import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'

// Pages that already show the bottom tab bar (with its own Home tab), the Home screen itself, and staff screens.
const SHELL = ['/', '/services', '/offers', '/store', '/orders', '/account', '/calculator', '/more', '/articles']
const HIDE = ['/staff', '/join-tech', '/notifications']

// Bottom "Home" button on every customer page/specialty outside the tab bar. Press → circular colour wipe from the button, jump to Home, wipe fades out.
export default function HomeFab() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const btn = useRef(null)
  const [fx, setFx] = useState(null) // { x, y, phase }
  if (SHELL.includes(pathname) || HIDE.some((p) => pathname.startsWith(p))) return null
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const go = () => {
    if (fx) return
    if (reduce) { nav('/'); return }
    const r = btn.current?.getBoundingClientRect()
    setFx({ x: r ? r.left + r.width / 2 : innerWidth / 2, y: r ? r.top + r.height / 2 : innerHeight - 40, phase: 'pre' })
    requestAnimationFrame(() => requestAnimationFrame(() => setFx((f) => f && { ...f, phase: 'in' })))
    setTimeout(() => { nav('/'); setFx((f) => f && { ...f, phase: 'out' }) }, 420)
    setTimeout(() => setFx(null), 900)
  }
  const R = Math.hypot(Math.max(fx?.x || 0, innerWidth - (fx?.x || 0)), Math.max(fx?.y || 0, innerHeight - (fx?.y || 0))) + 20
  return (
    <>
      <button ref={btn} onClick={go} aria-label="الرئيسية" data-keep-colors
        className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-2 rounded-full bg-primary text-white font-black text-sm px-6 py-3 shadow-xl shadow-primary/30 active:scale-95 transition-transform">
        <Home size={18} /> الرئيسية
      </button>
      {fx && (
        <div aria-hidden className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center text-white"
          style={{ background: 'rgb(var(--color-primary))', clipPath: `circle(${fx.phase === 'in' ? R : 0}px at ${fx.x}px ${fx.y}px)`, transition: fx.phase === 'pre' ? 'none' : `clip-path ${fx.phase === 'in' ? 420 : 460}ms ease-in-out` }}>
          <Home size={56} className="opacity-90" style={{ transform: fx.phase === 'in' ? 'scale(1)' : 'scale(.6)', transition: 'transform .45s ease' }} />
        </div>
      )}
    </>
  )
}
