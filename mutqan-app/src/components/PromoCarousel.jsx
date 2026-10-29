import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSpecialtyImages } from '../hooks/useSpecialtyImages'
import { iconFor } from '../serviceIcons'
import { promoArt } from '../lib/promoArt'
import SpecialtyFx from './SpecialtyFx'
const FXK = { warranty: 'locks', parts: 'appliances', contract: 'corporate', field: 'general', emergency: 'electric', hotel: 'corporate', restaurant: 'fridge', mosque: 'solar', factory: 'appliances', company: 'corporate' }
import { useLiveShared } from '../lib/useLive'

// Offer carousel: every slide belongs to a specialty and shows that specialty's own photos, cross-fading while the slide is active.
function useKindImages(kind) {
  const { data: media } = useLiveShared('ac_media', { limit: 500 })
  const own = (media || []).filter((m) => m.specialty === `promo_${kind}` && m.url).map((m) => ({ url: m.url }))
  return [...own, ...promoArt(kind)]
}
function SlideBg({ sid, kind, active }) {
  const bySpec = useSpecialtyImages(sid)
  const byKind = useKindImages(kind || 'company')
  const imgs = kind ? byKind : bySpec
  const [k, setK] = useState(0)
  const [bad, setBad] = useState({})
  useEffect(() => {
    if (!active || imgs.length < 2) return
    const t = setInterval(() => setK((x) => x + 1), 2400)
    return () => clearInterval(t)
  }, [active, imgs.length])
  const list = imgs.filter((_, i) => !bad[i])
  const cur = list.length ? list[k % list.length] : null
  const Icon = iconFor(sid)?.Icon
  return (
    <>
      {cur ? (
        <img key={cur.url} src={cur.url} alt="" loading="lazy" onError={() => setBad((b) => ({ ...b, [imgs.indexOf(cur)]: true }))}
          className="xfade absolute inset-y-0 left-0 w-[70%] h-full object-cover opacity-80 [mask-image:linear-gradient(to_right,black_40%,transparent)]" />
      ) : Icon ? (
        <Icon size={90} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" />
      ) : null}
    </>
  )
}

export default function PromoCarousel({ slides, delay = 120 }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length
  useEffect(() => {
    if (paused || n < 2) return
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6500)
    return () => clearTimeout(t)
  }, [i, paused, n])
  return (
    <div data-keep-colors className="relative overflow-hidden rounded-[28px] shadow-xl shadow-blue-900/20 ring-1 ring-sky-400/20 fade-up" style={{ animationDelay: `${delay}ms` }}
      onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }} dir="ltr">
        {slides.map((s, k) => (
          <div key={s.id || k} dir="rtl" className="w-full shrink-0 relative bg-gradient-to-l from-[#0b3b73] via-[#0a2a55] to-[#071a33] p-5 text-white min-h-[170px] overflow-hidden">
            <SlideBg sid={s.sid} kind={s.kind} active={k === i} />
            {k === i && <SpecialtyFx id={FXK[s.kind] || s.sid} count={12} />}
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,#071a33_32%,rgba(7,26,51,.55)_66%,rgba(7,26,51,.05))]" />
            <span className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(125,211,252,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.7)_1px,transparent_1px)] [background-size:24px_24px]" />
            <div className="relative">
              <span className="inline-block text-[10px] font-bold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 mb-2">{s.badge}</span>
              <h2 className="font-display font-black text-2xl md:text-3xl leading-tight drop-shadow">{s.title}</h2>
              <p className="text-[11px] text-white/85 mt-1 leading-relaxed max-w-[75%]">{s.sub}</p>
              <button onClick={s.go} className="mt-3 flex items-center gap-1.5 bg-gradient-to-l from-sky-400 to-blue-500 text-white font-display font-black rounded-full px-5 py-2 text-xs shadow-lg shadow-sky-500/40 active:scale-95 transition-transform">
                {s.cta}<ArrowLeft size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setI((x) => (x + n - 1) % n)} aria-label="السابق" className="hidden md:flex absolute right-1 bottom-2 w-7 h-7 rounded-full bg-white/20 backdrop-blur items-center justify-center"><ChevronRight size={16} className="text-white" /></button>
      <button onClick={() => setI((x) => (x + 1) % n)} aria-label="التالي" className="hidden md:flex absolute left-1 bottom-2 w-7 h-7 rounded-full bg-white/20 backdrop-blur items-center justify-center"><ChevronLeft size={16} className="text-white" /></button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {slides.map((_, k) => <button key={k} aria-label={`شريحة ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${i === k ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
      </div>
    </div>
  )
}
