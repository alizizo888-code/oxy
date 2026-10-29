import { useEffect, useState } from 'react'
import { CheckCircle2, ArrowLeft, Snowflake } from 'lucide-react'
import { SHOWCASE, BANNER_ORDER } from '../serviceShowcase'
import { iconFor } from '../serviceIcons'
import { artFor } from '../lib/specialtyArt'
import { useLiveShared } from '../lib/useLive'
import SpecialtyFx from './SpecialtyFx'
import FxIcon from './FxIcon'

// Home hero: the brand block stays fixed; the specialty photo, its icon and the
// service lines underneath rotate through every specialty.
export default function ServiceBanner({ onOpen }) {
  const slides = BANNER_ORDER.filter((id) => SHOWCASE[id])
  const [i, setI] = useState(0)
  const [failed, setFailed] = useState({})
  const [paused, setPaused] = useState(false)
  const [round, setRound] = useState(0)
  const { data: media } = useLiveShared('ac_media', { limit: 500 })
  const imagesOf = (sid) => [...(media || []).filter((m) => (m.specialty || 'ac') === sid && m.url).map((m) => ({ url: m.url, by: null })), ...SHOWCASE[sid].images, ...artFor(sid)]

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setI((x) => { const n = (x + 1) % slides.length; if (n === 0) setRound((r) => r + 1); return n }), 4500)
    return () => clearTimeout(t)
  }, [i, paused, slides.length])

  // Preload the next slide's photo so the switch is seamless
  useEffect(() => {
    const nid = slides[(i + 1) % slides.length]
    const list = imagesOf(nid)
    const nx = list[round % list.length]
    if (nx && !nx.url.startsWith('data:')) { const img = new Image(); img.src = nx.url }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, slides, round, media])

  const id = slides[i]
  const s = SHOWCASE[id]
  const list = imagesOf(id)
  const photo = list[(round + (failed[id + round] ? 1 : 0)) % list.length]

  return (
    <div
      data-keep-colors
      className="relative overflow-hidden rounded-[28px] shadow-xl shadow-blue-900/25 fade-up h-[19rem] md:h-80 bg-[#071a33] ring-1 ring-sky-400/20"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {!failed[id + round] ? (
        <img key={id} src={photo.url} alt={s.title} onError={() => setFailed((f) => ({ ...f, [id + round]: true }))} className="banner-in absolute inset-y-0 left-0 w-[78%] h-full object-cover opacity-90 [mask-image:linear-gradient(to_right,black_45%,transparent)]" />
      ) : (
        <div key={id} className="banner-in absolute inset-0 flex items-center justify-center text-7xl opacity-30">{s.icon}</div>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.35),transparent_45%),linear-gradient(to_left,#071a33_30%,rgba(7,26,51,0.55)_65%,rgba(7,26,51,0.05))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(125,211,252,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.6)_1px,transparent_1px)] [background-size:26px_26px]" />
      <SpecialtyFx key={id} id={id} count={16} className="opacity-90" />
      <span className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative h-full flex flex-col justify-between p-5 text-white">
        {/* Fixed brand */}
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-wider bg-white/10 backdrop-blur border border-sky-300/30 rounded-full px-2.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />مُتقن · MUTQAN</span>
          <div className="flex items-center gap-2 mt-1.5">
            <Snowflake size={24} className="text-sky-200" />
            <h1 className="font-display font-black text-3xl md:text-4xl tracking-wide drop-shadow">OXYGEN</h1>
          </div>
          <p className="font-display font-black text-sm md:text-base text-sky-200 w-fit mt-0.5">الصيانة والمقاولات العامة</p>
        </div>

        {/* Rotating specialty */}
        <div key={id}>
          <div className="flex items-center gap-2.5 line-in">
            <FxIcon id={id} className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${iconFor(id).g} text-white shadow-lg ring-2 ring-white/30`}>{(() => { const I = iconFor(id).Icon; return <I size={22} /> })()}</FxIcon>
            <p className="font-display font-black text-xl md:text-2xl drop-shadow">{s.title}</p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[92%]">
            {s.lines.map((l, k) => (
              <p key={l} className="line-in flex items-center gap-1 text-[11px] md:text-xs font-bold bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-2.5 py-1" style={{ animationDelay: `${120 + k * 110}ms` }}>
                <CheckCircle2 size={12} className="text-emerald-300 shrink-0" /> {l}
              </p>
            ))}
          </div>
          <button onClick={() => onOpen(id)} className="line-in mt-3 flex items-center gap-1.5 bg-gradient-to-l from-sky-400 to-blue-500 text-white font-display font-black rounded-full px-5 py-2 text-xs shadow-lg shadow-sky-500/40 active:scale-95 transition-transform" style={{ animationDelay: '450ms' }}>
            اطلب الخدمة <ArrowLeft size={13} />
          </button>
        </div>
      </div>

      <div className="absolute top-3 left-4 flex items-center gap-2" dir="ltr">
        <span className="text-[10px] font-black text-sky-200/90 tabular-nums">{String(i + 1).padStart(2, '0')}/{String(slides.length).padStart(2, '0')}</span>
        <span className="w-14 h-1 rounded-full bg-white/15 overflow-hidden"><span className="block h-full bg-sky-300 rounded-full transition-all duration-500" style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></span>
      </div>
      {photo.by && !failed[id + round] && <p className="absolute bottom-1.5 left-3 text-[8px] text-white/40">Photo: {photo.by} / Unsplash</p>}
    </div>
  )
}
