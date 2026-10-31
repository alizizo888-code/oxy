import { errText } from '../lib/_api'
import AccessDenied from '../components/AccessDenied'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Save, Loader2, Tag, Check } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { usePricing, usePricingInternal } from '../hooks/usePricing'
import { useAiSettings } from '../hooks/useAiSettings'
import { SPECIALTIES } from '../constants'
import { computeQuote, PARTS_RULES, buildLadder, offerFor, NEGOTIATION_STAGES } from '../pricing'

export default function PricingRules() {
  const navigate = useNavigate()
  const { role, isOwner, loading, refresh } = useTeamRole()
  const { rules, saveRule } = usePricing()
  const { internal, saveInternal } = usePricingInternal()
  const { settings } = useAiSettings()
  const [sel, setSel] = useState('ac')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({ ...rules[sel], commissionPct: internal[sel]?.commissionPct ?? 60 })
    setSaved(false)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, rules[sel], internal[sel]])

  const allowed = isOwner || role === 'operations'
  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <AccessDenied refresh={refresh} />
  if (!form) return <Centered>جارِ التحميل…</Centered>

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'number' ? e.target.value : e.target.value }))
  const n = (v) => Number(v) || 0
  const preview = computeQuote({ ...form, base: n(form.base), min: Math.min(n(form.min), n(form.base)), max: n(form.max), discountPct: n(form.discountPct), visitFee: n(form.visitFee), emergencyPct: n(form.emergencyPct), extraUnitPct: n(form.extraUnitPct) }, { globalMaxDiscountPct: settings.globalPolicy.maxDiscountPct })
  const ladder = buildLadder(settings.negotiation, n(form.maxAttempts) || 4)
  const commission = Math.round(preview.total * (n(form.commissionPct) / 100))

  async function save() {
    setError('')
    if (n(form.min) > n(form.base)) return setError('الحد الأدنى لا يمكن أن يتجاوز السعر الأساسي')
    if (n(form.max) < n(form.base)) return setError('الحد الأعلى لا يمكن أن يقل عن السعر الأساسي')
    setSaving(true)
    try {
      const { commissionPct, id, ...rule } = form
      await saveRule(sel, rule)
      await saveInternal(sel, { commissionPct })
      setSaved(true)
    } catch (e) {
      setError(errText(e, 'تعذر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <div>
            <p className="text-[11px] text-primary font-bold tracking-widest">MUTQAN PRICING ENGINE</p>
            <h1 className="font-display text-lg font-black text-white">قواعد التسعير</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 pt-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* Service list */}
        <aside className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {SPECIALTIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSel(s.id)}
              className={`shrink-0 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-bold border transition-colors ${
                sel === s.id ? 'bg-primary/15 border-primary text-white' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.07]'
              }`}
            >
              <span>{s.icon} {s.label}</span>
              <span className="text-[10px] text-slate-500 hidden md:inline">{rules[s.id]?.aiNegotiation === false ? '🔒 ' : ''}{rules[s.id]?.base} ر.س</span>
            </button>
          ))}
        </aside>

        <div className="flex flex-col gap-4">
          <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Tag size={16} className="text-primary" />
              <h2 className="text-white font-bold text-sm">{SPECIALTIES.find((s) => s.id === sel)?.label}</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Num label="السعر الأساسي (ر.س)" value={form.base} onChange={set('base')} />
              <Num label="الحد الأدنى (ر.س)" value={form.min} onChange={set('min')} />
              <Num label="الحد الأعلى (ر.س)" value={form.max} onChange={set('max')} />
              <Num label="حد الخصم (%)" value={form.discountPct} onChange={set('discountPct')} />
              <Num label="رسوم الزيارة (ر.س)" value={form.visitFee} onChange={set('visitFee')} />
              <Num label="رسوم الطوارئ (%)" value={form.emergencyPct} onChange={set('emergencyPct')} />
              <Num label="الوحدة الإضافية (% من الأساسي)" value={form.extraUnitPct} onChange={set('extraUnitPct')} />
              <Num label="عمولة الفني (%)" value={form.commissionPct} onChange={set('commissionPct')} />
              <Num label="محاولات التفاوض قبل التحويل لموظف" value={form.maxAttempts} onChange={set('maxAttempts')} />
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">هامش الشركة</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-emerald-400 font-black">{100 - n(form.commissionPct)}%</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, aiNegotiation: f.aiNegotiation === false }))}
              className="mt-3 w-full flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-right hover:bg-white/[0.07]"
            >
              <span>
                <span className="block text-xs font-bold text-white">تفاوض الذكاء الاصطناعي لهذه الخدمة</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">عند الإيقاف يعرض المساعد السعر الرسمي فقط لهذه الخدمة دون أي خصم</span>
              </span>
              <span className={`w-10 h-6 rounded-full p-0.5 shrink-0 transition-colors ${form.aiNegotiation !== false ? 'bg-primary' : 'bg-slate-600'}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${form.aiNegotiation !== false ? '-translate-x-4' : ''}`} />
              </span>
            </button>
            <label className="block text-[11px] font-bold text-slate-400 mt-3 mb-1">قاعدة قطع الغيار</label>
            <select value={form.partsRule} onChange={set('partsRule')} className={inputCls}>
              {PARTS_RULES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <label className="block text-[11px] font-bold text-slate-400 mt-3 mb-1">قواعد الخدمات الإضافية / ملاحظة للعميل</label>
            <textarea value={form.extraNote || ''} onChange={set('extraNote')} rows={2} className={`${inputCls} resize-none`} placeholder="مثال: فك وتركيب المكيف الإضافي يُحسب بعد المعاينة" />

            {error && <p className="text-rose-400 text-xs font-bold text-center mt-3">{error}</p>}
            <button onClick={save} disabled={saving} className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-black font-display font-black rounded-xl py-3 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'تم الحفظ — يطبّق فورًا على المساعد والحاسبة' : 'حفظ قواعد الخدمة'}
            </button>
          </section>

          {/* Live preview of what the AI may offer */}
          <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-bold text-sm mb-1">معاينة: ما يسمح به محرك التفاوض لوحدة واحدة</h3>
            <p className="text-[10px] text-slate-500 mb-3">الحد الأقصى العام للخصم (يحدده المالك): {settings.globalPolicy.maxDiscountPct}% — يُطبّق الأقل بينه وبين حد خصم الخدمة.</p>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <Stat label="السعر الرسمي" value={preview.total} />
              <Stat label="أدنى سعر مسموح" value={preview.floor} tone="text-amber-400" />
              <Stat label="عمولة الفني" value={commission} tone="text-emerald-400" />
            </div>
            {form.aiNegotiation === false ? (
              <p className="text-slate-500 text-xs">التفاوض متوقف لهذه الخدمة — يعرض المساعد السعر الرسمي فقط.</p>
            ) : settings.negotiation.enabled && settings.globalPolicy.negotiationAllowed !== false ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {ladder.map((st, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300">
                      {NEGOTIATION_STAGES.find((x) => x.id === st.stage)?.label}: <b className="text-white">{offerFor(st, preview)}</b>
                    </span>
                    {i < ladder.length - 1 && <span className="text-slate-600 text-xs">←</span>}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs">التفاوض متوقف من إعدادات الذكاء الاصطناعي — يُعرض السعر الرسمي فقط.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary'

function Num({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-400 mb-1">{label}</label>
      <input type="number" inputMode="decimal" value={value ?? ''} onChange={onChange} className={inputCls} dir="ltr" />
    </div>
  )
}

function Stat({ label, value, tone = 'text-white' }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`font-display font-black text-lg ${tone}`}>{value}</p>
    </div>
  )
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
