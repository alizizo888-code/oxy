import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Bot, MessagesSquare, Mic, ClipboardCheck, Handshake, BadgePercent, Siren, BellRing,
  MessageCircle, BookOpen, ScrollText, BarChart3, RefreshCw, ArrowLeft, Headset, Gauge, CreditCard,
} from 'lucide-react'
import { db } from '../lib/db'
import { payments } from '../lib/payments'
import { whatsapp } from '../lib/whatsapp'
import { useLiveShared } from '../lib/useLive'
import { useTeamRole } from '../hooks/useTeamRole'
import { useAiSettings } from '../hooks/useAiSettings'
import { escalationLabel, ACTIVE_STATUSES_FOR_ALERTS } from '../workflow'
import { specialtyLabel } from '../constants'
import { ACTION_LABELS } from './AiSettings'
import Chart from '../components/Chart'

export default function AiCommandCenter() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { settings, update } = useAiSettings()
  const allowed = isOwner || role === 'operations'

  const { data: openHandoffs } = useLiveShared('handoffs', { filters: { status: { ne: 'closed' } }, order: '-createdAt', limit: 30 })
  const { data: recentLogs } = useLiveShared('ai_logs', { order: '-at', limit: 12 })
  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 200 })

  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [wa, setWa] = useState(null)
  const [pay, setPay] = useState(null)

  async function load() {
    setBusy(true)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    try {
      const [turns24, turns, voice24, voice, aiOrders, negotiations, discounts, lowConf, escalated, handoffsTotal, byAction, byReason, paidOnline] = await Promise.all([
        db.countShared('ai_logs', { at: { gte: since } }),
        db.countShared('ai_logs'),
        db.countShared('ai_logs', { voice: true, at: { gte: since } }),
        db.countShared('ai_logs', { voice: true }),
        db.countShared('orders', { source: 'mutqan_ai' }),
        db.countShared('ai_logs', { action: 'negotiate' }),
        db.countShared('orders', { negotiated: true }),
        db.countShared('ai_logs', { lowConfidence: true }),
        db.countShared('ai_logs', { sensitive: true }),
        db.countShared('handoffs'),
        db.groupByShared('ai_logs', 'action', { limit: 10 }),
        db.groupByShared('handoffs', 'reason', { limit: 10 }),
        db.countShared('orders', { paymentMethod: 'online' }),
      ])
      let providerErrors = []
      try { providerErrors = await db.groupByShared('_ai_usage', 'kind', { filters: { error: true, at: { gte: since } }, limit: 5 }) } catch {}
      setStats({ turns24, turns, voice24, voice, aiOrders, negotiations, discounts, lowConf, escalated, handoffsTotal, byAction: byAction || [], byReason: byReason || [], paidOnline, providerErrors: providerErrors || [] })
    } catch {
      setStats({ error: true })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!allowed) return
    load()
    whatsapp.isConnected().then(setWa).catch(() => setWa(false))
    payments.status().then((s) => setPay(!!s?.available)).catch(() => setPay(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  const followUps = useMemo(
    () => (orders || []).filter((o) => o.escalation && ACTIVE_STATUSES_FOR_ALERTS.includes(o.status)),
    [orders]
  )
  const pendingPayments = useMemo(
    () => (orders || []).filter((o) => !o.inhouse && o.onlinePayment?.status && o.paymentStatus !== 'paid'),
    [orders]
  )

  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <Centered>مركز القيادة للمالك ومشرف العمليات فقط</Centered>

  const kbCount = (settings.faq || []).length
  const actionChart = stats?.byAction?.length
    ? { kind: 'hbar', labels: stats.byAction.map((b) => ACTION_LABELS[b.key] || b.key), series: [{ name: 'عدد', data: stats.byAction.map((b) => b.count), color: '#38bdf8' }] }
    : null

  return (
    <div className="h-full overflow-y-auto bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-primary font-bold tracking-widest">AI COMMAND CENTER</p>
            <h1 className="font-display text-lg font-black text-white truncate">مركز قيادة MUTQAN AI</h1>
          </div>
          <button onClick={load} disabled={busy} className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200 disabled:opacity-50">
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-5 pb-24 flex flex-col gap-5">
        {/* AI status — the one hero element */}
        <section className={`relative overflow-hidden rounded-3xl border p-5 fade-up ${settings.enabled ? 'border-emerald-500/30 bg-gradient-to-l from-emerald-500/10 via-sky-500/5 to-transparent' : 'border-rose-500/30 bg-rose-500/5'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${settings.enabled ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
              <Bot size={28} className={settings.enabled ? 'text-emerald-400' : 'text-rose-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-bold">AI Status</p>
              <p className="font-display text-2xl font-black text-white">{settings.enabled ? 'يعمل الآن' : 'متوقف'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">حد الثقة {Math.round((settings.confidence?.threshold ?? 0.6) * 100)}% · التفاوض {settings.negotiation.enabled ? 'مفعّل' : 'متوقف'} · التحويل لموظف {settings.handoff.enabled ? 'مفعّل' : 'متوقف'}</p>
            </div>
            <button onClick={() => update({ enabled: !settings.enabled }).catch(() => {})} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${settings.enabled ? 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10' : 'bg-primary text-black'}`}>
              {settings.enabled ? 'إيقاف' : 'تشغيل'}
            </button>
          </div>
        </section>

        {stats?.error && <p className="text-rose-400 text-xs font-bold">تعذر تحميل الإحصاءات</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric icon={MessagesSquare} label="المحادثات النشطة" value={stats?.turns24} sub={`رسائل آخر 24 ساعة · ${stats?.turns ?? '—'} إجمالي`} delay={0} />
          <Metric icon={Mic} label="الجلسات الصوتية" value={stats?.voice24} sub={`آخر 24 ساعة · ${stats?.voice ?? '—'} إجمالي`} delay={40} />
          <Metric icon={ClipboardCheck} label="طلبات أنشأها المساعد" value={stats?.aiOrders} tone="text-emerald-400" delay={80} />
          <Metric icon={Handshake} label="جولات التفاوض" value={stats?.negotiations} tone="text-amber-400" delay={120} />
          <Metric icon={BadgePercent} label="طلبات بخصم متفق عليه" value={stats?.discounts} tone="text-amber-300" delay={160} />
          <Metric icon={Siren} label="تحويلات لموظف" value={stats?.handoffsTotal} sub={`${openHandoffs.length} مفتوحة الآن`} tone="text-orange-400" delay={200} />
          <Metric icon={Gauge} label="قرارات أُوقفت لقلة الثقة" value={stats?.lowConf} sub={`من ${stats?.escalated ?? '—'} قرار حساس`} tone="text-rose-400" delay={240} />
          <Metric icon={CreditCard} label="مدفوعات إلكترونية مؤكدة" value={stats?.paidOnline} sub={`${pendingPayments.length} بانتظار التأكيد`} tone="text-sky-300" delay={280} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel icon={Headset} title={`التصعيدات المفتوحة (${openHandoffs.length})`}>
            {openHandoffs.length === 0 ? <Empty>لا توجد محادثات محوّلة مفتوحة</Empty> : openHandoffs.slice(0, 6).map((h) => (
              <Row key={h.id} onClick={() => navigate(`/staff/handoff/${h.id}`)}>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{h.customerName}{h.customerPhone ? ` · ${h.customerPhone}` : ''}</p>
                  <p className="text-[10px] text-slate-400 truncate">{h.intent || h.summary}</p>
                </div>
                <span className={`text-[10px] font-black shrink-0 ${h.priority === 'high' ? 'text-rose-400' : 'text-amber-400'}`}>{escalationLabel(h.reason)}</span>
              </Row>
            ))}
          </Panel>

          <Panel icon={BellRing} title={`المتابعات والتنبيهات (${followUps.length})`}>
            {followUps.length === 0 ? <Empty>لا توجد تنبيهات متابعة حاليًا</Empty> : followUps.slice(0, 6).map((o) => (
              <Row key={o.id} onClick={() => navigate(`/staff/order/${o.id}`)}>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{specialtyLabel(o.specialtyId)} · {o.clientName || ''}</p>
                  <p className="text-[10px] text-slate-400 truncate">{o.technicianName ? `الفني: ${o.technicianName}` : 'بدون فني'}</p>
                </div>
                <span className="text-[10px] font-black text-rose-300 shrink-0">{escalationLabel(o.escalation.reason)}</span>
              </Row>
            ))}
            {pendingPayments.slice(0, 3).map((o) => (
              <Row key={`p-${o.id}`} onClick={() => navigate(`/staff/order/${o.id}`)}>
                <p className="text-xs font-bold text-white truncate">💳 {specialtyLabel(o.specialtyId)} · {o.clientName || ''}</p>
                <span className={`text-[10px] font-black shrink-0 ${o.onlinePayment.status === 'failed' ? 'text-rose-400' : 'text-amber-400'}`}>{o.onlinePayment.status === 'failed' ? 'دفع لم يكتمل' : 'رابط دفع مُنشأ'}</span>
              </Row>
            ))}
          </Panel>

          <Panel icon={BarChart3} title="التحليلات — نوايا العملاء">
            {actionChart ? <Chart spec={actionChart} /> : <Empty>لا توجد بيانات كافية بعد</Empty>}
            {stats?.byReason?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {stats.byReason.map((r) => (
                  <span key={r.key} className="text-[10px] font-bold bg-white/5 rounded-md px-2 py-1 text-slate-300">{escalationLabel(r.key)}: {r.count}</span>
                ))}
              </div>
            )}
          </Panel>

          <Panel icon={ScrollText} title="سجل المساعد الحي" action={() => navigate('/staff/ai-settings?tab=logs')}>
            {recentLogs.length === 0 ? <Empty>لا يوجد نشاط بعد</Empty> : recentLogs.slice(0, 7).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                <p className="text-[11px] text-slate-300 truncate min-w-0">{l.voice ? '🎙️ ' : ''}{l.customerName}: {l.text}</p>
                <span className={`text-[10px] font-bold shrink-0 ${l.lowConfidence ? 'text-rose-400' : 'text-slate-500'}`}>
                  {ACTION_LABELS[l.action] || l.action}{l.confidence != null ? ` · ${Math.round(l.confidence * 100)}%` : ''}
                </span>
              </div>
            ))}
          </Panel>

          <Panel icon={BookOpen} title="قاعدة المعرفة" action={() => navigate('/staff/ai-settings?tab=kb')}>
            <p className="font-display text-3xl font-black text-white">{kbCount}</p>
            <p className="text-[11px] text-slate-400">معلومة معتمدة · الخدمات والأسعار تُقرأ تلقائيًا من قواعد التسعير</p>
          </Panel>

          <Panel icon={Gauge} title="صحة المزوّدين (آخر 24 ساعة)">
            {[{ k: 'ai', l: 'مزوّد الذكاء الاصطناعي' }, { k: 'stt', l: 'تحويل الكلام إلى نص' }, { k: 'tts', l: 'تحويل النص إلى كلام' }].map(({ k, l }) => {
              const n = stats?.providerErrors?.find((e) => e.key === k)?.count || 0
              return (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-slate-400">{l}</span>
                  <span className={`text-xs font-bold ${n ? 'text-rose-400' : 'text-emerald-400'}`}>{stats ? (n ? `${n} خطأ` : 'سليم') : '…'}</span>
                </div>
              )
            })}
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">عند تعطّل أي مزوّد يستمر مُتقن: الطلب المباشر، التحويل لموظف، التوزيع، والدفع عند الفني.</p>
            {isOwner && <button onClick={() => navigate('/staff/ai-owner')} className="mt-2 text-[11px] font-bold text-amber-400 hover:underline">رقابة المالك: الاستهلاك والتكلفة ←</button>}
          </Panel>

          <Panel icon={MessageCircle} title="WhatsApp AI">
            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
              <span className="text-xs text-slate-400">رقم واتساب الأعمال</span>
              <span className={`text-xs font-bold ${wa ? 'text-white' : 'text-amber-400'}`}>{wa === null ? '…' : wa ? 'متصل' : 'SETUP REQUIRED'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
              <span className="text-xs text-slate-400">رد المساعد التلقائي على واتساب</span>
              <span className="text-xs font-bold text-slate-500">غير متاح</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-slate-400">الدفع الإلكتروني</span>
              <span className={`text-xs font-bold ${pay ? 'text-emerald-400' : 'text-amber-400'}`}>{pay === null ? '…' : pay ? 'مفعّل' : 'SETUP REQUIRED'}</span>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value, sub, tone = 'text-white', delay = 0 }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 fade-up hover:bg-white/[0.06] transition-colors" style={{ animationDelay: `${delay}ms` }}>
      <Icon size={16} className="text-primary mb-2" />
      <p className={`font-display text-2xl font-black ${tone}`}>{value ?? '—'}</p>
      <p className="text-[11px] font-bold text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ icon: Icon, title, children, action }) {
  return (
    <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 fade-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-bold text-sm flex items-center gap-1.5"><Icon size={15} className="text-primary" /> {title}</h2>
        {action && <button onClick={action} className="text-[11px] font-bold text-primary flex items-center gap-0.5 hover:underline">فتح <ArrowLeft size={12} /></button>}
      </div>
      {children}
    </section>
  )
}

function Row({ children, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 mb-1.5 text-right transition-colors">
      {children}
    </button>
  )
}

function Empty({ children }) {
  return <p className="text-slate-500 text-xs text-center py-4">{children}</p>
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
