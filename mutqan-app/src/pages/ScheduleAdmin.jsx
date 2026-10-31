import { errText } from '../lib/_api'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { useSchedule } from '../hooks/useSchedule'
import { DEFAULT_SCHEDULE, normalizeSchedule, isOpenAt, isPeak, hourText, dayText } from '../lib/schedule'

const inp = 'w-full bg-white/10 border-2 border-white/20 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-sky-400'
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const Box = ({ title, hint, children }) => (
  <section className="bg-white/5 border-2 border-white/15 rounded-2xl p-4 flex flex-col gap-3">
    <div><h2 className="font-display font-black text-sm text-sky-300">{title}</h2>{hint && <p className="text-[11px] text-white/60 mt-0.5">{hint}</p>}</div>
    {children}
  </section>
)
const Row = ({ label, children }) => <label className="flex flex-col gap-1 text-[11px] font-black text-white/80">{label}{children}</label>

// Owner / operations: working hours, order-reception hours, rush hours, per-hour capacity and the postpone ladder the bot uses.
export default function ScheduleAdmin() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { cfg, load, save } = useSchedule({ poll: 30000 })
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (!f) setF(cfg) }, [cfg]) // eslint-disable-line
  const cur = f || cfg
  const set = (k, v) => setF((s) => ({ ...(s || cfg), [k]: v }))
  const hours = useMemo(() => {
    const out = []; const d = new Date(); d.setMinutes(0, 0, 0)
    for (let i = 0; i < 14; i++, d.setHours(d.getHours() + 1)) {
      const open = isOpenAt(cur, d); if (!open) continue
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
      const n = load[key] || 0, cap = isPeak(cur, d) ? cur.capPeak : cur.capNormal
      out.push({ k: key, label: `${dayText(d)} ${hourText(d)}`, n, cap, peak: isPeak(cur, d) })
    }
    return out
  }, [cur, load])

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">جارِ التحميل…</div>
  if (!(isOwner || role === 'operations')) return <div className="h-full flex items-center justify-center text-slate-400">للمالك ومشرف العمليات فقط</div>

  const submit = async () => {
    setBusy(true); setMsg('')
    try { await save(normalizeSchedule(f || cfg)); setMsg('تم الحفظ ✅ — البوت وصفحات الطلب تستخدم القواعد الجديدة فوراً') }
    catch (e) { setMsg(errText(e, 'تعذر الحفظ، حاول مرة أخرى')) }
    setBusy(false)
  }
  const peak = cur.peak || []
  const setPeak = (i, k, v) => set('peak', peak.map((p, j) => (j === i ? { ...p, [k]: v } : p)))

  return (
    <div className="h-full overflow-y-auto pb-24 text-white" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button>
        <div className="flex-1"><h1 className="font-display font-black text-base">نظام المواعيد</h1><p className="text-[11px] text-white/60">ساعات العمل والذروة وسعة الزيارات — البوت يلتزم بها</p></div>
        <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 bg-emerald-600 text-white font-black text-sm rounded-xl px-4 py-2.5 shadow-lg disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}حفظ</button>
      </header>
      {msg && <p className="mx-4 mt-3 bg-sky-600 text-white text-sm font-black rounded-xl p-3">{msg}</p>}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl mx-auto">
        <Box title="ساعات عمل الفنيين" hint="الزيارات تُحجز داخل هذا الوقت فقط">
          <div className="grid grid-cols-2 gap-2"><Row label="من"><input type="time" className={inp} value={cur.openFrom} onChange={(e) => set('openFrom', e.target.value)} /></Row><Row label="إلى"><input type="time" className={inp} value={cur.openTo} onChange={(e) => set('openTo', e.target.value)} /></Row></div>
          <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => { const closed = cur.closedDays.includes(i); return <button key={d} onClick={() => set('closedDays', closed ? cur.closedDays.filter((x) => x !== i) : [...cur.closedDays, i])} className={`px-3 py-1.5 rounded-full text-xs font-black border-2 ${closed ? 'bg-rose-600 border-rose-400' : 'bg-emerald-600/80 border-emerald-400'}`}>{d} {closed ? '· إجازة' : '· دوام'}</button> })}</div>
        </Box>
        <Box title="ساعات استقبال الطلبات" hint="خارج هذا الوقت البوت يقول للعميل إننا خارج الاستقبال ويسجّل طلبه لأقرب موعد">
          <div className="grid grid-cols-2 gap-2"><Row label="من"><input type="time" className={inp} value={cur.receiveFrom} onChange={(e) => set('receiveFrom', e.target.value)} /></Row><Row label="إلى"><input type="time" className={inp} value={cur.receiveTo} onChange={(e) => set('receiveTo', e.target.value)} /></Row></div>
        </Box>
        <Box title="أوقات الذروة" hint="في الذروة تقل السعة فيتوزع الضغط ويعرض البوت مواعيد أخف">
          {peak.map((p, i) => (
            <div key={i} className="flex items-end gap-2"><Row label="من"><input type="time" className={inp} value={p.from} onChange={(e) => setPeak(i, 'from', e.target.value)} /></Row><Row label="إلى"><input type="time" className={inp} value={p.to} onChange={(e) => setPeak(i, 'to', e.target.value)} /></Row><button onClick={() => set('peak', peak.filter((_, j) => j !== i))} className="w-10 h-10 rounded-lg bg-rose-600/80 flex items-center justify-center shrink-0"><Trash2 size={15} /></button></div>
          ))}
          {peak.length < 4 && <button onClick={() => set('peak', [...peak, { from: '16:00', to: '20:00' }])} className="self-start flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2 text-xs font-black"><Plus size={14} />إضافة وقت ذروة</button>}
        </Box>
        <Box title="السعة والتأجيل" hint="عدد الزيارات في الساعة، وأقل مهلة قبل أقرب موعد، وخطوات تأجيل البوت">
          <div className="grid grid-cols-3 gap-2">
            <Row label="سعة الساعة العادية"><input type="number" min="1" className={inp} value={cur.capNormal} onChange={(e) => set('capNormal', e.target.value)} /></Row>
            <Row label="سعة ساعة الذروة"><input type="number" min="1" className={inp} value={cur.capPeak} onChange={(e) => set('capPeak', e.target.value)} /></Row>
            <Row label="أقل مهلة (دقيقة)"><input type="number" min="0" className={inp} value={cur.leadMinutes} onChange={(e) => set('leadMinutes', e.target.value)} /></Row>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Row label="التأجيل الأول (دقيقة)"><input type="number" min="15" className={inp} value={cur.delaySteps[0] ?? 60} onChange={(e) => set('delaySteps', [e.target.value, cur.delaySteps[1] ?? 180])} /></Row>
            <Row label="التأجيل الثاني (دقيقة)"><input type="number" min="15" className={inp} value={cur.delaySteps[1] ?? 180} onChange={(e) => set('delaySteps', [cur.delaySteps[0] ?? 60, e.target.value])} /></Row>
          </div>
          <p className="text-[11px] text-white/60">بعد التأجيلين يعرض البوت «خلال اليوم»: الفني يتصل بالعميل قبل الوصول بساعة.</p>
          <button onClick={() => setF({ ...DEFAULT_SCHEDULE })} className="self-start text-[11px] font-black text-white/70 underline">استرجاع الافتراضي</button>
        </Box>
        <Box title="الحمل القادم (مباشر)" hint="عدد الحجوزات من السعة لكل ساعة">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {hours.map((h) => { const pct = h.n / h.cap; return <div key={h.k} className={`rounded-xl p-2.5 border-2 text-center ${pct >= 1 ? 'bg-rose-600/80 border-rose-300' : pct >= 0.5 ? 'bg-amber-500/80 border-amber-200 text-slate-900' : 'bg-emerald-600/70 border-emerald-300'}`}><p className="text-xs font-black">{h.label}</p><p className="text-lg font-black">{h.n}/{h.cap}</p>{h.peak && <p className="text-[10px] font-black">ذروة</p>}</div> })}
            {!hours.length && <p className="text-xs text-white/60 col-span-full">لا ساعات عمل قادمة حسب الإعداد الحالي.</p>}
          </div>
        </Box>
      </div>
    </div>
  )
}
