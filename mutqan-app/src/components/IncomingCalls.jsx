import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import CallOverlay from './CallOverlay'
import { useLiveShared } from '../lib/useLive'
import { CallSession, setCallStatus } from '../lib/hotline'
import { useHotlineConfig } from '../hooks/useHotline'
import { auth } from '../lib/auth'

// Operations side: rings (sound + notification) when a customer calls the hotline; answer/decline; talk inside the app.
function ringLoop() {
  let stop = false, ctx
  try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return () => {} }
  const beep = () => {
    if (stop) return
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.35)
    setTimeout(beep, 1400)
  }
  ctx.resume?.().finally(beep)
  return () => { stop = true; try { ctx.close() } catch { /* ignore */ } }
}

export default function IncomingCalls() {
  const { data } = useLiveShared('calls', { filters: { status: 'ringing' }, order: '-createdAt', limit: 5 })
  const cfg = useHotlineConfig()
  const [active, setActive] = useState(null)   // { id, name, phase, stream }
  const ref = useRef({ s: null })
  const fresh = (data || []).filter((c) => c.cSig?.sdp && Date.now() - new Date(c.createdAt).getTime() < 60000)
  const ringing = !active && fresh.length ? fresh[0] : null

  useEffect(() => {
    if (!ringing) return
    const stop = ringLoop()
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('📞 مكالمة واردة', { body: ringing.name || 'عميل', tag: 'hotline', requireInteraction: true }) } catch { /* ignore */ }
    return stop
  }, [ringing?.id])

  async function answer(c) {
    setActive({ id: c.id, name: c.name, phone: c.phone, phase: 'connecting' })
    try {
      const s = new CallSession({
        id: c.id, role: 'callee', turn: cfg.turn,
        onRemote: (stream) => setActive((a) => (a ? { ...a, stream } : a)),
        onState: (st) => {
          if (st === 'connected') setActive((a) => (a ? { ...a, phase: 'live' } : a))
          else if (['failed', 'ended', 'declined', 'missed'].includes(st)) { ref.current.s?.close(); setActive((a) => (a ? { ...a, phase: st === 'failed' ? 'failed' : 'ended' } : a)); setTimeout(() => setActive(null), 2500) }
        },
      })
      ref.current.s = s
      await s.startCallee(c)
      await setCallStatus(c.id, 'active', { answeredBy: auth.getCurrentUser()?.name || 'المشرف' })
    } catch { setActive({ id: c.id, name: c.name, phase: 'failed' }); setTimeout(() => setActive(null), 3000) }
  }
  const hang = () => { if (active) setCallStatus(active.id, 'ended').catch(() => {}); ref.current.s?.close(); setActive(null) }
  const decline = (c) => setCallStatus(c.id, 'declined').catch(() => {})
  useEffect(() => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ } }, [])
  useEffect(() => () => ref.current.s?.close(), [])

  if (active) return <CallOverlay title={active.name || 'عميل'} subtitle={active.phone} phase={active.phase} stream={active.stream} onHangup={hang} onMute={(m) => ref.current.s?.setMuted(m)} />
  if (!ringing) return null
  return (
    <div className="fixed z-[90] top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 w-[min(92vw,420px)] rounded-2xl bg-slate-900 border border-emerald-400/50 shadow-2xl shadow-emerald-500/20 p-3 flex items-center gap-3 text-white" dir="rtl">
      <span className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">📞</span>
      <div className="flex-1 min-w-0"><p className="font-black text-sm truncate">مكالمة واردة — {ringing.name || 'عميل'}</p><p className="text-[11px] text-slate-400" dir="ltr">{ringing.phone || 'الخط الساخن'}</p></div>
      <button onClick={() => decline(ringing)} aria-label="رفض" className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center"><PhoneOff size={18} /></button>
      <button onClick={() => answer(ringing)} aria-label="رد" className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center"><Phone size={18} /></button>
    </div>
  )
}
