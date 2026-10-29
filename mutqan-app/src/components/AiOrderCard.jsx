import { useState } from 'react'
import { ClipboardCheck, Loader2, MapPin, Zap, Clock, Check } from 'lucide-react'
import { maps } from '../lib/maps'
import { SPECIALTIES } from '../constants'
import PermissionHelp from './PermissionHelp'
import { permissionState } from '../hooks/useLocator'

// The order MUTQAN AI understood from the conversation — the customer reviews,
// adjusts, and confirms. Only this confirmation creates the real order.
const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-primary'

export default function AiOrderCard({ draft, session, onChange, onConfirm, busy, quote, allowUrgent = true }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [locDenied, setLocDenied] = useState(false)
  const [consent, setConsent] = useState(false)
  const loc = draft.coords || session?.location || null
  const steps = [
    { label: 'النية', ok: !!(draft.problem || draft.specialtyId) },
    { label: 'الخدمة', ok: !!draft.specialtyId },
    { label: 'التوثيق', ok: true },
    { label: 'الموقع', ok: !!loc },
    { label: 'السعر', ok: !!quote },
    { label: 'التأكيد', ok: consent },
  ]
  const qty = draft.qty || 1
  const finalPrice = quote ? draft.agreedPrice || quote.total : null

  async function locate() {
    setLocating(true)
    setError('')
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      let address = ''
      try { address = (await maps.reverseGeocode(lat, lng))?.address || '' } catch {}
      onChange({ coords: { lat, lng, address } })
      setLocDenied(false)
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setError(denied ? 'صلاحية الموقع مقفولة — اضغط «تفعيل الأذونات»' : 'تعذر تحديد موقعك الآن — حاول مرة أخرى')
    } finally {
      setLocating(false)
    }
  }

  function confirm() {
    if (!draft.specialtyId) return setError('اختر نوع الخدمة')
    if (!loc) return setError('حدد موقع الخدمة')
    if (!quote) return setError('تعذر حساب السعر لهذه الخدمة')
    if (!consent) return setError('أكّد موافقتك على الطلب والسعر أولًا')
    setError('')
    onConfirm({ ...draft, coords: loc })
  }

  return (
    <div className="bg-white border border-sky-100 rounded-2xl shadow-sm p-4 fade-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
          <ClipboardCheck size={18} className="text-emerald-600" />
        </div>
        <div>
          <p className="font-display font-black text-slate-900 text-sm">ملخص طلبك</p>
          <p className="text-[10px] text-slate-500">راجع ما فهمه المساعد ثم أكّد</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {steps.map((s, i) => (
          <div key={s.label} className="flex-1 flex flex-col items-center gap-0.5">
            <div className={`w-full h-1 rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            <span className={`text-[9px] font-bold flex items-center gap-0.5 ${s.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
              {s.ok && <Check size={9} />}{i + 1}. {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <select value={draft.specialtyId || ''} onChange={(e) => onChange({ specialtyId: e.target.value, agreedPrice: null, negotiation: null })} className={inputCls}>
          <option value="">— نوع الخدمة —</option>
          {SPECIALTIES.map((s) => (
            <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
          ))}
        </select>
        <textarea value={draft.problem || ''} onChange={(e) => onChange({ problem: e.target.value })} rows={2} placeholder="وصف المشكلة" className={`${inputCls} resize-none`} />
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <span className="text-[11px] font-bold text-slate-500">عدد الوحدات</span>
          <div className="flex items-center gap-3">
            <button onClick={() => onChange({ qty: Math.max(1, qty - 1), agreedPrice: null, negotiation: null })} className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-black text-slate-600">−</button>
            <span className="font-display font-black text-sm text-slate-900 w-4 text-center">{qty}</span>
            <button onClick={() => onChange({ qty: Math.min(50, qty + 1), agreedPrice: null, negotiation: null })} className="w-7 h-7 rounded-lg bg-primary text-white font-black">+</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!allowUrgent}
            onClick={() => onChange({ priority: draft.priority === 'urgent' ? 'normal' : 'urgent', agreedPrice: null, negotiation: null })}
            className={`rounded-xl py-2 text-[11px] font-bold border flex items-center justify-center gap-1 ${draft.priority === 'urgent' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
          >
            <Zap size={12} /> {draft.priority === 'urgent' ? 'عاجل' : 'عادي'}
          </button>
          <div className="relative">
            <input value={draft.preferredTime || ''} onChange={(e) => onChange({ preferredTime: e.target.value })} placeholder="الموعد المفضل" className={`${inputCls} pr-7`} />
            <Clock size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <button onClick={locate} disabled={locating} className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 text-[11px] font-bold text-sky-700 text-right">
          {locating ? <Loader2 size={13} className="animate-spin shrink-0" /> : <MapPin size={13} className="shrink-0" />}
          <span className="truncate">{loc ? loc.address || 'تم تحديد الموقع — اضغط للتحديث' : draft.locationText ? `${draft.locationText} — اضغط لتحديد الموقع بدقة` : 'تحديد موقعي الحالي'}</span>
        </button>
        {quote && (
          <div className="bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-xl px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold">{draft.agreedPrice ? 'السعر المتفق عليه' : 'السعر الرسمي'}</span>
              <span className="font-display font-black text-sm">
                {draft.agreedPrice && draft.agreedPrice < quote.total && <s className="text-white/60 text-[11px] ml-1.5">{quote.total}</s>}
                {finalPrice} ر.س
              </span>
            </div>
            <p className="text-[9px] text-white/75 mt-0.5">
              الخدمة {quote.service}{quote.visitFee ? ` · زيارة ${quote.visitFee}` : ''}{quote.emergency ? ` · عاجل ${quote.emergency}` : ''} — {quote.partsLabel}
            </p>
          </div>
        )}
      </div>

      <label className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-emerald-600" />
        <span className="text-[10px] text-slate-600 leading-relaxed">
          أوافق على إنشاء هذا الطلب{finalPrice ? ` بسعر ${finalPrice} ر.س` : ''} ومشاركة موقعي مع الفني المسند. الدفع يتم بعد الخدمة، ولا يُخصم أي مبلغ الآن.
        </span>
      </label>

      {locDenied && <div className="mt-2"><PermissionHelp kind="location" onRetry={locate} /></div>}
      {error && <p className="text-rose-600 text-[11px] font-bold text-center mt-2">{error}</p>}
      <button
        onClick={confirm}
        disabled={busy || !consent}
        className="mt-3 w-full bg-emerald-600 text-white font-display font-black rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        تأكيد وإرسال الطلب
      </button>
    </div>
  )
}
