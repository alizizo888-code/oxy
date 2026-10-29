import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Crown, RefreshCw, Activity, MessagesSquare, ClipboardCheck, Handshake, BadgePercent, Siren,
  Mic, UserPlus, AlertOctagon, Coins, ScrollText, ArrowLeft, Save, Loader2, ShieldCheck, Cpu,
} from 'lucide-react'
import { db } from '../lib/db'
import { useLiveShared } from '../lib/useLive'
import { useTeamRole } from '../hooks/useTeamRole'
import { useAiSettings } from '../hooks/useAiSettings'
import { estimateCost, costsConfigured, AI_PERMISSIONS } from '../aiAdapter'
import Chart from '../components/Chart'

const PERIODS = [{ id: 1, label: '24 ساعة' }, { id: 7, label: '7 أيام' }, { id: 30, label: '30 يومًا' }]

export default function AiOwnerControl() {
  const navigate = useNavigate()
  const { isOwner, loading } = useTeamRole()
  const { settings, update } = useAiSettings()
  const [days, setDays] = useState(30)
  const [s, setS] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data: usageRows } = useLiveShared('_ai_usage', { order: '-at', limit: 30 })
  const { data: audit } = useLiveShared('_ai_audit', { order: '-at', limit: 15 })

  async function load() {
    setBusy(true)
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const f = { at: { gte: since } }
    try {
      const [requests, errors, tokensIn, tokensOut, voiceSec, ttsChars, turns, voiceTurns, aiOrders, negotiations, discounts, escalations, registrations, byKind, byProvider, byDate, byFeature] = await Promise.all([
        db.countShared('_ai_usage', f),
        db.countShared('_ai_usage', { ...f, error: true }),
        db.sumShared('_ai_usage', 'tokensIn', f),
        db.sumShared('_ai_usage', 'tokensOut', f),
        db.sumShared('_ai_usage', 'voiceSeconds', f),
        db.sumShared('_ai_usage', 'ttsChars', f),
        db.countShared('ai_logs', f),
        db.countShared('ai_logs', { ...f, voice: true }),
        db.countShared('orders', { source: 'mutqan_ai' }),
        db.countShared('ai_logs', { ...f, action: 'negotiate' }),
        db.countShared('orders', { negotiated: true }),
        db.countShared('handoffs'),
        db.countShared('customers', { verifiedAt: { gte: since } }),
        db.groupByShared('_ai_usage', 'kind', { filters: f, limit: 10 }),
        db.groupByShared('_ai_usage', 'model', { filters: f, limit: 10 }),
        db.groupByShared('_ai_usage', 'date', { filters: f, limit: 31 }),
        db.groupByShared('_ai_usage', 'feature', { filters: f, limit: 10 }),
      ])
      setS({ requests, errors, tokensIn: tokensIn || 0, tokensOut: tokensOut || 0, voiceSec: voiceSec || 0, ttsChars: ttsChars || 0, turns, voiceTurns, aiOrders, negotiations, discounts, escalations, registrations, byKind: byKind || [], byProvider: byProvider || [], byDate: (byDate || []).sort((a, b) => String(a.key).localeCompare(String(b.key))), byFeature: byFeature || [] })
    } catch {
      setS({ error: true })
    } finally { setBusy(false) }
  }
  useEffect(() => { if (isOwner) load() /* eslint-disable-next-line */ }, [isOwner, days])

  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!isOwner) return <Centered>رقابة الذكاء الاصطناعي للمالك فقط</Centered>

  const configured = costsConfigured(settings.costs)
  const cost = s && !s.error ? estimateCost({ tokensIn: s.tokensIn, tokensOut: s.tokensOut, voiceSeconds: s.voiceSec, ttsChars: s.ttsChars }, settings.costs) : null
  const dateChart = s?.byDate?.length ? { kind: 'bar', labels: s.byDate.map((d) => String(d.key).slice(5)), series: [{ name: 'طلبات AI', data: s.byDate.map((d) => d.count), color: '#f59e0b' }] } : null
  const allowedActions = AI_PERMISSIONS.filter((p) => !p.locked && settings.permissions[p.id] !== false)

  return (
    <div className="h-full overflow-y-auto bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/ai-settings')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ChevronRight size={18} className="text-slate-300" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-400 font-bold tracking-widest flex items-center gap-1"><Crown size={11} /> AI OWNER CONTROL</p>
            <h1 className="font-display text-lg font-black text-white truncate">رقابة المالك على الذكاء الاصطناعي</h1>
          </div>
          <button onClick={load} disabled={busy} className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200 disabled:opacity-50">
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-5 pb-24 flex flex-col gap-5">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setDays(p.id)} className={`rounded-xl px-3 py-1.5 text-xs font-bold border ${days === p.id ? 'bg-amber-500/15 border-amber-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>{p.label}</button>
          ))}
        </div>

        {/* Hero: estimated cost */}
        <section className="rounded-3xl border border-amber-400/30 bg-gradient-to-l from-amber-500/10 via-orange-500/5 to-transparent p-5 fade-up">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0"><Coins size={26} className="text-amber-400" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-bold">AI Costs — التكلفة التقديرية للفترة</p>
              {configured ? (
                <p className="font-display text-3xl font-black text-white">{cost ?? '—'} <span className="text-base text-slate-400">{settings.costs.currency}</span></p>
              ) : (
                <p className="font-display text-xl font-black text-amber-400">SETUP REQUIRED</p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">{configured ? 'محسوبة من الاستهلاك المسجّل × أسعار الوحدات التي أدخلتها.' : 'أدخل أسعار الوحدات بالأسفل لحساب التكلفة التقديرية.'} الفاتورة الفعلية في صفحة الفوترة بالمنصة.</p>
            </div>
            <span className={`shrink-0 text-[10px] font-black rounded-full px-2.5 py-1 ${settings.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>AI {settings.enabled ? 'يعمل' : 'متوقف'}</span>
          </div>
        </section>

        {s?.error && <p className="text-rose-400 text-xs font-bold">تعذر تحميل البيانات</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric icon={Activity} label="طلبات لمزود AI (Usage)" value={s?.requests} sub={`${fmt((s?.tokensIn || 0) + (s?.tokensOut || 0))} رمز تقديري`} />
          <Metric icon={MessagesSquare} label="رسائل المحادثات" value={s?.turns} />
          <Metric icon={ClipboardCheck} label="طلبات أنشأها AI" value={s?.aiOrders} sub="إجمالي" tone="text-emerald-400" />
          <Metric icon={Handshake} label="جولات التفاوض" value={s?.negotiations} tone="text-amber-400" />
          <Metric icon={BadgePercent} label="طلبات بخصم" value={s?.discounts} sub="إجمالي" tone="text-amber-300" />
          <Metric icon={Siren} label="التصعيدات" value={s?.escalations} sub="إجمالي" tone="text-orange-400" />
          <Metric icon={Mic} label="الاستخدام الصوتي" value={s ? `${Math.round((s.voiceSec || 0) / 60)} د` : null} sub={`${s?.voiceTurns ?? '—'} رسالة صوتية · ${fmt(s?.ttsChars)} حرف منطوق`} />
          <Metric icon={UserPlus} label="تسجيلات العملاء" value={s?.registrations} tone="text-sky-300" />
          <Metric icon={AlertOctagon} label="أخطاء AI" value={s?.errors} tone={s?.errors ? 'text-rose-400' : 'text-white'} sub="تعطل مزود / استجابة فاشلة" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel icon={Activity} title="الاستهلاك اليومي">
            {dateChart ? <Chart spec={dateChart} /> : <Empty>لا يوجد استهلاك مسجّل في هذه الفترة</Empty>}
          </Panel>

          <Panel icon={Cpu} title="حسب المزوّد / النموذج / الخدمة">
            <Group title="النوع" rows={s?.byKind} labels={{ ai: 'ذكاء اصطناعي', stt: 'كلام ← نص', tts: 'نص ← كلام' }} />
            <Group title="النموذج" rows={s?.byProvider} />
            <Group title="الوظيفة" rows={s?.byFeature} labels={{ chat: 'محادثة', handoff_summary: 'ملخص تحويل', classify_service: 'تصنيف خدمة', voice_message: 'رسالة صوتية', voice_reply: 'رد صوتي' }} />
          </Panel>

          <CostRates costs={settings.costs} onSave={(costs) => update({ costs })} />

          <Panel icon={ShieldCheck} title="السياسات العامة والصلاحيات" action={() => navigate('/staff/ai-settings?tab=permissions')}>
            <Line k="الحد الأقصى العام للخصم" v={`${settings.globalPolicy.maxDiscountPct}%`} />
            <Line k="التفاوض على مستوى النظام" v={settings.globalPolicy.negotiationAllowed !== false ? 'مسموح' : 'ممنوع'} />
            <Line k="الصوت" v={settings.globalPolicy.voiceEnabled !== false ? 'مفعّل' : 'متوقف'} />
            <Line k="المزوّد / النموذج" v={`${settings.providers.ai} / ${settings.providers.aiModel}`} />
            <Line k="الإجراءات المسموحة" v={`${allowedActions.length} من ${AI_PERMISSIONS.filter((p) => !p.locked).length}`} />
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => navigate('/staff/ai-settings?tab=discounts')} className={linkBtn}>قواعد الخصم</button>
              <button onClick={() => navigate('/staff/ai-settings?tab=providers')} className={linkBtn}>المزوّدون والنماذج</button>
              <button onClick={() => navigate('/staff/ai-settings?tab=privacy')} className={linkBtn}>الخصوصية</button>
            </div>
          </Panel>
        </div>

        <Panel icon={ScrollText} title="سجل الاستهلاك التفصيلي">
          {usageRows.length === 0 ? <Empty>لا يوجد استهلاك مسجّل بعد</Empty> : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[11px] min-w-[640px]">
                <thead>
                  <tr className="text-slate-500 text-right">
                    {['التاريخ', 'المزوّد', 'النموذج', 'الوظيفة', 'رموز', 'صوت', 'تكلفة', 'المستخدم', 'المحادثة'].map((h) => <th key={h} className="font-bold py-1.5 px-1">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {usageRows.map((r) => (
                    <tr key={r.id} className={`border-t border-white/5 ${r.error ? 'text-rose-300' : 'text-slate-300'}`}>
                      <td className="py-1.5 px-1 whitespace-nowrap" dir="ltr">{r.at ? new Date(r.at).toLocaleString('ar') : r.date}</td>
                      <td className="px-1">{r.provider}</td>
                      <td className="px-1">{r.model}</td>
                      <td className="px-1">{r.feature}{r.error ? ' ⚠️' : ''}</td>
                      <td className="px-1">{(r.tokensIn || 0) + (r.tokensOut || 0) || '—'}</td>
                      <td className="px-1">{r.voiceSeconds ? `${r.voiceSeconds}ث` : r.ttsChars ? `${r.ttsChars}ح` : '—'}</td>
                      <td className="px-1">{configured ? estimateCost(r, settings.costs) : '—'}</td>
                      <td className="px-1 truncate max-w-[110px]">{r.user}</td>
                      <td className="px-1 font-mono text-[10px] text-slate-500" dir="ltr">{String(r.conversation || '').slice(-8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel icon={ShieldCheck} title="سجل التدقيق — تغييرات إعدادات AI">
          {audit.length === 0 ? <Empty>لا توجد تغييرات مسجّلة بعد</Empty> : audit.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
              <p className="text-[11px] text-slate-300 truncate min-w-0">{a.by}{a.role ? ` (${a.role})` : ''} — {(a.sections || []).join('، ')}</p>
              <span className="text-[10px] text-slate-500 shrink-0" dir="ltr">{a.at ? new Date(a.at).toLocaleString('ar') : ''}</span>
            </div>
          ))}
        </Panel>
      </main>
    </div>
  )
}

function CostRates({ costs, onSave }) {
  const [f, setF] = useState(costs)
  const [saving, setSaving] = useState(false)
  useEffect(() => setF(costs), [costs])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Panel icon={Coins} title="أسعار الوحدات لحساب التكلفة">
      <div className="grid grid-cols-2 gap-2">
        <Field label="العملة" value={f.currency} onChange={set('currency')} />
        <Field label="لكل 1000 رمز" value={f.per1kTokens} onChange={set('per1kTokens')} num />
        <Field label="لكل دقيقة صوت (كلام ← نص)" value={f.perVoiceMinute} onChange={set('perVoiceMinute')} num />
        <Field label="لكل 1000 حرف منطوق" value={f.perTtsKChars} onChange={set('perTtsKChars')} num />
      </div>
      <button
        onClick={async () => { setSaving(true); try { await onSave({ currency: f.currency || 'USD', per1kTokens: Number(f.per1kTokens) || 0, perVoiceMinute: Number(f.perVoiceMinute) || 0, perTtsKChars: Number(f.perTtsKChars) || 0 }) } finally { setSaving(false) } }}
        disabled={saving}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-amber-500 text-black font-black rounded-xl py-2.5 text-xs disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ الأسعار
      </button>
      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">عدد الرموز تقديري من طول النص. استخدم هذه الأرقام للمتابعة، والمرجع النهائي للخصم هو صفحة الفوترة.</p>
    </Panel>
  )
}

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ar'))
const linkBtn = 'text-[11px] font-bold bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200'

function Group({ title, rows, labels = {} }) {
  if (!rows?.length) return null
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold text-slate-500 mb-1">{title}</p>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-xs mb-1">
          <span className="text-slate-300">{labels[r.key] || r.key}</span>
          <span className="text-white font-black">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

function Field({ label, value, onChange, num }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 mb-1">{label}</label>
      <input type={num ? 'number' : 'text'} step="any" value={value ?? ''} onChange={onChange} dir="ltr" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400" />
    </div>
  )
}

function Line({ k, v }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-400">{k}</span>
      <span className="text-xs font-bold text-white">{v}</span>
    </div>
  )
}

function Metric({ icon: Icon, label, value, sub, tone = 'text-white' }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 fade-up hover:bg-white/[0.06] transition-colors">
      <Icon size={16} className="text-amber-400 mb-2" />
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
        <h2 className="text-white font-bold text-sm flex items-center gap-1.5"><Icon size={15} className="text-amber-400" /> {title}</h2>
        {action && <button onClick={action} className="text-[11px] font-bold text-amber-400 flex items-center gap-0.5 hover:underline">فتح <ArrowLeft size={12} /></button>}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }) {
  return <p className="text-slate-500 text-xs text-center py-4">{children}</p>
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
