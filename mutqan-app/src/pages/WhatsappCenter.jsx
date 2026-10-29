import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Save, Loader2, Trash2, X, MessageCircle, ExternalLink, Info, Users } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { useTeamRole } from '../hooks/useTeamRole'
import { useWaNumbers, saveWaNumber, removeWaNumber, WA_DEPARTMENTS, WA_TYPES, deptMeta } from '../hooks/useWaNumbers'
import { fmtDate } from '../warranty'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export default function WhatsappCenter() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { numbers, loading: loadingNums } = useWaNumbers()
  const { data: leads } = useLiveShared('wa_leads', { order: '-at', limit: 100 })
  const [editing, setEditing] = useState(null)

  const countByNumber = useMemo(() => {
    const m = {}
    for (const l of leads || []) m[l.numberId] = (m[l.numberId] || 0) + 1
    return m
  }, [leads])

  const allowed = isOwner || role === 'operations'
  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <Centered>هذه الصفحة للمالك ومشرف العمليات فقط</Centered>

  async function toggle(n) {
    try { await saveWaNumber({ ...n, enabled: !n.enabled }) } catch { alert('تعذر الحفظ') }
  }

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ChevronRight size={18} className="text-slate-300" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-emerald-400 font-bold tracking-widest">WHATSAPP CENTER</p>
            <h1 className="font-display text-lg font-black text-white">أرقام الواتساب</h1>
          </div>
          <button onClick={() => window.open(`${APP_URL}/#/contact`, '_blank', 'noopener')} className="hidden sm:flex shrink-0 items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200"><ExternalLink size={13} /> الواجهة العامة</button>
          <button onClick={() => setEditing({ label: '', phone: '', type: 'business', department: 'orders', enabled: true, hours: '', sort: numbers.length + 1 })} className="shrink-0 flex items-center gap-1.5 bg-emerald-500 text-black rounded-xl px-3 py-2 text-xs font-black"><Plus size={14} /> رقم جديد</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-5 flex flex-col gap-4">
        <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 flex gap-3 text-xs leading-relaxed">
          <Info size={17} className="text-sky-400 shrink-0 mt-0.5" />
          <div className="text-slate-300">
            <p className="font-black text-white">كيف تعمل الأرقام</p>
            <p className="mt-0.5">أضف أي عدد من الأرقام (أعمال أو عادي) ووزّعها على الأقسام. في الواجهة العامة للعملاء، ضغطة زر القسم تفتح واتساب العميل على أحد أرقام هذا القسم بالتناوب، ويُسجَّل التواصل هنا. الردود تتم من جوال الموظف صاحب الرقم. المساعد MUTQAN AI يرد آليًا على العملاء داخل التطبيق فقط (محادثة الويب)، وليس داخل واتساب.</p>
          </div>
        </section>

        {loadingNums ? <p className="text-slate-500 text-xs text-center py-8">جارِ التحميل…</p> : numbers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
            <MessageCircle size={30} className="mx-auto text-slate-600" />
            <p className="text-sm text-slate-400 mt-2 font-bold">لا توجد أرقام بعد — SETUP REQUIRED</p>
            <p className="text-[11px] text-slate-500 mt-1">أضف أول رقم ليظهر في الواجهة العامة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {numbers.map((n, i) => {
              const d = deptMeta(n.department)
              return (
                <div key={n.id} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 fade-up hover:bg-white/[0.06]" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{n.label || 'رقم بدون اسم'}</p>
                      <p className="text-[11px] text-slate-400" dir="ltr">+{n.phone}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{d.label} · {WA_TYPES.find((t) => t.id === n.type)?.label}{n.hours ? ` · ${n.hours}` : ''}{n.acceptsCalls ? ' · 📞 مكالمات' : ''}</p>
                    </div>
                    <button onClick={() => toggle(n)} className={`w-11 h-6 rounded-full p-0.5 shrink-0 ${n.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} aria-label="تفعيل">
                      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${n.enabled ? '-translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1"><Users size={10} /> {countByNumber[n.id] || 0} تواصل مسجل (آخر 100)</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setEditing(n)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 text-xs font-bold text-slate-200">تعديل</button>
                    <button onClick={async () => { if (confirm(`حذف «${n.label || n.phone}»؟`)) { try { await removeWaNumber(n) } catch { alert('تعذر الحذف') } } }} className="w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center hover:bg-rose-500/20"><Trash2 size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <p className="text-sm font-black text-white mb-3">آخر التواصلات من الواجهة العامة</p>
          {(leads || []).length === 0 ? <p className="text-[11px] text-slate-500">لا توجد تواصلات بعد.</p> : (
            <div className="flex flex-col divide-y divide-white/5">
              {leads.slice(0, 30).map((l) => (
                <div key={l.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-200 truncate">{l.customerName || 'زائر'} → {l.numberLabel || l.phone}</span>
                  <span className="text-slate-500 shrink-0">{deptMeta(l.department).label} · {fmtDate(l.at)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-2">يُسجَّل فتح المحادثة فقط؛ نص الرسائل والردود تبقى داخل واتساب ولا تصل للتطبيق.</p>
        </section>
      </main>

      {editing && <Editor n={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Editor({ n, onClose }) {
  const [f, setF] = useState({ ...n })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function save() {
    const phone = String(f.phone || '').replace(/\D/g, '').replace(/^00/, '')
    if (phone.length < 9) return setErr('اكتب الرقم بصيغة دولية مع رمز الدولة، مثال 9665XXXXXXXX')
    setBusy(true); setErr('')
    try { await saveWaNumber({ ...f, phone, label: f.label.trim(), sort: Number(f.sort) || 99 }); onClose() } catch { setErr('تعذر الحفظ — تأكد من صلاحياتك') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} dir="rtl">
      <div className="w-full max-w-lg bg-[#0f1422] border border-white/10 rounded-t-3xl md:rounded-3xl p-5 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-black text-white flex items-center gap-2"><MessageCircle size={18} className="text-emerald-400" /> {n.id ? 'تعديل رقم' : 'رقم واتساب جديد'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><X size={16} className="text-slate-300" /></button>
        </div>
        <label className={lbl}>اسم الرقم / الموظف</label>
        <input value={f.label} onChange={set('label')} className={inp} placeholder="مثال: خدمة العملاء — جدة" />
        <label className={lbl}>الرقم بصيغة دولية</label>
        <input value={f.phone} onChange={set('phone')} className={inp} dir="ltr" inputMode="tel" placeholder="9665XXXXXXXX" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>النوع</label>
            <select value={f.type} onChange={set('type')} className={inp}>{WA_TYPES.map((t) => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>القسم</label>
            <select value={f.department} onChange={set('department')} className={inp}>{WA_DEPARTMENTS.map((d) => <option key={d.id} value={d.id} className="bg-slate-900">{d.icon} {d.label}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>ساعات العمل</label>
            <input value={f.hours || ''} onChange={set('hours')} className={inp} placeholder="9ص – 11م" />
          </div>
          <div>
            <label className={lbl}>الترتيب</label>
            <input type="number" value={f.sort ?? 99} onChange={set('sort')} className={inp} dir="ltr" />
          </div>
        </div>
        <button type="button" onClick={() => setF((x) => ({ ...x, acceptsCalls: !x.acceptsCalls }))} className="mt-3 w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
          <span className="text-xs font-bold text-slate-200">يستقبل المكالمات (زر «اتصال» العائم)</span>
          <span className={`w-11 h-6 rounded-full p-0.5 ${f.acceptsCalls ? 'bg-emerald-500' : 'bg-slate-600'}`}><span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${f.acceptsCalls ? '-translate-x-5' : ''}`} /></span>
        </button>
        <label className={lbl}>رسالة البداية الجاهزة (اختياري)</label>
        <input value={f.prefill || ''} onChange={set('prefill')} className={inp} placeholder={deptMeta(f.department).prefill} />
        {err && <p className="text-rose-400 text-xs font-bold mt-3">{err}</p>}
        <button onClick={save} disabled={busy} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 text-black font-black rounded-xl py-3 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} حفظ
        </button>
      </div>
    </div>
  )
}

const lbl = 'block text-[11px] font-bold text-slate-400 mt-3 mb-1'
const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400'

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
