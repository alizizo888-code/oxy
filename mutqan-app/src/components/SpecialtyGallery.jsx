import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { showcaseFor } from '../serviceShowcase'
import { SPECIALTIES } from '../constants'
import { useSpecialtyImages } from '../hooks/useSpecialtyImages'
import { useLite } from '../lib/perf'

// Inner specialty header: its own photos rotate, and it switches as soon as the
// customer picks a different service.
export default function SpecialtyGallery({ specialtyId }) {
  const s0 = showcaseFor(specialtyId)
  const all = useSpecialtyImages(specialtyId)
  const s = s0 && { ...s0, images: all }
  const [i, setI] = useState(0)
  const [failed, setFailed] = useState({})
  const [hold, setHold] = useState(0)
  const strip = useRef(null)
  const lite = useLite()

  useEffect(() => { setI(0) }, [specialtyId])
  useEffect(() => {
    if (!s || s.images.length < 2) return
    const t = setTimeout(() => setI((x) => (x + 1) % s.images.length), hold > Date.now() ? 9000 : 3800)
    return () => clearTimeout(t)
  }, [i, s, hold])
  useEffect(() => {
    const el = strip.current?.children?.[i]
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [i])

  if (!s) return null
  const photo = s.images[i % s.images.length]
  const key = `${specialtyId}-${i}`
  const spec = SPECIALTIES.find((x) => x.id === specialtyId)

  const pick = (k) => { setI(k); setHold(Date.now() + 9000) }
  const count = s.images.length
  return (
    <div className="flex flex-col gap-2">
    <div className="relative overflow-hidden rounded-3xl h-44 md:h-56 shadow-md bg-gradient-to-br from-sky-500 to-blue-700 fade-up">
      {!failed[key] ? (
        <img key={key} src={photo.url} alt={s.title} onError={() => { setFailed((f) => ({ ...f, [key]: true })); setTimeout(() => setI((x) => (x + 1) % s.images.length), 50) }} className="banner-in absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-30">{s.icon}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-950/85 via-blue-900/30 to-transparent" />
      <div key={specialtyId} className="absolute bottom-0 inset-x-0 p-4 text-white">
        <div className="flex items-center gap-2 line-in">
          <span className="w-9 h-9 rounded-xl bg-white text-xl flex items-center justify-center shadow">{s.icon}</span>
          <div>
            <p className="font-display font-black text-lg leading-tight drop-shadow">{s.title}</p>
            {spec?.desc && <p className="text-[10px] text-white/75">{spec.desc}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
          {s.lines.map((l, k) => (
            <span key={l} className="line-in flex items-center gap-1 text-[11px] font-bold" style={{ animationDelay: `${100 + k * 90}ms` }}>
              <CheckCircle2 size={12} className="text-emerald-300" /> {l}
            </span>
          ))}
        </div>
      </div>
      {count > 1 && (
        <>
          <span className="absolute top-3 right-3 text-[10px] font-black tabular-nums bg-black/35 backdrop-blur rounded-full px-2 py-0.5 text-white">{(i % count) + 1} / {count}</span>
          <button onClick={() => pick((i + count - 1) % count)} aria-label="السابقة" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white text-lg flex items-center justify-center active:scale-90">›</button>
          <button onClick={() => pick((i + 1) % count)} aria-label="التالية" className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white text-lg flex items-center justify-center active:scale-90">‹</button>
        </>
      )}
      {photo.by && !failed[key] && <p className="absolute top-2.5 left-3 text-[8px] text-white/70">Photo: {photo.by} / Unsplash</p>}
    </div>
    {count > 1 && !lite && (
      <div ref={strip} className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x" dir="rtl">
        {s.images.slice(0, 40).map((im, k) => (Math.abs(k - (i % count)) > 6 ? <span key={k} className="shrink-0 w-16 h-11 rounded-xl bg-slate-200/60" onClick={() => pick(k)} /> : (
          <button key={k} onClick={() => pick(k)} aria-label={`صورة ${k + 1}`} className={`shrink-0 snap-center w-16 h-11 rounded-xl overflow-hidden border-2 transition-all ${k === i % count ? 'border-primary scale-105 shadow' : 'border-transparent opacity-70'}`}>
            <img src={im.url} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }} className="w-full h-full object-cover" />
          </button>
        )))}
      </div>
    )}
    </div>
  )
}
