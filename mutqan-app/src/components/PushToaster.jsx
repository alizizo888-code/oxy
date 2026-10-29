import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { chime } from '../lib/alert'
import { useNotifySettings } from '../hooks/useNotifySettings'
import { setSoundConfig } from '../lib/push'

// In-app banner + sound for every incoming notification. High priority (new orders, tech requests) stays longer and rings louder.
export default function PushToaster() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const { settings } = useNotifySettings()
  const cfg = settings.sound
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg
  useEffect(() => { setSoundConfig(cfg) }, [cfg])
  useEffect(() => {
    const on = (e) => {
      const m = e.detail || {}
      const hi = m.priority === 'high'
      if (!m.silent) chime(hi ? 'high' : 'normal', cfgRef.current)
      const id = m.id || Math.random().toString(36).slice(2)
      setItems((l) => [{ ...m, id, hi }, ...l.filter((x) => x.id !== id)].slice(0, 3))
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), (hi ? cfgRef.current.highBannerSecs : cfgRef.current.bannerSecs) * 1000)
    }
    window.addEventListener('mutqan:push', on)
    return () => window.removeEventListener('mutqan:push', on)
  }, [])
  if (!items.length) return null
  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,0px)+8px)] inset-x-0 z-[80] flex flex-col gap-2 px-3 pointer-events-none" dir="rtl" data-keep-colors>
      {items.map((m) => (
        <div key={m.id} className={`pointer-events-auto max-w-md w-full mx-auto rounded-2xl shadow-2xl border flex items-start gap-3 p-3 ${m.hi ? 'bg-rose-600 border-rose-300 text-white' : 'bg-slate-900 border-white/10 text-white'}`}>
          <button className="flex-1 min-w-0 flex gap-3 text-right" onClick={() => { setItems((l) => l.filter((x) => x.id !== m.id)); if (m.url) navigate(String(m.url).replace(/^#/, '')) }}>
            <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${m.hi ? 'bg-white/20' : 'bg-white/10'}`}><Bell size={17} className={m.hi ? 'animate-pulse' : ''} /></span>
            <span className="min-w-0"><span className="block text-sm font-black truncate">{m.title}</span><span className="block text-xs opacity-90 line-clamp-2">{m.body}</span></span>
          </button>
          <button onClick={() => setItems((l) => l.filter((x) => x.id !== m.id))} className="shrink-0 opacity-70"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
