import { useMemo } from 'react'
import { Phone } from 'lucide-react'
import { remainingCapacity, isTechAvailable, TECH_LEVELS } from '../../assignment'
import { specialtyLabel } from '../../constants'
import { DONE, RUNNING, isToday, techPos, minsAgo } from './helpers'
import { seenAgo } from '../../lib/crm'

const atOf = (o, st) => [...(o.statusHistory || [])].find((h) => h.status === st)?.at

// Technician performance table (reference: design-reference/08). Everything is computed from real orders only.
export default function TechTable({ profiles, orders, sharePct, onOpenTech }) {
  const rows = useMemo(() => (profiles || []).map((t) => {
    const mine = (orders || []).filter((o) => o.technicianId === t.userId)
    const done = mine.filter((o) => DONE.includes(o.status))
    const month = done.filter((o) => { const d = new Date(o.completedAt || o.updatedAt); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() })
    const rated = mine.filter((o) => o.rating)
    const avg = rated.length ? rated.reduce((s, o) => s + Number(o.rating), 0) / rated.length : 0
    const resp = mine.map((o) => { const a = o.assignedAt, b = atOf(o, 'accepted'); return a && b ? (new Date(b) - new Date(a)) / 60000 : null }).filter((x) => x != null && x >= 0)
    const respAvg = resp.length ? resp.reduce((s, x) => s + x, 0) / resp.length : null
    const running = mine.filter((o) => RUNNING.includes(o.status)).length
    const queued = mine.filter((o) => ['assigned', 'forced'].includes(o.status)).length
    const cancelled = mine.filter((o) => o.status === 'cancelled').length
    const monthSales = month.reduce((s, o) => s + (Number(o.price) || 0), 0)
    const p = techPos(t)
    const state = t.active === false ? ['مغلق', 'bg-slate-600'] : running ? ['في مهمة', 'bg-amber-600'] : isTechAvailable(t, orders || []) ? ['متاح', 'bg-emerald-600'] : ['اكتملت السعة', 'bg-rose-700']
    return { t, doneToday: done.filter((o) => isToday(o.completedAt || o.updatedAt)).length, doneTotal: done.length, month: month.length, avg, ratedN: rated.length, respAvg, running, queued, cancelled, monthSales, p, state, rem: remainingCapacity(t, orders || []) }
  }).sort((a, b) => b.doneTotal - a.doneTotal), [profiles, orders])

  if (!rows.length) return <p className="text-slate-500 text-xs text-center py-8">لا يوجد فنيون سجّلوا ملفاتهم بعد</p>
  const tot = rows.reduce((s, r) => ({ done: s.done + r.doneToday, run: s.run + r.running }), { done: 0, run: 0 })
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
        {[['إجمالي الفنيين', rows.length], ['في مهمة الآن', tot.run], ['متاحون', rows.filter((r) => r.state[0] === 'متاح').length], ['منجز اليوم', tot.done]].map(([l, v]) => <div key={l} className="rounded-xl bg-white/[0.04] border border-white/10 py-2.5"><p className="text-lg font-black font-display text-white">{v}</p><p className="text-[10px] text-slate-400 font-bold">{l}</p></div>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-right text-[11px] min-w-[760px]">
          <thead className="bg-white/[0.06] text-slate-300"><tr>{['الفني', 'الحالة', 'التقييم', 'استجابة القبول', 'اليوم', 'الشهر', 'الإجمالي', 'ملغاة', sharePct ? 'مستحقات الشهر' : 'مبيعات الشهر', 'آخر ظهور', ''].map((h) => <th key={h} className="px-2.5 py-2 font-black whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t.userId} className="border-t border-white/5 text-slate-200">
                <td className="px-2.5 py-2"><p className="font-black text-white">{r.t.displayName || 'فني'}</p><p className="text-[10px] text-slate-500">{TECH_LEVELS.find((l) => l.id === r.t.level)?.label || ''}{(r.t.specialties || []).length ? ` • ${(r.t.specialties || []).slice(0, 2).map(specialtyLabel).join('، ')}` : ''}</p></td>
                <td className="px-2.5 py-2"><span className={`${r.state[1]} rounded-full px-2 py-0.5 text-[10px] font-black whitespace-nowrap`}>{r.state[0]}</span>{r.queued > 0 && <span className="mr-1 text-sky-300 text-[10px]">+{r.queued} بانتظار</span>}</td>
                <td className="px-2.5 py-2 whitespace-nowrap">{r.avg ? <span className="text-amber-300 font-black">⭐ {r.avg.toFixed(2)} <span className="text-slate-500 font-normal">({r.ratedN})</span></span> : '—'}</td>
                <td className="px-2.5 py-2 whitespace-nowrap">{r.respAvg != null ? `${Math.round(r.respAvg)} د` : '—'}</td>
                <td className="px-2.5 py-2 font-black">{r.doneToday}</td>
                <td className="px-2.5 py-2">{r.month}</td>
                <td className="px-2.5 py-2">{r.doneTotal}</td>
                <td className={`px-2.5 py-2 ${r.cancelled ? 'text-rose-300 font-black' : ''}`}>{r.cancelled}</td>
                <td className="px-2.5 py-2 whitespace-nowrap">{r.monthSales ? `${Math.round(sharePct ? r.monthSales * sharePct / 100 : r.monthSales)} ر.س` : '—'}</td>
                <td className="px-2.5 py-2 whitespace-nowrap text-slate-400">{r.p?.live ? <span className="text-emerald-300">● مباشر</span> : seenAgo(r.t.lastSeenAt || r.t.updatedAt)}</td>
                <td className="px-2.5 py-2">{r.t.phone && <a href={`tel:${r.t.phone}`} className="inline-flex w-7 h-7 rounded-lg bg-emerald-600/80 items-center justify-center"><Phone size={12} /></a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500">كل الأرقام محسوبة من الطلبات الفعلية. «استجابة القبول» = متوسط الوقت من الإسناد حتى قبول الفني.</p>
    </div>
  )
}
