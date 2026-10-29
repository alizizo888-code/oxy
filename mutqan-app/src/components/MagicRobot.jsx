import { useEffect, useRef, useState } from 'react'

// A "magic" 3D-looking robot assistant (pure SVG + CSS, no assets): floats, blinks, tilts toward the finger/cursor,
// waves and greets (typed speech bubble), and "thinks" with orbiting gears and rotating thoughts.
// mode: 'greet' | 'idle' | 'think'
const GREET = ['أهلًا بك في متقن! 👋', 'أنا مساعدك الذكي ✨', 'كيف أقدر أساعدك اليوم؟']
const THINK = ['أفكر…', 'أراجع الأسعار والخدمات…', 'أجهّز لك أفضل حل ✨']

function useTyped(lines, on, speed = 38, hold = 1400, loop = false) {
  const [out, setOut] = useState('')
  useEffect(() => {
    if (!on) { setOut(''); return }
    let i = 0; let j = 0; let t; let dead = false
    const tick = () => {
      if (dead) return
      const line = lines[i]
      if (j <= line.length) { setOut(line.slice(0, j)); j++; t = setTimeout(tick, speed) }
      else if (i < lines.length - 1 || loop) { t = setTimeout(() => { i = (i + 1) % lines.length; j = 0; tick() }, hold) }
    }
    tick()
    return () => { dead = true; clearTimeout(t) }
  }, [on, lines, speed, hold, loop])
  return out
}

export default function MagicRobot({ mode = 'idle', size = 180, bubble = true, className = '' }) {
  const ref = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const greet = mode === 'greet'; const think = mode === 'think'
  const text = useTyped(greet ? GREET : THINK, bubble && (greet || think), greet ? 38 : 45, greet ? 1500 : 1100, think)

  useEffect(() => {
    const move = (e) => {
      const el = ref.current; if (!el) return
      const r = el.getBoundingClientRect()
      const p = e.touches ? e.touches[0] : e
      const dx = (p.clientX - (r.left + r.width / 2)) / Math.max(200, window.innerWidth / 2)
      const dy = (p.clientY - (r.top + r.height / 2)) / Math.max(200, window.innerHeight / 2)
      setTilt({ x: Math.max(-1, Math.min(1, dy)) * -9, y: Math.max(-1, Math.min(1, dx)) * 12 })
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('touchmove', move) }
  }, [])

  return (
    <div className={`mr-wrap ${className}`} data-keep-colors style={{ ['--s']: `${size}px` }} dir="rtl">
      <style>{CSS}</style>
      {bubble && (greet || think) && (
        <div className={`mr-bubble ${think ? 'think' : ''}`} aria-live="polite">
          {think && <span className="mr-dots"><i /><i /><i /></span>}
          <span>{text}<b className="mr-caret" /></span>
        </div>
      )}
      <div ref={ref} className="mr-stage" style={{ width: size, height: size * 1.1, transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <svg viewBox="0 0 200 220" width="100%" height="100%" role="img" aria-label="مساعد متقن الذكي" className={`mr-float ${think ? 'is-think' : ''} ${greet ? 'is-greet' : ''}`}>
          <defs>
            <linearGradient id="mrBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#dbeafe" /><stop offset="1" stopColor="#93c5fd" /></linearGradient>
            <linearGradient id="mrHead" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#e0edff" /><stop offset="1" stopColor="#7fb2f5" /></linearGradient>
            <radialGradient id="mrVisor" cx=".5" cy=".35" r=".8"><stop offset="0" stopColor="#1e3a8a" /><stop offset="1" stopColor="#050b1f" /></radialGradient>
            <radialGradient id="mrEye" cx=".5" cy=".4" r=".6"><stop offset="0" stopColor="#e0ffff" /><stop offset=".5" stopColor="#22d3ee" /><stop offset="1" stopColor="#0891b2" /></radialGradient>
            <radialGradient id="mrCore" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff" /><stop offset=".4" stopColor="#67e8f9" /><stop offset="1" stopColor="#0ea5e9" stopOpacity="0" /></radialGradient>
            <radialGradient id="mrShadow"><stop offset="0" stopColor="#0f172a" stopOpacity=".35" /><stop offset="1" stopColor="#0f172a" stopOpacity="0" /></radialGradient>
            <filter id="mrGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <ellipse className="mr-shadow" cx="100" cy="212" rx="48" ry="7" fill="url(#mrShadow)" />
          <g className="mr-bob">
            {/* body */}
            <rect x="62" y="118" width="76" height="70" rx="26" fill="url(#mrBody)" stroke="#9cc3f5" strokeWidth="1.5" />
            <rect x="72" y="124" width="56" height="10" rx="5" fill="#fff" opacity=".6" />
            <circle className="mr-core" cx="100" cy="158" r="14" fill="url(#mrCore)" filter="url(#mrGlow)" />
            <circle cx="100" cy="158" r="5" fill="#fff" />
            {/* legs */}
            <rect x="76" y="184" width="16" height="16" rx="7" fill="#93c5fd" /><rect x="108" y="184" width="16" height="16" rx="7" fill="#93c5fd" />
            {/* left arm + magic wand */}
            <g className="mr-wand">
              <path d="M62 132 Q44 142 46 160" stroke="#bcd7fa" strokeWidth="11" strokeLinecap="round" fill="none" />
              <circle cx="46" cy="162" r="8" fill="#e8f1ff" />
              <line x1="44" y1="162" x2="30" y2="134" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round" />
              <path className="mr-star" d="M29 120 l3.2 7.2 7.8 .8 -5.9 5.2 1.8 7.7 -6.9 -4 -6.9 4 1.8 -7.7 -5.9 -5.2 7.8 -.8z" fill="#fde047" filter="url(#mrGlow)" />
            </g>
            {/* right arm (waves) */}
            <g className="mr-arm" style={{ transformOrigin: '138px 134px' }}>
              <path d="M138 132 Q158 134 160 114" stroke="#bcd7fa" strokeWidth="11" strokeLinecap="round" fill="none" />
              <circle cx="160" cy="110" r="9" fill="#e8f1ff" />
            </g>
            {/* head */}
            <g className="mr-head">
              <line x1="100" y1="34" x2="100" y2="22" stroke="#9cc3f5" strokeWidth="4" strokeLinecap="round" />
              <circle className="mr-ant" cx="100" cy="17" r="7" fill="#f472b6" filter="url(#mrGlow)" />
              <rect x="44" y="34" width="112" height="86" rx="34" fill="url(#mrHead)" stroke="#9cc3f5" strokeWidth="1.5" />
              <rect x="34" y="66" width="12" height="26" rx="6" fill="#93c5fd" /><rect x="154" y="66" width="12" height="26" rx="6" fill="#93c5fd" />
              <rect x="54" y="48" width="92" height="58" rx="24" fill="url(#mrVisor)" />
              <path d="M62 56 Q100 44 138 56" stroke="#fff" strokeOpacity=".25" strokeWidth="3" fill="none" strokeLinecap="round" />
              <g className="mr-eyes">
                <ellipse className="mr-eye" cx="80" cy="76" rx="9" ry="11" fill="url(#mrEye)" filter="url(#mrGlow)" />
                <ellipse className="mr-eye" cx="120" cy="76" rx="9" ry="11" fill="url(#mrEye)" filter="url(#mrGlow)" />
              </g>
              <path className="mr-mouth" d={think ? 'M90 94 Q100 92 110 94' : 'M88 92 Q100 103 112 92'} stroke="#67e8f9" strokeWidth="3" strokeLinecap="round" fill="none" />
              <circle cx="66" cy="92" r="4" fill="#f9a8d4" opacity=".55" /><circle cx="134" cy="92" r="4" fill="#f9a8d4" opacity=".55" />
            </g>
            {/* thinking gears */}
            {think && (
              <g>
                <g className="mr-gear" style={{ transformOrigin: '150px 30px' }}><circle cx="150" cy="30" r="10" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="5 3" /><circle cx="150" cy="30" r="3" fill="#38bdf8" /></g>
                <g className="mr-gear rev" style={{ transformOrigin: '170px 14px' }}><circle cx="170" cy="14" r="7" fill="none" stroke="#a78bfa" strokeWidth="3.5" strokeDasharray="4 3" /><circle cx="170" cy="14" r="2.2" fill="#a78bfa" /></g>
              </g>
            )}
          </g>
          {/* magic sparkles */}
          {[[24, 96, 0], [176, 70, .6], [30, 52, 1.1], [168, 130, 1.6], [100, 6, .3]].map(([x, y, d], i) => (
            <path key={i} className="mr-spark" style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }} d={`M${x} ${y - 6} L${x + 1.8} ${y - 1.8} L${x + 6} ${y} L${x + 1.8} ${y + 1.8} L${x} ${y + 6} L${x - 1.8} ${y + 1.8} L${x - 6} ${y} L${x - 1.8} ${y - 1.8}Z`} fill="#fde68a" />
          ))}
        </svg>
      </div>
    </div>
  )
}

const CSS = `
.mr-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;width:max-content;max-width:100%}
.mr-stage{transition:transform .25s ease-out;transform-style:preserve-3d;will-change:transform;filter:drop-shadow(0 14px 18px rgba(30,64,175,.25))}
.mr-float{overflow:visible}
.mr-bob{animation:mrBob 3.2s ease-in-out infinite}
.mr-shadow{transform-origin:100px 212px;animation:mrShad 3.2s ease-in-out infinite}
.mr-eye{transform-box:fill-box;transform-origin:center;animation:mrBlink 4.5s infinite}
.is-think .mr-eyes{animation:mrLook 2.4s ease-in-out infinite}
.is-think .mr-head{transform-origin:100px 120px;animation:mrTilt 2.6s ease-in-out infinite}
.is-greet .mr-arm{animation:mrWave .7s ease-in-out 0s 6 alternate}
.mr-arm{transform-box:view-box}
.mr-core{transform-box:fill-box;transform-origin:center;animation:mrPulse 1.8s ease-in-out infinite}
.mr-ant{animation:mrAnt 1.6s ease-in-out infinite}
.mr-star{transform-box:fill-box;transform-origin:center;animation:mrSpin 3s linear infinite}
.mr-wand{transform-origin:62px 132px;animation:mrWand 2.8s ease-in-out infinite}
.mr-spark{transform-box:view-box;animation:mrTwinkle 2.2s ease-in-out infinite;opacity:0}
.mr-gear{animation:mrSpin 2.4s linear infinite}.mr-gear.rev{animation-direction:reverse}
.mr-bubble{position:relative;background:#fff;border:1px solid #bfdbfe;color:#0f172a;border-radius:18px;padding:8px 14px;font-weight:800;font-size:13px;line-height:1.5;box-shadow:0 6px 18px rgba(59,130,246,.18);max-width:260px;min-height:22px;display:flex;align-items:center;gap:8px}
.mr-bubble:after{content:"";position:absolute;bottom:-7px;left:50%;margin-left:-7px;width:14px;height:14px;background:#fff;border-right:1px solid #bfdbfe;border-bottom:1px solid #bfdbfe;transform:rotate(45deg)}
.mr-bubble.think{color:#1d4ed8}
.mr-dots{display:inline-flex;gap:3px}.mr-dots i{width:6px;height:6px;border-radius:50%;background:#38bdf8;animation:mrDot 1s infinite}.mr-dots i:nth-child(2){animation-delay:.15s}.mr-dots i:nth-child(3){animation-delay:.3s}
.mr-caret{display:inline-block;width:2px;height:1em;background:#3b82f6;margin-right:2px;vertical-align:-2px;animation:mrCaret .8s steps(1) infinite}
@keyframes mrBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes mrShad{0%,100%{transform:scaleX(1);opacity:.9}50%{transform:scaleX(.82);opacity:.6}}
@keyframes mrBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes mrLook{0%,100%{transform:translate(0,0)}25%{transform:translate(5px,-5px)}60%{transform:translate(-5px,-4px)}}
@keyframes mrTilt{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}}
@keyframes mrWave{from{transform:rotate(-14deg)}to{transform:rotate(26deg)}}
@keyframes mrPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.25);opacity:1}}
@keyframes mrAnt{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@keyframes mrSpin{to{transform:rotate(360deg)}}
@keyframes mrWand{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(7deg)}}
@keyframes mrTwinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.15)}}
@keyframes mrDot{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
@keyframes mrCaret{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.mr-wrap *{animation:none!important}.mr-spark{opacity:.8}}
`
