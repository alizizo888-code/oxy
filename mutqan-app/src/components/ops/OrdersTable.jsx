import { useMemo, useState } from 'react'
import { Search, Phone } from 'lucide-react'
import { STATUS_META, specialtyLabel } from '../../constants'
import { DONE, RUNNING, ageText, isUnassigned, sourceLabel } from './helpers'

const FILTERS = [
  ['all', 'الكل', () => true],
  ['wait', 'بانتظار الإسناد', isUnassigned],
  ['assigned', 'مُسندة', (o) => ['assigned', 'forced'].includes(o.status) && !isUnassigned(o)],
  ['run', 'قيد التنفيذ', (o) => RUNNING.includes(o.status)],
  ['done', 'المكتملة', (o) => DONE.includes(o.status)],
  ['cancel', 'ملغاة', (o) => o.status === 'cancelled'],
]
const priceOf = (o) => Number(o.price || o.agreedPrice || o.priceQuote?.total || 0)

// Orders table (reference: design-reference/09): search + status filters + one row per order.
export default function OrdersTable({ orders, onOpen, onAssign }) {
  const [f, setF] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const rows = useMemo(() => {
    const pick = FILTERS.find((x) => x[0] === f)[2]
    const s = q.trim()
    return (orders || []).filter(pick).filter((o) => !s || [o.id, o.clientName, o.clientPhone, o.address, o.technicianName, specialtyLabel(o.specialtyId)].some((v) => String(v || '').includes(s)))
  }, [orders, f, q])
  const PAGE = 25
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2"><Search size={14} className="text-slate-500" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="بحث برقم الطلب، العميل، الجوال، الحي، الفني…" className="flex-1 bg-transparent text-xs text-white outline-none" /></div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(([id, label, fn]) => <button key={id} onClick={() => { setF(id); setPage(0) }} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border ${f === id ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>{label} ({(orders || []).filter(fn).length})</button>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-right text-[11px] min-w-[820px]">
          <thead className="bg-white/[0.06] text-slate-300"><tr>{['رقم الطلب', 'الخدمة', 'العميل والموقع', 'الفني', 'الحالة', 'القيمة والدفع', 'المصدر', 'منذ', ''].map((h) => <th key={h} className="px-2.5 py-2 font-black whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((o) => {
              const m = STATUS_META[o.status] || {}
              return (
                <tr key={o.id} className="border-t border-white/5 text-slate-200 hover:bg-white/[0.03]">
                  <td className="px-2.5 py-2"><button onClick={() => onOpen(o)} className="font-black text-primary" dir="ltr">#{String(o.id).slice(-5)}</button>{o.priority === 'urgent' && <span className="mr-1 rounded bg-rose-500/25 text-rose-200 px-1.5 text-[9px] font-black">عاجل</span>}</td>
                  <td className="px-2.5 py-2 whitespace-nowrap">{specialtyLabel(o.specialtyId)}{o.preferredTime ? <p className="text-[9px] text-slate-500">⏰ {o.preferredTime}</p> : null}</td>
                  <td className="px-2.5 py-2 max-w-[200px]"><p className="font-bold text-white truncate">{o.clientName || 'عميل'}</p><p className="text-[10px] text-slate-500 truncate">{o.address || '—'}</p></td>
                  <td className="px-2.5 py-2 whitespace-nowrap">{o.technicianName ? `🧰 ${o.technicianName}` : o.inhouse ? 'تنفيذ داخلي' : <span className="text-rose-300">بدون فني</span>}</td>
                  <td className="px-2.5 py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-black whitespace-nowrap" style={{ background: (m.color || '#64748b') + '33', color: m.color }}>{m.label || o.status}</span></td>
                  <td className="px-2.5 py-2 whitespace-nowrap">{priceOf(o) ? `${priceOf(o)} ر.س` : '—'}<p className={`text-[9px] ${o.paymentStatus === 'paid' ? 'text-emerald-300' : 'text-slate-500'}`}>{o.paymentStatus === 'paid' ? '✓ مدفوع' : 'غير مدفوع'}</p></td>
                  <td className="px-2.5 py-2 whitespace-nowrap text-slate-400">{sourceLabel(o)}</td>
                  <td className="px-2.5 py-2 whitespace-nowrap text-slate-400">{ageText(o.createdAt)}</td>
                  <td className="px-2.5 py-2 whitespace-nowrap">
                    {['new', 'forced', 'assigned'].includes(o.status) && !o.inhouse && <button onClick={() => onAssign(o)} className="rounded-lg bg-primary text-black font-black px-2.5 py-1 ml-1">{o.technicianId ? 'إعادة' : 'إسناد'}</button>}
                    {o.clientPhone && <a href={`tel:${o.clientPhone}`} className="inline-flex w-7 h-7 rounded-lg bg-emerald-600/80 items-center justify-center align-middle"><Phone size={12} /></a>}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && <tr><td colSpan={9} className="text-center text-slate-500 py-8">لا توجد طلبات</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>عرض {shown.length} من {rows.length}</span>
        <div className="flex gap-1.5"><button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg bg-white/10 px-3 py-1 disabled:opacity-40">السابق</button><span className="py-1">{page + 1}/{pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg bg-white/10 px-3 py-1 disabled:opacity-40">التالي</button></div>
      </div>
    </div>
  )
}
