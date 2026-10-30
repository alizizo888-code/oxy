import { MapPin, Phone, Zap, UserCheck, Eye } from 'lucide-react'
import { specialtyLabel } from '../../constants'
import { isUnassigned, ageText, minsAgo, sourceLabel } from './helpers'

// Order reception board: everything that has come in and is still waiting for a technician, oldest urgent first.
export default function IntakeBoard({ orders, mode, onAssign, onAuto, onOpen, onLocate, busyId }) {
  const rows = (orders || []).filter(isUnassigned).sort((a, b) => ((b.priority === 'urgent') - (a.priority === 'urgent')) || new Date(a.createdAt) - new Date(b.createdAt))
  const today = (orders || []).filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString())
  const src = today.reduce((m, o) => { const k = sourceLabel(o); m[k] = (m[k] || 0) + 1; return m }, {})
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-slate-200">وصل اليوم: {today.length}</span>
        {Object.entries(src).map(([k, v]) => <span key={k} className="shrink-0 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-slate-300">{k}: {v}</span>)}
        <span className={`shrink-0 rounded-full px-3 py-1 ${mode === 'auto' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{mode === 'auto' ? 'التوزيع آلي — يُسند فور الوصول' : 'التوزيع يدوي — بانتظار قرارك'}</span>
      </div>
      {rows.length === 0 && <p className="text-slate-500 text-sm text-center py-8">لا توجد طلبات بانتظار الإسناد ✅</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {rows.map((o) => {
          const late = minsAgo(o.createdAt) > 15
          return (
            <div key={o.id} className={`rounded-2xl border p-3 flex flex-col gap-2 ${o.priority === 'urgent' ? 'bg-rose-500/10 border-rose-400/40' : 'bg-white/[0.04] border-white/10'}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm truncate">{o.priority === 'urgent' ? '🚨 ' : ''}{specialtyLabel(o.specialtyId)} · {o.clientName || 'عميل'}</p>
                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1"><MapPin size={11} />{o.address || 'بدون عنوان'}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className={`text-[11px] font-black ${late ? 'text-rose-300' : 'text-slate-300'}`}>منذ {ageText(o.createdAt)}</p>
                  <p className="text-[10px] text-slate-500">{sourceLabel(o)}</p>
                </div>
              </div>
              {(o.preferredTime || o.agreedPrice || o.price || o.priceQuote?.total) && <p className="text-[11px] text-slate-300">{o.preferredTime ? `⏰ ${o.preferredTime}` : ''}{o.preferredTime && (o.agreedPrice || o.price || o.priceQuote?.total) ? ' · ' : ''}{o.agreedPrice || o.price || o.priceQuote?.total ? `💰 ${o.agreedPrice || o.price || o.priceQuote?.total} ر.س` : ''}</p>}
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => onAssign(o)} className="flex-1 min-w-[90px] flex items-center justify-center gap-1 bg-primary text-black font-black rounded-xl py-2 text-xs"><UserCheck size={13} />إسناد يدوي</button>
                <button onClick={() => onAuto(o)} disabled={busyId === o.id} className="flex-1 min-w-[90px] flex items-center justify-center gap-1 bg-emerald-500 text-black font-black rounded-xl py-2 text-xs disabled:opacity-50"><Zap size={13} />آلي</button>
                {o.lat != null && <button onClick={() => onLocate(o)} className="bg-white/10 rounded-xl px-3 text-xs font-bold">📍</button>}
                <button onClick={() => onOpen(o)} className="bg-white/10 rounded-xl px-3"><Eye size={14} /></button>
                {o.clientPhone && <a href={`tel:${o.clientPhone}`} className="bg-emerald-600 rounded-xl px-3 flex items-center"><Phone size={14} /></a>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
