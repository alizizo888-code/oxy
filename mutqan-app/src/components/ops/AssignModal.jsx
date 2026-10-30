import { useState } from 'react'
import { X, Phone, Loader2, MapPin } from 'lucide-react'
import { specialtyLabel } from '../../constants'
import { rankTechs, kmText, ageText } from './helpers'

// Manual dispatch: pick the technician yourself. Ranked by availability then distance (live GPS when the technician's app is open).
export default function AssignModal({ order, profiles, orders, onAssign, onClose }) {
  const [busy, setBusy] = useState('')
  const ranked = rankTechs(order, profiles, orders)
  const go = async (t) => { setBusy(t.userId); try { await onAssign(order, t); onClose() } finally { setBusy('') } }
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-primary font-bold">إسناد يدوي</p>
            <p className="font-black text-white text-sm truncate">{specialtyLabel(order.specialtyId)} · {order.clientName || 'عميل'}</p>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1"><MapPin size={11} />{order.address || 'بدون عنوان'} · منذ {ageText(order.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400"><X size={18} /></button>
        </div>
        {ranked.length === 0 && <p className="text-slate-500 text-xs text-center py-6">لا يوجد فنيون مسجّلون</p>}
        <div className="grid gap-2">
          {ranked.map(({ t, dist, rem, ok, pos }, i) => (
            <div key={t.userId} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${ok ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-70'}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${!ok ? 'bg-slate-600' : pos?.live ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-700'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{i === 0 && ok && Number.isFinite(dist) ? '⭐ ' : ''}{t.displayName || 'فني'}</p>
                <p className="text-[11px] text-slate-400">{kmText(dist)}{pos?.live ? ' · مباشر' : ''} · متبقي اليوم {rem}/{t.dailyCapacity || 0}{t.active === false ? ' · مغلق' : ''}</p>
              </div>
              {t.phone && <a href={`tel:${t.phone}`} className="w-8 h-8 rounded-lg bg-emerald-600/80 flex items-center justify-center"><Phone size={14} /></a>}
              <button onClick={() => go(t)} disabled={!!busy} className="rounded-lg bg-primary text-black font-black text-xs px-3 py-2 disabled:opacity-50">{busy === t.userId ? <Loader2 size={13} className="animate-spin" /> : 'إسناد'}</button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">الفني غير المتاح (سعة مكتملة أو مغلق) يمكن إسناده يدويًا أيضًا عند الحاجة.</p>
      </div>
    </div>
  )
}
