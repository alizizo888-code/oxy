import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Minus, Plus, Calculator as CalcIcon, Zap, ArrowLeft } from 'lucide-react'
import { SPECIALTIES } from '../../constants'
import { ADDONS, computeQuote, PARTS_RULES } from '../../pricing'
import { usePricing } from '../../hooks/usePricing'

export default function Calculator() {
  const navigate = useNavigate()
  const [specialtyId, setSpecialtyId] = useState('ac')
  const [qty, setQty] = useState(1)
  const [addons, setAddons] = useState([])
  const [urgent, setUrgent] = useState(false)
  const { rules } = usePricing()
  const rule = rules[specialtyId]

  const quote = useMemo(() => computeQuote(rule, { qty, urgent, addons }), [rule, qty, urgent, addons])
  const partsLabel = PARTS_RULES.find((p) => p.id === rule?.partsRule)?.label
  const specialty = SPECIALTIES.find((s) => s.id === specialtyId)

  function toggleAddon(id) {
    setAddons((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#e8f5f2]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-black text-slate-900">حاسب الأسعار</h1>
            <p className="text-[11px] text-slate-500">تقدير فوري قبل المعاينة</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-md shadow-sky-200">
            <CalcIcon size={18} className="text-white" />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {/* Specialty */}
        <section className="fade-up">
          <h2 className="text-xs font-bold text-slate-600 mb-2 px-1">نوع الخدمة</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {SPECIALTIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSpecialtyId(s.id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold border active:scale-95 transition-all ${
                  specialtyId === s.id ? 'bg-primary text-white border-primary shadow-md shadow-sky-200' : 'bg-white text-slate-600 border-sky-100'
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Qty + urgency */}
        <section className="grid grid-cols-2 gap-2.5 fade-up" style={{ animationDelay: '60ms' }}>
          <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-3.5">
            <p className="text-[11px] font-bold text-slate-600 mb-2">عدد الوحدات / المواقع</p>
            <div className="flex items-center justify-between">
              <button onClick={() => setQty((v) => Math.max(1, v - 1))} className="w-9 h-9 rounded-xl bg-sky-50 text-primary flex items-center justify-center active:scale-90 transition-transform">
                <Minus size={16} />
              </button>
              <span className="font-display font-black text-xl text-slate-900">{qty}</span>
              <button onClick={() => setQty((v) => Math.min(12, v + 1))} className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center active:scale-90 transition-transform">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setUrgent((v) => !v)}
            className={`rounded-2xl border p-3.5 text-right active:scale-[0.98] transition-all ${
              urgent ? 'bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-200' : 'bg-white border-sky-100 text-slate-600 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Zap size={15} className={urgent ? 'text-amber-200' : 'text-rose-500'} />
              <p className="text-[11px] font-bold">طلب عاجل</p>
            </div>
            <p className={`text-[10px] mt-1.5 leading-relaxed ${urgent ? 'text-white/85' : 'text-slate-400'}`}>أولوية وصول أعلى (+{rule?.emergencyPct ?? 25}%)</p>
          </button>
        </section>

        {/* Addons */}
        <section className="fade-up" style={{ animationDelay: '120ms' }}>
          <h2 className="text-xs font-bold text-slate-600 mb-2 px-1">إضافات اختيارية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ADDONS.map((a) => {
              const on = addons.includes(a.id)
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAddon(a.id)}
                  className={`flex items-center justify-between rounded-2xl border px-3.5 py-3 active:scale-[0.98] transition-all ${
                    on ? 'bg-primary/10 border-primary/40' : 'bg-white border-sky-100 shadow-sm'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${on ? 'text-primary' : 'text-slate-600'}`}>{a.label}</span>
                  <span className={`text-[11px] font-black ${on ? 'text-primary' : 'text-slate-400'}`}>+{a.price} ر.س</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Result */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-blue-700 via-sky-600 to-sky-500 text-white p-5 shadow-lg shadow-sky-200 fade-up" style={{ animationDelay: '180ms' }}>
          <span className="pointer-events-none absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute top-3 left-5 text-xl opacity-30">❄</span>
          <p className="text-[11px] font-bold text-white/80">التقدير لـ {specialty?.label} × {qty}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display font-black text-3xl md:text-4xl drop-shadow">{quote.total}</span>
            <span className="text-sm font-bold text-white/85">ر.س</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-white/80">
            <span>الخدمة: {quote.service} ر.س</span>
            {quote.visitFee > 0 && <span>رسوم الزيارة: {quote.visitFee} ر.س</span>}
            {quote.emergency > 0 && <span>رسوم العاجل: {quote.emergency} ر.س</span>}
            {quote.addonsTotal > 0 && <span>الإضافات: {quote.addonsTotal} ر.س</span>}
          </div>
          <p className="text-[10px] text-white/70 mt-1.5">السعر الرسمي من جدول أسعار مُتقن{partsLabel ? ` — ${partsLabel}` : ''}.{rule?.extraNote ? ` ${rule.extraNote}` : ''}</p>
          <button
            onClick={() => navigate(`/new?specialty=${specialtyId}${urgent ? '&priority=urgent' : ''}`)}
            className="mt-4 w-full flex items-center justify-center gap-1.5 bg-white text-blue-700 font-display font-black rounded-full py-3 text-sm shadow active:scale-[0.98] transition-transform hover:bg-sky-50"
          >
            اطلب بهذه التفاصيل
            <ArrowLeft size={15} />
          </button>
        </section>
      </div>
    </div>
  )
}
