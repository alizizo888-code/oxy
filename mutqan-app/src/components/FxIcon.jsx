import { useRef, useState } from 'react'
import { fxOf } from '../lib/fx'

// Icon chip with an idle animation (spin / drip / flash / shake …) and a particle burst on tap.
export default function FxIcon({ id, className = '', children, onPointerDown, burst = true }) {
  const f = fxOf(id)
  const [shots, setShots] = useState([])
  const n = useRef(0)
  function go(e) {
    onPointerDown?.(e)
    if (!burst) return
    const k = ++n.current
    setShots((s) => [...s, k])
    setTimeout(() => setShots((s) => s.filter((x) => x !== k)), 800)
  }
  return (
    <span onPointerDown={go} className={`fxi relative inline-flex ${className}`} style={{ '--c1': f.c1, '--c2': f.c2 }}>
      <span className={`fxi-in fxi-${f.idle} inline-flex items-center justify-center w-full h-full`}>{children}</span>
      {shots.map((k) => (
        <span key={k} aria-hidden="true" className="fxi-burst">
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg`, '--dist': `${26 + (i % 3) * 8}px` }}>{f.glyph && i % 2 ? f.glyph : ''}</i>)}
        </span>
      ))}
    </span>
  )
}
