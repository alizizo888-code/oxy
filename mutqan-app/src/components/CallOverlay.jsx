import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// Full-screen call card used by both sides. `stream` = remote audio, `phase` = connecting | ringing | live | ended | failed.
export default function CallOverlay({ title, subtitle, phase, stream, onHangup, onMute, note }) {
  const audio = useRef(null)
  const [sec, setSec] = useState(0)
  const [muted, setMuted] = useState(false)
  useEffect(() => { if (audio.current && stream) { audio.current.srcObject = stream; audio.current.play?.().catch(() => {}) } }, [stream])
  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => setSec((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [phase])
  const label = { connecting: 'جارِ التجهيز…', ringing: 'يرنّ… بانتظار رد مشرف العمليات', live: fmt(sec), ended: 'انتهت المكالمة', failed: 'تعذر الاتصال الصوتي' }[phase] || ''
  return (
    <div className="fixed inset-0 z-[100] bg-[#070b14]/95 backdrop-blur flex flex-col items-center justify-center gap-6 text-white" dir="rtl">
      <audio ref={audio} autoPlay playsInline />
      <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-sky-600 flex items-center justify-center text-4xl shadow-2xl">
        {phase === 'ringing' && <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />}
        <span className="relative">🎧</span>
      </div>
      <div className="text-center px-6">
        <p className="font-display font-black text-xl">{title}</p>
        {subtitle && <p className="text-sm text-slate-300 mt-1">{subtitle}</p>}
        <p className={`mt-3 text-sm font-bold ${phase === 'failed' ? 'text-rose-300' : 'text-emerald-300'} flex items-center gap-2 justify-center`}>{phase === 'connecting' && <Loader2 size={14} className="animate-spin" />}{label}</p>
        {note && <p className="mt-2 text-xs text-amber-300 max-w-xs">{note}</p>}
      </div>
      <div className="flex items-center gap-5">
        {phase === 'live' && (
          <button onClick={() => { const m = !muted; setMuted(m); onMute?.(m) }} aria-label="كتم" className={`w-14 h-14 rounded-full flex items-center justify-center ${muted ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        )}
        <button onClick={onHangup} aria-label="إنهاء" className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center shadow-lg active:scale-90"><PhoneOff size={26} /></button>
      </div>
    </div>
  )
}
