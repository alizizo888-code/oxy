import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, ShieldCheck, Flame } from 'lucide-react'
import { useAcConfig } from '../hooks/useAcConfig'
import { AC_MODES, AC_TYPES, AC_WARRANTY, acQuote, hasDepth } from '../acPricing'

const sel = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:border-primary'

// Shown only after the customer picks the "مكيفات" specialty: mode, type, quantity, warranty, VAT -> live price.
export default function AcCalculator({ offerKey, onChange }) {
  const { cfg, offers, media } = useAcConfig()
  const [mode, setMode] = useState('wash')
  const [type, setType] = useState('سبليت')
  const [qty, setQty] = useState(1)
  const [full, setFull] = useState(true)
  const [warranty, setWarranty] = useState('بدون')
  const [vat, setVat] = useState(false)
  const [photo, setPhoto] = useState(0)

  const types = mode === 'install' ? AC_TYPES.install : AC_TYPES[mode].map((v) => ({ v, l: v }))
  useEffect(() => { setType(types[0].v) }, [mode]) // eslint-disable-line

  // Prefill from an offer card (?offer=KEY)
  useEffect(() => {
    const o = offerKey && offers.find((x) => (x.key || x.id) === offerKey)
    if (o) { setMode(o.acMode); setType(o.acType || 'سبليت'); setQty(Number(o.qty) || 1) }
  }, [offerKey, offers.length]) // eslint-disable-line

  const q = useMemo(() => acQuote(cfg, { mode, type, qty, full, warranty, vat, offers }), [cfg, mode, type, qty, full, warranty, vat, offers])
  useEffect(() => { onChange?.({ ...q, full, warranty, vat }) }, [q.total, q.mode, q.type, q.qty, full, warranty, vat]) // eslint-disable-line

  const pics = media.filter((m) => (m.specialty || 'ac') === 'ac' && (!m.category || m.category === mode)).sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99))
  useEffect(() => {
    if (pics.length < 2) return
    const t = setTimeout(() => setPhoto((p) => (p + 1) % pics.length), 3500)
    return () => clearTimeout(t)
  }, [photo, pics.length])

  const quickOffers = offers.filter((o) => o.active !== false && o.acMode === mode)

  return (
    <div className="flex flex-col gap-4">
      {pics.length > 0 && (
        <div className="relative h-36 rounded-2xl overflow-hidden bg-slate-100 shadow-sm">
          <img src={pics[photo % pics.length].url} alt={pics[photo % pics.length].title || ''} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          {pics[photo % pics.length].title && <p className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[11px] font-bold px-3 py-2">{pics[photo % pics.length].title}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
        {AC_MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`py-2.5 rounded-xl text-xs font-black transition ${mode === m.id ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>
            <span className="block text-base">{m.icon}</span>{m.label}
          </button>
        ))}
      </div>

      {quickOffers.length > 0 && (
        <div className="flex flex-col gap-2">
          {quickOffers.map((o) => (
            <button key={o.key || o.id} onClick={() => { setType(o.acType || 'سبليت'); setQty(Number(o.qty) || 1) }}
              className="flex items-center justify-between gap-2 text-right bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-black text-amber-900"><Flame size={14} className="text-amber-500" />{o.title}{o.badge ? <em className="not-italic text-[10px] bg-amber-200 rounded-full px-2 py-0.5">{o.badge}</em> : null}</span>
              <span className="text-sm font-black text-amber-700">{o.price} ر.س</span>
            </button>
          ))}
        </div>
      )}

      <label className="block text-xs font-bold text-slate-500">نوع المكيف
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${sel} mt-1.5`}>
          {types.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </label>

      {mode !== 'maintenance' && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
          <div><p className="text-xs font-black text-slate-800">عدد المكيفات</p><p className="text-[10px] text-slate-400">خصم تلقائي عند زيادة العدد</p></div>
          <div className="flex items-center gap-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><Minus size={14} /></button>
            <span className="w-8 text-center font-black">{qty}</span>
            <button onClick={() => setQty(Math.min(50, qty + 1))} className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center"><Plus size={14} /></button>
          </div>
        </div>
      )}

      {hasDepth(mode, type) && (
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
          {[[true, 'داخلي وخارجي'], [false, 'داخلي فقط']].map(([v, l]) => (
            <button key={l} onClick={() => setFull(v)} className={`py-2 rounded-xl text-xs font-black ${full === v ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      )}

      {mode === 'maintenance' && (
        <p className="bg-amber-50 border-r-4 border-amber-400 rounded-xl p-3 text-[11px] font-bold text-amber-900 leading-relaxed">
          الكشفية مجانية لفحص حتى مكيفين، وإذا زاد العدد عن مكيفين ولم يتم العمل أو الاتفاق تُحتسب كشفية الزيارة {cfg.visitFee} ريال.
        </p>
      )}

      {mode === 'wash' && (
        <label className="block text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1"><ShieldCheck size={13} className="text-amber-500" />مدة الضمان</span>
          <select value={warranty} onChange={(e) => setWarranty(e.target.value)} className={`${sel} mt-1.5 border-amber-300`}>
            {AC_WARRANTY.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
          </select>
        </label>
      )}

      <label className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-3 shadow-sm text-xs font-black text-slate-700">
        ضريبة القيمة المضافة ({cfg.vatPct}%)
        <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="w-5 h-5 accent-sky-600" />
      </label>

      <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 text-white p-4 text-center shadow-md">
        {q.onInspection && !q.total ? (
          <>
            <p className="text-[11px] opacity-80">السعر</p>
            <p className="text-lg font-black">{mode === 'maintenance' ? 'يُحدَّد بعد الفحص' : 'يُحدَّد بعد المعاينة'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] opacity-80">{q.offer ? `🎉 عرض مفعّل: ${q.offer.title}` : 'الإجمالي التقديري'}</p>
            <p className="text-3xl font-black">{q.total} <span className="text-sm">ر.س</span></p>
            {q.warrantyAdd > 0 && <p className="text-[10px] opacity-80">يشمل إضافة الضمان {q.warrantyAdd} ر.س</p>}
          </>
        )}
      </div>
    </div>
  )
}
