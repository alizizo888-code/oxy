import { specialtyLabel } from '../../constants'
import { DONE, RUNNING, isToday, ageText } from './helpers'

const COLS = [
  { id: 'assigned', title: 'مُسندة بانتظار القبول', color: '#3b82f6', pick: (o) => ['assigned', 'forced'].includes(o.status) && (o.technicianId || o.status === 'forced') },
  { id: 'run', title: 'جارية', color: '#f59e0b', pick: (o) => RUNNING.includes(o.status) },
  { id: 'done', title: 'تمت اليوم', color: '#10b981', pick: (o) => DONE.includes(o.status) && isToday(o.completedAt || o.updatedAt) },
  { id: 'failed', title: 'لم تتم / متعثرة', color: '#be123c', pick: (o) => (o.status === 'cancelled' && isToday(o.updatedAt)) || (o.escalation && !DONE.includes(o.status) && o.status !== 'cancelled') },
]

// Routing board: where every order stands after dispatch — done, not done, running, waiting for the technician.
export default function DispatchBoard({ orders, onOpen, onReassign }) {
  const list = (orders || []).filter((o) => !o.inhouse || RUNNING.includes(o.status) || DONE.includes(o.status))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {COLS.map((c) => {
        const rows = list.filter(c.pick).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 40)
        return (
          <div key={c.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><h3 className="text-white font-black text-xs flex-1">{c.title}</h3><span className="text-[11px] font-black" style={{ color: c.color }}>{rows.length}</span></div>
            {rows.length === 0 && <p className="text-slate-600 text-[11px] text-center py-4">—</p>}
            {rows.map((o) => (
              <div key={o.id} className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-right">
                <button onClick={() => onOpen(o)} className="w-full text-right">
                  <p className="text-white font-bold text-xs truncate">{specialtyLabel(o.specialtyId)} · {o.clientName || ''}</p>
                  <p className="text-[10px] text-slate-400 truncate">{o.technicianName ? `🧰 ${o.technicianName}` : 'بدون فني'} · {ageText(o.updatedAt || o.createdAt)}</p>
                  {o.escalation && c.id === 'failed' && <p className="text-[10px] text-rose-300 mt-0.5">⚠️ تصعيد: {o.escalation.reason}</p>}
                  {o.status === 'cancelled' && <p className="text-[10px] text-rose-300 mt-0.5">ملغاة</p>}
                </button>
                {(c.id === 'assigned' || c.id === 'failed') && o.status !== 'cancelled' && <button onClick={() => onReassign(o)} className="mt-1.5 w-full bg-white/10 rounded-lg py-1 text-[10px] font-bold text-slate-200">إعادة إسناد</button>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
