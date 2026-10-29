import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Send, Plus, QrCode, KeyRound, RefreshCw, LogOut, Bot, MessageCircle, Settings2, Loader2, Search, ArrowRight, Copy, Trash2, CheckCheck, UserRound } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { useTeamRole } from '../hooks/useTeamRole'
import { waApi, useWaSessions, DEFAULT_BOT, saveBot } from '../hooks/useWa'
import { auth } from '../lib/auth'
import { StickyNote, Zap, CheckCircle2, Tag, Clock } from 'lucide-react'

const STATUS = {
  open: ['متصل', 'bg-emerald-500/20 text-emerald-300'],
  qr: ['بانتظار مسح QR', 'bg-amber-500/20 text-amber-300'],
  code: ['بانتظار إدخال الكود', 'bg-amber-500/20 text-amber-300'],
  connecting: ['جارِ الاتصال…', 'bg-sky-500/20 text-sky-300'],
  closed: ['منقطع — يعيد المحاولة', 'bg-rose-500/20 text-rose-300'],
  logged_out: ['تم تسجيل الخروج', 'bg-rose-500/20 text-rose-300'],
  stopped: ['متوقف', 'bg-slate-500/20 text-slate-300'],
}
const stat = (s) => STATUS[s] || STATUS.stopped
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary'
const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const dayLabel = (iso) => { try { return new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) } catch { return '' } }

export default function WaInbox() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const [tab, setTab] = useState('inbox')
  const sess = useWaSessions(tab === 'numbers' ? 3000 : 15000)
  const { data: threads } = useLiveShared('wa_threads', { order: '-lastAt', limit: 300 })
  const unread = useMemo(() => (threads || []).reduce((a, t) => a + (t.unread || 0), 0), [threads])
  const allowed = isOwner || role === 'operations'
  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <Centered>صندوق الواتساب للمالك ومشرف العمليات فقط</Centered>

  return (
    <div className="h-full flex flex-col bg-[#090c14]" dir="rtl">
      <header className="shrink-0 border-b border-white/10 pt-[env(safe-area-inset-top,0px)] bg-[#090c14]/95">
        <div className="max-w-6xl mx-auto w-full px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><ChevronRight size={18} className="text-slate-300" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-emerald-400 font-bold tracking-widest">WHATSAPP HUB</p>
            <h1 className="font-display text-lg font-black text-white">صندوق الواتساب الموحّد</h1>
          </div>
        </div>
        <div className="max-w-6xl mx-auto w-full px-4 flex gap-1.5 pb-2">
          {[['inbox', 'المحادثات', MessageCircle, unread], ['numbers', 'الأرقام', QrCode, 0], ['bot', 'البوت', Bot, 0]].map(([id, label, Icon, n]) => (
            <button key={id} onClick={() => setTab(id)} className={`relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black border ${tab === id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>
              <Icon size={14} /> {label}
              {n > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center px-1">{n}</span>}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 min-h-0">
        {tab === 'inbox' && <Inbox sessions={sess.sessions} threads={threads || []} goNumbers={() => setTab('numbers')} />}
        {tab === 'numbers' && <Numbers sess={sess} isOwner={isOwner} />}
        {tab === 'bot' && <BotSettings />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ inbox */
function Inbox({ sessions, threads, goNumbers }) {
  const navigate = useNavigate()
  const [acct, setAcct] = useState('all')
  const [q, setQ] = useState('')
  const [view, setView] = useState('all')   // all | unread | mine | open | done
  const [sel, setSel] = useState(null)
  const me = auth.getCurrentUser()?.id
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  const label = (id) => sessions.find((s) => s.id === id)?.label || id
  const list = useMemo(() => threads.filter((t) => (acct === 'all' || t.accountId === acct)
    && (!q || `${t.name || ''} ${t.phone}`.includes(q))
    && (view === 'all' || (view === 'unread' && t.unread > 0) || (view === 'mine' && t.assignee?.id === me) || (view === 'open' && t.status !== 'done') || (view === 'done' && t.status === 'done'))), [threads, acct, q, view, me])
  const counts = useMemo(() => ({ unread: threads.filter((t) => t.unread > 0).length, open: threads.filter((t) => t.status !== 'done').length }), [threads])
  const waitMin = (t) => (t.lastDir === 'in' && t.status !== 'done' ? Math.floor((Date.now() - new Date(t.lastAt).getTime()) / 60000) : 0)
  const th = threads.find((t) => t.id === sel)

  return (
    <div className="h-full max-w-6xl mx-auto w-full flex">
      <aside className={`${th ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] shrink-0 flex-col border-l border-white/10 min-h-0`}>
        <div className="p-3 flex flex-col gap-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute top-3 right-3 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرقم" className={`${inputCls} pr-9`} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {[['all', 'الكل'], ['unread', `غير مقروء (${counts.unread})`], ['mine', 'محادثاتي'], ['open', `مفتوحة (${counts.open})`], ['done', 'منتهية']].map(([id, l]) => <Chip key={id} on={view === id} onClick={() => setView(id)}>{l}</Chip>)}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip on={acct === 'all'} onClick={() => setAcct('all')}>كل الأرقام</Chip>
            {sessions.map((s) => <Chip key={s.id} on={acct === s.id} onClick={() => setAcct(s.id)}><span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${s.status === 'open' ? 'bg-emerald-400' : 'bg-rose-400'}`} />{s.label}</Chip>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-10 px-6">
              لا توجد محادثات بعد.
              {sessions.length === 0 && <button onClick={goNumbers} className="block mx-auto mt-3 text-primary font-bold">اربط أول رقم ←</button>}
            </div>
          ) : list.map((t) => (
            <button key={t.id} onClick={() => { setSel(t.id); if (t.unread) db.updateShared('wa_threads', t.id, { unread: 0 }).catch(() => {}) }} className={`w-full text-right px-4 py-3 border-b border-white/5 flex gap-3 items-center ${sel === t.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'}`}>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0"><UserRound size={18} className="text-slate-400" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="text-sm font-bold text-white truncate flex-1">{t.name || t.phone}</p><span className="text-[10px] text-slate-500">{hhmm(t.lastAt)}</span></div>
                <p className="text-[11px] text-slate-400 truncate">{t.lastDir === 'out' ? '↩ ' : ''}{t.lastText}</p>
                <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1.5 flex-wrap">{label(t.accountId)}{t.assignee?.name && <span className="text-sky-400">· {t.assignee.name}</span>}{(t.labels || []).slice(0, 2).map((l) => <span key={l} className="bg-white/10 text-slate-300 rounded px-1">{l}</span>)}{t.status === 'done' && <span className="text-emerald-400">· منتهية</span>}{waitMin(t) >= 10 && <span className={`flex items-center gap-0.5 font-bold ${waitMin(t) >= 30 ? 'text-rose-400' : 'text-amber-400'}`}><Clock size={9} />{waitMin(t) >= 60 ? `${Math.floor(waitMin(t) / 60)}س` : `${waitMin(t)}د`} بلا رد</span>}</p>
              </div>
              {t.unread > 0 && <span className="min-w-[20px] h-5 rounded-full bg-emerald-500 text-black text-[11px] font-black flex items-center justify-center px-1.5">{t.unread}</span>}
            </button>
          ))}
        </div>
      </aside>
      <section className={`${th ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col min-h-0`}>
        {th ? <Conversation key={th.id} th={th} me={auth.getCurrentUser()} acctLabel={label(th.accountId)} online={sessions.find((s) => s.id === th.accountId)?.status === 'open'} onBack={() => setSel(null)} navigate={navigate} />
          : <div className="m-auto text-slate-600 text-sm">اختر محادثة</div>}
      </section>
    </div>
  )
}

function Conversation({ th, me, acctLabel, online, onBack, navigate }) {
  const { data: msgs } = useLiveShared('wa_msgs', { filters: { threadId: th.id }, order: 'at', limit: 300 })
  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 300 })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { data: botRows } = useLiveShared('wa_bot', { limit: 20 })
  const quick = (botRows?.find((r) => r.id === 'cfg')?.quick) || DEFAULT_BOT.quick
  const [noteMode, setNoteMode] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const LABELS = ['جديد', 'عميل حالي', 'مهم', 'شكوى', 'متابعة', 'فني']
  const patch = (p) => db.updateShared('wa_threads', th.id, p).catch(() => {})
  const toggleLabel = (l) => patch({ labels: (th.labels || []).includes(l) ? th.labels.filter((x) => x !== l) : [...(th.labels || []), l] })
  const fillQuick = (t) => { setText(t.text.replace('{name}', th.name || '')); setShowQuick(false); setNoteMode(false) }
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])
  const tail = th.phone.slice(-9)
  const mine = (orders || []).filter((o) => String(o.clientPhone || '').replace(/\D/g, '').endsWith(tail)).slice(0, 3)
  const paused = (th.bot?.pausedUntil || 0) * 1000 > Date.now()

  async function send() {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true); setErr('')
    try {
      if (noteMode) {
        await db.insertShared('wa_msgs', { threadId: th.id, accountId: th.accountId, phone: th.phone, dir: 'note', text: t, kind: 'note', at: new Date().toISOString(), via: 'staff', by: me?.displayName || me?.name || '' }, undefined, { visibleTo: 'creator-and-admin', writableBy: 'admins' })
      } else {
        await waApi('send', { accountId: th.accountId, to: th.phone, text: t })
        if (th.status === 'done') patch({ status: 'open' })
      }
      setText('')
    }
    catch (e) { setErr(e?.message || 'تعذر الإرسال') }
    finally { setBusy(false) }
  }
  const toggleBot = () => db.updateShared('wa_threads', th.id, { bot: { ...(th.bot || {}), pausedUntil: paused ? 0 : Math.floor(Date.now() / 1000) + 12 * 3600 } }).catch(() => {})

  let lastDay = ''
  return (
    <>
      <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <button onClick={onBack} className="md:hidden w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><ArrowRight size={16} className="text-slate-300" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white truncate">{th.name || th.phone}</p>
          <p className="text-[10px] text-slate-500" dir="ltr">+{th.phone} · {acctLabel}{online ? '' : ' (غير متصل)'}</p>
        </div>
        <button onClick={toggleBot} className={`shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold border ${paused ? 'border-amber-400/40 text-amber-300 bg-amber-500/10' : 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10'}`}><Bot size={13} /> {paused ? 'البوت متوقف' : 'البوت يعمل'}</button>
        <a href={`https://wa.me/${th.phone}`} target="_blank" rel="noopener" className="shrink-0 text-[11px] font-bold text-slate-400 hidden sm:block">فتح في واتساب</a>
      </div>
      <div className="shrink-0 px-4 py-2 border-b border-white/5 flex items-center gap-2 overflow-x-auto">
        {th.assignee?.id === me?.id
          ? <button onClick={() => patch({ assignee: null })} className="shrink-0 text-[11px] font-bold rounded-full px-3 py-1 bg-sky-500/20 border border-sky-400/40 text-sky-200">محادثتي ✓ (إلغاء)</button>
          : <button onClick={() => patch({ assignee: { id: me?.id, name: me?.displayName || me?.name || 'موظف' } })} className="shrink-0 text-[11px] font-bold rounded-full px-3 py-1 bg-white/5 border border-white/10 text-slate-200">{th.assignee?.name ? `عند: ${th.assignee.name} — استلام` : 'استلام المحادثة'}</button>}
        <button onClick={() => patch({ status: th.status === 'done' ? 'open' : 'done' })} className={`shrink-0 flex items-center gap-1 text-[11px] font-bold rounded-full px-3 py-1 border ${th.status === 'done' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/10 text-slate-200'}`}><CheckCircle2 size={12} /> {th.status === 'done' ? 'منتهية — إعادة فتح' : 'تم الحل'}</button>
        <span className="shrink-0 text-slate-600"><Tag size={12} /></span>
        {LABELS.map((l) => <button key={l} onClick={() => toggleLabel(l)} className={`shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 border ${(th.labels || []).includes(l) ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{l}</button>)}
      </div>
      {mine.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5 flex gap-2 overflow-x-auto">
          {mine.map((o) => <button key={o.id} onClick={() => navigate(`/staff/order/${o.id}`)} className="shrink-0 text-[11px] font-bold bg-sky-500/10 border border-sky-400/30 text-sky-200 rounded-full px-3 py-1">طلب #{String(o.id).slice(-4)}</button>)}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5">
        {(msgs || []).map((m) => {
          const d = dayLabel(m.at); const head = d !== lastDay; lastDay = d
          const out = m.dir === 'out'
          if (m.dir === 'note') return <div key={m.id} className="self-center max-w-[90%] bg-amber-400/15 border border-amber-400/30 text-amber-100 rounded-xl px-3 py-1.5 text-xs flex gap-1.5"><StickyNote size={12} className="mt-0.5 shrink-0" /><span className="whitespace-pre-wrap">{m.text}<span className="block text-[9px] opacity-60">ملاحظة داخلية · {m.by} · {hhmm(m.at)}</span></span></div>
          return (
            <div key={m.id} className="flex flex-col">
              {head && <p className="self-center text-[10px] text-slate-600 my-2">{d}</p>}
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${out ? 'self-start bg-emerald-600/80 text-white rounded-br-sm' : 'self-end bg-white/10 text-slate-100 rounded-bl-sm'}`}>
                {m.text || <span className="opacity-60">[{m.kind}]</span>}
                <span className="block text-[9px] opacity-60 mt-0.5">{out && (m.via === 'bot' ? '🤖 ' : m.via === 'phone' ? '📱 ' : '')}{hhmm(m.at)}{out && <CheckCheck size={10} className="inline mr-1" />}</span>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <div className="shrink-0 p-3 border-t border-white/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {err && <p className="text-rose-400 text-xs font-bold mb-2">{err}</p>}
        {showQuick && <div className="flex gap-1.5 overflow-x-auto pb-2">{quick.map((q, i) => <button key={i} onClick={() => fillQuick(q)} className="shrink-0 text-[11px] font-bold rounded-full px-3 py-1.5 bg-emerald-500/10 border border-emerald-400/30 text-emerald-200">{q.title}</button>)}</div>}
        <div className="flex gap-1.5 mb-2">
          <button onClick={() => setShowQuick((v) => !v)} className={`flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 border ${showQuick ? 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10' : 'border-white/10 text-slate-400'}`}><Zap size={12} /> ردود سريعة</button>
          <button onClick={() => setNoteMode((v) => !v)} className={`flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 border ${noteMode ? 'border-amber-400/50 text-amber-200 bg-amber-500/10' : 'border-white/10 text-slate-400'}`}><StickyNote size={12} /> ملاحظة داخلية</button>
        </div>
        <div className="flex gap-2 items-end">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={noteMode ? 'ملاحظة للفريق فقط — لا تُرسل للعميل' : 'اكتب ردك…'} className={`${inputCls} resize-none max-h-32`} />
          <button onClick={send} disabled={busy || !text.trim()} className="shrink-0 w-11 h-11 rounded-xl bg-emerald-500 text-black flex items-center justify-center disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}</button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5">{noteMode ? 'وضع الملاحظة الداخلية: لن يراها العميل.' : 'الرد من هنا يوقف البوت في هذه المحادثة 12 ساعة. الإرسال يتم بفاصل عشوائي قصير لحماية الرقم.'}</p>
      </div>
    </>
  )
}

const Chip = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold border ${on ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>{children}</button>
)

/* ------------------------------------------------------------------ numbers */
function Numbers({ sess, isOwner }) {
  const [adding, setAdding] = useState(false)
  const [cfgOpen, setCfgOpen] = useState(false)
  const notSet = /الوسيط أولًا|gw_not_set/.test(sess.error || '')
  const { data: botRows } = useLiveShared('wa_bot', { limit: 50 })
  const { data: threads } = useLiveShared('wa_threads', { order: '-lastAt', limit: 300 })
  const botOn = (id) => botRows?.find((r) => r.id === `acct:${id}`)?.botEnabled !== false
  const setBot = (id, v) => db.upsertShared('wa_bot', { botEnabled: v }, `acct:${id}`, { writableBy: 'admins' }).catch(() => {})
  const stat2 = (id) => { const l = (threads || []).filter((t) => t.accountId === id); return { n: l.length, u: l.reduce((a, t) => a + (t.unread || 0), 0), w: l.filter((t) => t.lastDir === 'in' && t.status !== 'done').length } }
  async function act(op, id) {
    if (op === 'logout' && !confirm('فصل هذا الرقم وحذف جلسته؟')) return
    try { await waApi(op, { id }); sess.reload() } catch (e) { alert(e?.message || 'تعذر التنفيذ') }
  }
  return (
    <div className="h-full overflow-y-auto"><div className="max-w-3xl mx-auto w-full px-4 py-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <button onClick={() => setAdding(true)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-black rounded-xl py-3 text-sm font-black"><Plus size={16} /> ربط رقم جديد</button>
        {isOwner && <button onClick={() => setCfgOpen((v) => !v)} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-bold text-slate-200"><Settings2 size={14} /> إعداد الوسيط</button>}
      </div>
      {(cfgOpen || notSet) && isOwner && <GatewayConfig onSaved={sess.reload} />}
      {sess.error && !notSet && <p className="text-rose-400 text-xs font-bold bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{sess.error}</p>}
      {sess.loading && <p className="text-slate-500 text-xs text-center py-6">جارِ التحميل…</p>}
      {sess.sessions.map((s) => {
        const [lab, cls] = stat(s.status)
        return (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white truncate">{s.label}</p>
                <p className="text-[11px] text-slate-500" dir="ltr">{s.phone ? `+${s.phone}` : '—'} {s.name ? `· ${s.name}` : ''}</p>
              </div>
              <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${cls}`}>{lab}</span>
            </div>
            {s.qr && (
              <div className="mt-3 flex flex-col items-center gap-2 bg-white rounded-xl p-3">
                <img src={s.qr} alt="QR" className="w-56 h-56" />
                <p className="text-[11px] text-slate-700 text-center">واتساب ← الأجهزة المرتبطة ← ربط جهاز ← امسح الصورة (تتجدد تلقائيًا)</p>
              </div>
            )}
            {s.pairingCode && (
              <div className="mt-3 text-center bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                <p className="text-3xl font-black tracking-[0.3em] text-amber-200" dir="ltr">{s.pairingCode}</p>
                <p className="text-[11px] text-slate-300 mt-2">واتساب ← الأجهزة المرتبطة ← ربط جهاز ← «الربط برقم الهاتف بدلًا من ذلك» ← أدخل الكود</p>
              </div>
            )}
            {(() => { const x = stat2(s.id); return (
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="rounded-xl bg-white/5 py-2"><p className="text-base font-black text-white">{x.n}</p><p className="text-[10px] text-slate-500">محادثات</p></div>
                <div className="rounded-xl bg-white/5 py-2"><p className="text-base font-black text-emerald-300">{x.u}</p><p className="text-[10px] text-slate-500">غير مقروءة</p></div>
                <div className="rounded-xl bg-white/5 py-2"><p className={`text-base font-black ${x.w ? 'text-amber-300' : 'text-white'}`}>{x.w}</p><p className="text-[10px] text-slate-500">بانتظار رد</p></div>
              </div>) })()}
            <div className="flex items-center gap-3 mt-3">
              <p className="flex-1 text-xs font-bold text-slate-300">بوت الاستقبال على هذا الرقم</p>
              <button onClick={() => setBot(s.id, !botOn(s.id))} className={`w-12 h-7 rounded-full relative transition-colors ${botOn(s.id) ? 'bg-primary' : 'bg-white/15'}`} aria-pressed={botOn(s.id)}><span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${botOn(s.id) ? 'right-1' : 'right-6'}`} /></button>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-500">
              <span>أُرسل اليوم: {s.sentToday}/{s.dailyCap}</span>
              <span className="mr-auto" />
              <button onClick={() => act('restart', s.id)} className="flex items-center gap-1 font-bold text-slate-300 bg-white/5 rounded-lg px-2.5 py-1.5"><RefreshCw size={12} /> إعادة اتصال</button>
              <button onClick={() => act('logout', s.id)} className="flex items-center gap-1 font-bold text-rose-300 bg-rose-500/10 rounded-lg px-2.5 py-1.5"><LogOut size={12} /> فصل</button>
            </div>
          </div>
        )
      })}
      {!sess.loading && !sess.error && sess.sessions.length === 0 && <p className="text-center text-slate-500 text-xs py-8">لا توجد أرقام مربوطة. اضغط «ربط رقم جديد».</p>}
      {adding && <AddNumber onClose={() => setAdding(false)} onDone={() => { setAdding(false); sess.reload() }} />}
    </div></div>
  )
}

function AddNumber({ onClose, onDone }) {
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState('qr')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    setBusy(true); setErr('')
    try { await waApi('connect', { label: label.trim() || 'رقم جديد', mode, phone }); onDone() }
    catch (e) { setErr(e?.message || 'تعذر الربط') } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0f1424] border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
        <h3 className="font-display font-black text-white">ربط رقم واتساب</h3>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="اسم للرقم (مثال: مبيعات 1)" className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('qr')} className={`rounded-xl py-3 text-xs font-black border flex items-center justify-center gap-1.5 ${mode === 'qr' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}><QrCode size={15} /> صورة QR</button>
          <button onClick={() => setMode('code')} className={`rounded-xl py-3 text-xs font-black border flex items-center justify-center gap-1.5 ${mode === 'code' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}><KeyRound size={15} /> كود الاقتران</button>
        </div>
        {mode === 'code' && <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال بالصيغة الدولية 9665xxxxxxxx" dir="ltr" inputMode="numeric" className={inputCls} />}
        <p className="text-[11px] text-slate-500 leading-relaxed">يعمل مع واتساب العادي وواتساب للأعمال. الربط غير رسمي — لا تستخدمه للإرسال الجماعي، والنظام يضع فاصلًا عشوائيًا وحدًا يوميًا للإرسال لحماية الرقم.</p>
        {err && <p className="text-rose-400 text-xs font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={go} disabled={busy} className="flex-1 bg-emerald-500 text-black font-black rounded-xl py-3 text-sm disabled:opacity-50">{busy ? 'جارِ البدء…' : 'ابدأ الربط'}</button>
          <button onClick={onClose} className="px-5 bg-white/5 rounded-xl text-sm text-slate-300 font-bold">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

function GatewayConfig({ onSaved }) {
  const [c, setC] = useState(null)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { waApi('config_get').then((r) => { setC(r); setUrl(r.url || '') }).catch(() => {}) }, [])
  async function save() {
    try { const r = await waApi('config_set', { url, token: token || undefined }); setC(r); setToken(''); setMsg('تم الحفظ ✓'); onSaved() } catch (e) { setMsg(e?.message || 'تعذر الحفظ') }
  }
  const copy = (t) => { try { navigator.clipboard.writeText(t) } catch {} }
  return (
    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 flex flex-col gap-2.5">
      <p className="text-sm font-black text-white">إعداد الوسيط (Gateway)</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط الوسيط https://wa.example.com" dir="ltr" className={inputCls} />
      <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={c?.hasToken ? 'مفتاح الوسيط محفوظ — اتركه فارغًا للإبقاء' : 'مفتاح الوسيط GATEWAY_TOKEN'} dir="ltr" type="password" className={inputCls} />
      {c && (
        <div className="text-[11px] text-slate-400 leading-relaxed bg-black/20 rounded-xl p-3">
          <p className="font-bold text-slate-300 mb-1">ضع هاتين القيمتين في إعدادات الوسيط:</p>
          <p className="flex items-center gap-2 break-all" dir="ltr">WEBHOOK_URL={c.hookUrl} <button onClick={() => copy(c.hookUrl)}><Copy size={12} /></button></p>
          <p className="flex items-center gap-2 break-all" dir="ltr">WEBHOOK_SECRET={c.secret} <button onClick={() => copy(c.secret)}><Copy size={12} /></button></p>
        </div>
      )}
      <div className="flex items-center gap-3"><button onClick={save} className="bg-primary text-black font-black rounded-xl px-5 py-2.5 text-sm">حفظ</button>{msg && <span className="text-xs text-emerald-300 font-bold">{msg}</span>}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ bot */
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const STOP = new Set(['كم', 'ايش', 'وش', 'ممكن', 'لو', 'سمحت', 'عندكم', 'هل', 'في', 'من', 'على', 'الى', 'إلى', 'عن', 'ابغى', 'ابي', 'اريد', 'انا', 'لي', 'يا'])
const kwOf = (q) => [...new Set(String(q).replace(/[^؀-ۿa-zA-Z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)))].slice(0, 4).join('، ')

// Free "learning": owner's own replies in customer chats become candidate scenarios; unanswered questions are listed.
function LearnedPanel({ rows, onApprove }) {
  const learn = rows.filter((r) => r.kind === 'learn' && r.status === 'pending').sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 15)
  const miss = rows.filter((r) => r.kind === 'miss').sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 10)
  const style = rows.find((r) => r.id === 'style')
  const mark = (r, status) => db.upsertShared('wa_bot', { ...r, status }, r.id, { writableBy: 'admins' })
  return (
    <div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2.5">
      <p className="text-sm font-black text-white">🧠 تعلّم البوت (مجاني — يتعلم من ردودك أنت)</p>
      <p className="text-[11px] text-slate-400">كل ما ترد بنفسك على عميل، يُحفظ السؤال وردك هنا كسيناريو مقترح. اعتمده ليصير البوت يرد به، أو ارفضه. لا يُنشر شيء بدون موافقتك.</p>
      {style && style.n > 0 && <p className="text-[11px] text-slate-300">أسلوبك: متوسط طول الرد {Math.round(style.len / style.n)} حرف • إيموجي/رد {(style.emoji / style.n).toFixed(1)} • أكثر افتتاحياتك: {Object.keys(style.open || {}).slice(0, 4).join('، ') || '—'}</p>}
      {learn.length === 0 && <p className="text-[11px] text-slate-500">لا توجد سيناريوهات مقترحة بعد.</p>}
      {learn.map((r) => (
        <div key={r.id} className="bg-white/[0.03] rounded-xl p-2.5 grid gap-1.5">
          <p className="text-xs text-slate-300"><b>العميل:</b> {r.q} {r.count > 1 && <span className="text-amber-400">×{r.count}</span>}</p>
          <p className="text-xs text-emerald-300"><b>ردك:</b> {r.a}</p>
          <div className="flex gap-2">
            <button onClick={async () => { await onApprove({ keywords: kwOf(r.q), reply: r.a }); await mark(r, 'approved') }} className="flex-1 bg-primary text-black font-black rounded-lg py-1.5 text-xs">اعتماد كسيناريو</button>
            <button onClick={() => mark(r, 'rejected')} className="px-3 bg-white/10 text-slate-300 rounded-lg text-xs">رفض</button>
          </div>
        </div>
      ))}
      {miss.length > 0 && (
        <div className="grid gap-1">
          <p className="text-xs font-black text-slate-200 mt-1">أسئلة لم يفهمها البوت (رد عليها وسيتعلمها):</p>
          {miss.map((r) => <p key={r.id} className="text-[11px] text-slate-400">• {r.q} <span className="text-amber-400">×{r.count}</span></p>)}
        </div>
      )}
    </div>
  )
}

function BotSettings() {
  const { data } = useLiveShared('wa_bot', { limit: 400 })
  const [c, setC] = useState(null)
  const [saved, setSaved] = useState('')
  useEffect(() => { if (c === null && data) { const row = data.find((r) => r.id === 'cfg'); setC({ ...DEFAULT_BOT, ...(row || {}), hours: { ...DEFAULT_BOT.hours, ...(row?.hours || {}) } }) } }, [data, c])
  if (!c) return <Centered>جارِ التحميل…</Centered>
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }))
  const list = (k, i, f, v) => set(k, c[k].map((x, j) => (j === i ? { ...x, [f]: v } : x)))
  async function save() {
    try { const { id, createdAt, updatedAt, ...rest } = c; await saveBot(rest); setSaved('تم الحفظ ✓') } catch { setSaved('تعذر الحفظ') }
    setTimeout(() => setSaved(''), 2500)
  }
  return (
    <div className="h-full overflow-y-auto"><div className="max-w-3xl mx-auto w-full px-4 py-4 flex flex-col gap-4 pb-24">
      <Row><label className="flex items-center gap-3 flex-1 text-sm font-black text-white"><input type="checkbox" checked={!!c.enabled} onChange={(e) => set('enabled', e.target.checked)} className="w-5 h-5 accent-emerald-500" /> تشغيل بوت الاستقبال على كل الأرقام</label></Row>
      <Row><label className="flex items-center gap-3 flex-1 text-sm font-bold text-slate-200"><input type="checkbox" checked={!!c.forceAway} onChange={(e) => set('forceAway', e.target.checked)} className="w-5 h-5 accent-amber-500" /> لا يوجد أحد متاح الآن (يسجّل البوت بيانات العميل بدل التحويل)</label></Row>
      <Field label="اسم النشاط"><input value={c.brand} onChange={(e) => set('brand', e.target.value)} className={inputCls} /></Field>
      <Field label="رسالة الترحيب (استخدم {brand} للاسم)"><textarea rows={3} value={c.welcome} onChange={(e) => set('welcome', e.target.value)} className={inputCls} /></Field>
      <Field label="قائمة الخيارات (الأرقام 1–5 ثابتة)"><textarea rows={6} value={c.menu} onChange={(e) => set('menu', e.target.value)} className={inputCls} /></Field>
      <Field label="نص الخدمات والأسعار (الخيار 1)"><textarea rows={4} value={c.services} onChange={(e) => set('services', e.target.value)} className={inputCls} /></Field>
      <div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2.5">
        <p className="text-sm font-black text-white">مواعيد العمل</p>
        <div className="flex gap-2 items-center text-xs text-slate-300">من <input type="time" value={c.hours.start} onChange={(e) => set('hours', { ...c.hours, start: e.target.value })} className={`${inputCls} !w-auto`} /> إلى <input type="time" value={c.hours.end} onChange={(e) => set('hours', { ...c.hours, end: e.target.value })} className={`${inputCls} !w-auto`} /></div>
        <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => { const on = c.hours.days.includes(i); return <Chip key={d} on={on} onClick={() => set('hours', { ...c.hours, days: on ? c.hours.days.filter((x) => x !== i) : [...c.hours.days, i].sort() })}>{d}</Chip> })}</div>
      </div>
      <div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2.5">
        <div className="flex items-center"><p className="text-sm font-black text-white flex-1">روابط الفيديو (تيك توك / يوتيوب)</p><button onClick={() => set('videos', [...c.videos, { title: '', url: '', keywords: '' }])} className="text-xs font-bold text-primary flex items-center gap-1"><Plus size={13} /> إضافة</button></div>
        {c.videos.map((v, i) => (
          <div key={i} className="grid gap-1.5 bg-white/[0.03] rounded-xl p-2.5">
            <input value={v.title} onChange={(e) => list('videos', i, 'title', e.target.value)} placeholder="عنوان الفيديو (مثال: طريقة غسيل المكيف)" className={inputCls} />
            <input value={v.url} onChange={(e) => list('videos', i, 'url', e.target.value)} placeholder="https://www.tiktok.com/…" dir="ltr" className={inputCls} />
            <div className="flex gap-2"><input value={v.keywords} onChange={(e) => list('videos', i, 'keywords', e.target.value)} placeholder="كلمات تُظهره: غسيل، مكيف" className={inputCls} /><button onClick={() => set('videos', c.videos.filter((_, j) => j !== i))} className="shrink-0 text-rose-400 px-2"><Trash2 size={15} /></button></div>
          </div>
        ))}
        {c.videos.length === 0 && <p className="text-[11px] text-slate-500">أضف روابطك الحقيقية؛ يرسلها البوت عند سؤال العميل عن الشرح أو الغسيل.</p>}
      </div>
      <div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2.5">
        <div className="flex items-center"><p className="text-sm font-black text-white flex-1">أسئلة وأجوبة سريعة</p><button onClick={() => set('faq', [...c.faq, { keywords: '', reply: '' }])} className="text-xs font-bold text-primary flex items-center gap-1"><Plus size={13} /> إضافة</button></div>
        {c.faq.map((f, i) => (
          <div key={i} className="grid gap-1.5 bg-white/[0.03] rounded-xl p-2.5">
            <input value={f.keywords} onChange={(e) => list('faq', i, 'keywords', e.target.value)} placeholder="كلمات السؤال: ضمان، كفالة" className={inputCls} />
            <div className="flex gap-2"><textarea rows={2} value={f.reply} onChange={(e) => list('faq', i, 'reply', e.target.value)} placeholder="الرد" className={inputCls} /><button onClick={() => set('faq', c.faq.filter((_, j) => j !== i))} className="shrink-0 text-rose-400 px-2"><Trash2 size={15} /></button></div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2.5">
        <div className="flex items-center"><p className="text-sm font-black text-white flex-1">ردود سريعة للفريق (تظهر في صندوق المحادثات)</p><button onClick={() => set('quick', [...(c.quick || []), { title: '', text: '' }])} className="text-xs font-bold text-primary flex items-center gap-1"><Plus size={13} /> إضافة</button></div>
        {(c.quick || []).map((f, i) => (
          <div key={i} className="grid gap-1.5 bg-white/[0.03] rounded-xl p-2.5">
            <input value={f.title} onChange={(e) => list('quick', i, 'title', e.target.value)} placeholder="عنوان الزر" className={inputCls} />
            <div className="flex gap-2"><textarea rows={2} value={f.text} onChange={(e) => list('quick', i, 'text', e.target.value)} placeholder="نص الرد — استخدم {name} لاسم العميل" className={inputCls} /><button onClick={() => set('quick', c.quick.filter((_, j) => j !== i))} className="shrink-0 text-rose-400 px-2"><Trash2 size={15} /></button></div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2.5">
        <p className="text-sm font-black text-white">التفاوض والتغطية</p>
        <Field label="نزول السعر لكل جولة فصال (ر.س للوحدة) — الحد الأدنى يحدده «أقصى خصم» في إعدادات المكيفات"><input type="number" min="0" value={c.negStep ?? 10} onChange={(e) => set('negStep', Number(e.target.value) || 0)} className={inputCls} /></Field>
        <Field label="أحياء إضافية داخل مكة (افصل بفاصلة)"><input value={(c.extraDistricts || []).join('، ')} onChange={(e) => set('extraDistricts', e.target.value.split(/[,،]+/).map((x) => x.trim()).filter(Boolean))} className={inputCls} /></Field>
      </div>
      <LearnedPanel rows={data || []} onApprove={async (item) => { const next = { ...c, faq: [...(c.faq || []), item] }; setC(next); const { id, createdAt, updatedAt, ...rest } = next; await saveBot(rest) }} />
      <Field label="رد التحويل لموظف (أثناء الدوام)"><textarea rows={2} value={c.handoffText} onChange={(e) => set('handoffText', e.target.value)} className={inputCls} /></Field>
      <Field label="رد عدم توفر أحد (خارج الدوام)"><textarea rows={2} value={c.awayText} onChange={(e) => set('awayText', e.target.value)} className={inputCls} /></Field>
      <Field label="رد بعد تسجيل البيانات"><textarea rows={2} value={c.doneText} onChange={(e) => set('doneText', e.target.value)} className={inputCls} /></Field>
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#090c14]/95 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center gap-3"><button onClick={save} className="flex-1 bg-primary text-black font-black rounded-xl py-3 text-sm">حفظ إعدادات البوت</button>{saved && <span className="text-xs font-bold text-emerald-300">{saved}</span>}</div>
      </div>
    </div></div>
  )
}
const Row = ({ children }) => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center">{children}</div>
const Field = ({ label, children }) => <label className="flex flex-col gap-1.5"><span className="text-[11px] font-bold text-slate-400">{label}</span>{children}</label>
const Centered = ({ children }) => <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
