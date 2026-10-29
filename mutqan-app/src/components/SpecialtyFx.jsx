import { useMemo } from 'react'
import { fxOf } from '../lib/fx'
import { useLite } from '../lib/perf'

// Animated, themed background for one specialty: ice + cool light for AC, bubbles for plumbing, sparks for electric, etc.
// Pure CSS particles (cheap), pointer-events none, disabled by prefers-reduced-motion.
export default function SpecialtyFx({ id, count: want = 14, className = '', fixed = false, light = false }) {
  const lite = useLite()
  const count = typeof window !== 'undefined' && window.innerWidth < 768 ? Math.min(want, 8) : want
  const f = fxOf(id)
  const items = useMemo(() => Array.from({ length: count }, (_, i) => {
    const r = (n) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
    return { x: `${Math.round(r(1) * 96)}%`, y: `${Math.round(r(4) * 92)}%`, s: `${6 + Math.round(r(2) * (f.glyph ? 14 : 12))}px`, t: `${(f.theme === 'sparks' ? 1.6 : 5 + r(3) * 6).toFixed(1)}s`, d: `${(-r(5) * 9).toFixed(1)}s` }
  }), [count, id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (lite) return null
  return (
    <div aria-hidden="true" data-keep-colors className={`fx-layer fx-t-${f.theme} ${fixed ? 'fx-fixed' : ''} ${className}`} style={{ '--c1': f.c1, '--c2': light ? f.c1 : f.c2 }}>
      <span className="fx-glow" />
      <span className="fx-glow fx-glow-b" />
      {f.theme === 'scan' && <span className="fx-scanline" />}
      {f.theme === 'rays' && <span className="fx-sun" />}
      {f.theme === 'shine' && <span className="fx-sweep" />}
      {items.map((p, k) => (
        <span key={k} className="fx-p" style={{ '--x': p.x, '--y': p.y, '--s': p.s, '--t': p.t, '--d': p.d }}>{f.glyph}</span>
      ))}
    </div>
  )
}
