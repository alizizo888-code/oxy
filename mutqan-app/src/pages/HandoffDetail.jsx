import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Send, CheckCircle2, MapPin, Phone, User, Sparkles, ExternalLink, Loader2 } from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { team } from '../lib/team'
import { useLiveShared } from '../lib/useLive'
import { useTeamRole } from '../hooks/useTeamRole'
import { specialtyLabel } from '../constants'
import { escalationLabel } from '../workflow'

// The human agent's view of a conversation MUTQAN AI handed off —
// full context (customer, order, AI summary, intent, price, location, history) + live reply.
export default function HandoffDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, isOwner, loading: roleLoading } = useTeamRole()
  const { data: rows, loading } = useLiveShared('handoffs', { order: '-createdAt', limit: 100 })
  const h = rows.find((r) => r.id === id)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const [gid, setGid] = useState(null)
  useEffect(() => { team.groupId().then(setGid).catch(() => {}) }, [])
  const me = auth.getCurrentUser()
  const agentName = me?.displayName || (isOwner ? 'المالك' : 'موظف العمليات')

  const thread = h
    ? [
        ...(h.conversation || []).map((m) => ({ ...m, src: m.role === 'user' ? 'customer' : 'ai' })),
        ...(h.replies || []).map((r) => ({ role: r.from, content: r.text, at: r.at, src: r.from, agentName: r.agentName })),
      ].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0))
    : []

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread.length])

  const allowed = isOwner || role === 'operations' || role === 'owner' || role === 'supervisor'
  if (roleLoading || loading) return <Centered>جارِ التحميل…</Centered>
  if (!allowed) return <Centered>لا تملك صلاحية الوصول</Centered>
  if (!h) return <Centered>المحادثة غير موجودة</Centered>

  async function reply() {
    const t = text.trim()
    if (!t) return
    setBusy(true)
    setError('')
    try {
      await db.updateShared('handoffs', h.id, {
        replies: [...(h.replies || []), { from: 'agent', agentName, text: t, at: new Date().toISOString() }],
        status: 'claimed',
        agentName: h.agentName || agentName,
        claimedAt: h.claimedAt || new Date().toISOString(),
      }, gid || undefined)
      setText('')
    } catch {
      setError('تعذر إرسال الرد')
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    setBusy(true)
    try {
      await db.updateShared('handoffs', h.id, { status: 'closed', closedAt: new Date().toISOString() }, gid || undefined)
      navigate('/staff/operations')
    } catch {
      setError('تعذر إغلاق المحادثة')
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#090c14]" dir="rtl">
      <header className="shrink-0 bg-[#090c14]/95 border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-5xl mx-auto w-full px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-400 font-bold">محادثة محوّلة من MUTQAN AI</p>
            <h1 className="font-display font-black text-white truncate">{h.customerName}</h1>
          </div>
          {h.status !== 'closed' && (
            <button onClick={close} disabled={busy} className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-2">
              <CheckCircle2 size={14} /> إغلاق
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full px-4 py-4 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
          {/* Context panel */}
          <aside className="md:order-2 flex flex-col gap-3">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-amber-300 text-xs font-black flex items-center gap-1.5 mb-1.5"><Sparkles size={13} /> ملخص AI</p>
              <p className="text-slate-200 text-xs leading-relaxed">{h.summary}</p>
              {h.reason && (
                <p className={`text-[11px] font-black mt-2 ${h.priority === 'high' ? 'text-rose-300' : 'text-amber-300'}`}>
                  سبب التحويل: {escalationLabel(h.reason)}{h.priority === 'high' ? ' · أولوية عالية' : ''}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-2"><b className="text-slate-300">النية:</b> {h.intent || '—'} · <b className="text-slate-300">الحالة المزاجية:</b> {h.mood || '—'}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-2 text-xs text-slate-300">
              <Row icon={<User size={13} />}>{h.customerName} {h.customerVerified ? '· موثّق ✅' : '· زائر'}</Row>
              {h.customerPhone && <Row icon={<Phone size={13} />}><a href={`tel:${h.customerPhone}`} dir="ltr" className="text-primary">{h.customerPhone}</a></Row>}
              {h.customerEmail && <Row icon={<span className="text-[11px]">@</span>}><span dir="ltr">{h.customerEmail}</span></Row>}
              <Row icon={<span>🛠️</span>}>{h.service ? specialtyLabel(h.service) : 'الخدمة غير محددة'}</Row>
              {h.draft?.problem && <Row icon={<span>📝</span>}>{h.draft.problem}</Row>}
              {h.price && (
                <Row icon={<span>💰</span>}>
                  {h.price.low === h.price.high ? `${h.price.low} ر.س` : `${h.price.low} – ${h.price.high} ر.س`}
                  {h.price.list && h.price.list > h.price.low ? ` (السعر الرسمي ${h.price.list} — وصل التفاوض لهذا السعر)` : ' (من محرك الأسعار)'}
                </Row>
              )}
              {(h.location || h.locationText) && (
                <Row icon={<MapPin size={13} />}>
                  {h.location?.lat ? (
                    <a href={`https://maps.google.com/?q=${h.location.lat},${h.location.lng}`} target="_blank" rel="noreferrer" className="text-primary">
                      {h.location.address || h.locationText || 'فتح الموقع'}
                    </a>
                  ) : h.locationText}
                </Row>
              )}
              {h.orderId && (
                <button onClick={() => navigate(`/staff/order/${h.orderId}`)} className="mt-1 flex items-center justify-center gap-1 bg-white/5 border border-white/10 rounded-xl py-2 font-bold text-white">
                  <ExternalLink size={13} /> فتح الطلب المرتبط
                </button>
              )}
            </div>
          </aside>

          {/* Conversation */}
          <section className="md:order-1 flex flex-col gap-2">
            {thread.map((m, i) => (
              <div key={i} className={`flex ${m.src === 'customer' || m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.src === 'customer' || m.role === 'user'
                      ? 'bg-white/10 text-slate-100'
                      : m.src === 'agent'
                        ? 'bg-primary text-black font-bold'
                        : 'bg-sky-500/15 border border-sky-500/20 text-sky-100'
                  }`}
                >
                  <p className="text-[9px] opacity-70 mb-0.5 font-bold">
                    {m.src === 'customer' || m.role === 'user' ? 'العميل' : m.src === 'agent' ? `🎧 ${m.agentName || 'الموظف'}` : '🤖 MUTQAN AI'}
                  </p>
                  {m.audioUrl && <audio src={m.audioUrl} controls className="h-8 w-44 max-w-full mb-1" />}
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </section>
        </div>
      </div>

      {h.status !== 'closed' ? (
        <div className="shrink-0 border-t border-white/10 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)]">
          <div className="max-w-5xl mx-auto w-full">
            {error && <p className="text-rose-400 text-[11px] font-bold text-center mb-1">{error}</p>}
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && reply()}
                placeholder="اكتب ردك للعميل…"
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
              />
              <button onClick={reply} disabled={busy || !text.trim()} className="w-11 h-11 rounded-full bg-primary text-black flex items-center justify-center disabled:opacity-40 shrink-0">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-scale-x-100" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="shrink-0 text-center text-slate-500 text-xs py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">تم إغلاق هذه المحادثة</p>
      )}
    </div>
  )
}

function Row({ icon, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-500 mt-0.5 shrink-0 w-4 flex justify-center">{icon}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
