import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { ORDER_FLOW, STATUS_META } from '../constants'

export default function StatusTimeline({ status, dark = false }) {
  if (status === 'cancelled') {
    return (
      <div className={`flex items-center gap-2 text-sm font-bold ${dark ? 'text-rose-300' : 'text-rose-600'}`}>
        <XCircle size={18} />
        تم إلغاء هذا الطلب
      </div>
    )
  }
  const idx = ORDER_FLOW.indexOf(status)
  return (
    <div className="flex flex-col">
      {ORDER_FLOW.map((s, i) => {
        const reached = i <= idx
        const current = i === idx
        const meta = STATUS_META[s]
        const last = i === ORDER_FLOW.length - 1
        return (
          <div key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              {reached ? (
                <CheckCircle2 size={18} className={current ? 'text-primary' : dark ? 'text-slate-400' : 'text-primary/60'} />
              ) : (
                <Circle size={18} className={dark ? 'text-slate-700' : 'text-slate-200'} />
              )}
              {!last && <div className={`w-px flex-1 my-0.5 ${reached ? (dark ? 'bg-slate-600' : 'bg-primary/30') : dark ? 'bg-slate-800' : 'bg-slate-200'}`} style={{ minHeight: 14 }} />}
            </div>
            <div className="pb-3">
              <p className={`text-sm font-bold leading-5 ${reached ? (dark ? 'text-white' : 'text-slate-900') : dark ? 'text-slate-500' : 'text-slate-400'} ${current ? (dark ? 'text-primary' : 'text-primary') : ''}`}>
                {meta.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
