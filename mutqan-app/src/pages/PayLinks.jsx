import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Loader2, Copy, Check, Share2, X } from 'lucide-react'
import { post } from '../lib/_api'
import { useTeamRole } from '../hooks/useTeamRole'

const inp = 'w-full bg-white/10 border-2 border-white/20 rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400'
const ST = { open: ['بانتظار الدفع', 'bg-slate-600'], claimed: ['العميل أبلغ بالدفع', 'bg-amber-600'], paid: ['مدفوع', 'bg-emerald-600'], cancelled: ['ملغي', 'bg-rose-700'] }

// Payment links: the team creates a link with an amount; the customer opens /pay/CODE and sees the owner's own methods (bank transfer, wallets, card via the gateway link).
// "Paid" is set here by the team only after the money is seen (gateway dashboard / bank statement).
export default function PayLinks() {
  const navigate = useNavigate()
  const { role, loading } = useTeamRole()
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ amount: '', desc: '', client: '', orderId: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')
  const load = useCallback(async () => { try { const r = await post('/shop', { op: 'pay_list' }); setRows(r?.rows || []) } catch (e) { setMsg(e?.message || 'تعذر التحميل') } }, [])
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])
  if (!loading && !['owner', 'operations', 'supervisor'].includes(role)) return <p className="p-6 text-white text-sm font-bold" dir="rtl">هذه الصفحة للإدارة فقط.</p>

  const create = async () => {
    setBusy(true); setMsg('')
    try { const r = await post('/shop', { op: 'pay_create', ...f, amount: Number(f.amount) }); setF({ amount: '', desc: '', client: '', orderId: '' }); await load(); copy(r.url) }
    catch (e) { setMsg(e?.message || 'تعذر الإنشاء') } finally { setBusy(false) }
  }
  const act = async (op, code) => { setMsg(''); try { await post('/shop', { op, code }); await load() } catch (e) { setMsg(e?.message || 'تعذر التنفيذ') } }
  const copy = (u) => { try { navigator.clipboard.writeText(u) } catch {} setCopied(u); setTimeout(() => setCopied(''), 2000) }
  const wa = (r) => `https://wa.me/?text=${encodeURIComponent(`رابط الدفع${r.desc ? ` (${r.desc})` : ''} — ${r.amount} ر.س:\n${r.url}`)}`

  return (
    <div className="h-full overflow-y-auto pb-24 text-white" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button>
        <div className="flex-1"><h1 className="font-display font-black text-base">روابط الدفع</h1><p className="text-[11px] text-white/60">أنشئ رابطًا بمبلغ محدد وأرسله للعميل — طرق الدفع من «طرق الدفع»</p></div>
      </header>
      {msg && <p className="mx-4 mt-3 bg-rose-600 text-white text-sm font-black rounded-xl p-3">{msg}</p>}
      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-3">
        <section className="bg-white/5 border-2 border-white/15 rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="font-display font-black text-sm text-sky-300">رابط دفع جديد</h2>
          <input className={inp} inputMode="decimal" placeholder="المبلغ (ر.س)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <input className={inp} placeholder="الوصف (مثال: غسيل 3 مكيفات)" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
          <input className={inp} placeholder="اسم العميل (اختياري)" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
          <input className={inp} placeholder="رقم/معرّف الطلب لربط الدفع به (اختياري)" value={f.orderId} onChange={(e) => setF({ ...f, orderId: e.target.value })} />
          <button onClick={create} disabled={busy || !Number(f.amount)} className="flex items-center justify-center gap-1.5 bg-emerald-600 font-black text-sm rounded-xl py-3 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}إنشاء ونسخ الرابط</button>
        </section>
        {rows.length === 0 && <p className="text-center text-white/50 text-xs py-6">لا توجد روابط بعد</p>}
        {rows.map((r) => {
          const [lab, bg] = ST[r.status] || ST.open
          return (
            <div key={r.id} className="bg-white/5 border-2 border-white/15 rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <b className="text-lg font-display">{r.amount} <small className="text-xs">ر.س</small></b>
                <span className={`${bg} text-[10px] font-black rounded-full px-2.5 py-1`}>{lab}</span>
                <span className="mr-auto text-[10px] text-white/50" dir="ltr">{r.id}</span>
              </div>
              {(r.desc || r.client) && <p className="text-[12px] text-white/80">{[r.desc, r.client].filter(Boolean).join(' — ')}</p>}
              {r.claim && <p className="text-[11px] bg-amber-500/15 border border-amber-400/30 rounded-lg p-2 text-amber-200 font-bold">أبلغ: {r.claim.name || 'عميل'}{r.claim.ref ? ` — مرجع: ${r.claim.ref}` : ''}{r.claim.phone ? ` — ${r.claim.phone}` : ''}</p>}
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => copy(r.url)} className="flex items-center gap-1 bg-white/10 rounded-lg px-2.5 py-1.5 text-[11px] font-black">{copied === r.url ? <Check size={13} /> : <Copy size={13} />}نسخ الرابط</button>
                <a href={wa(r)} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-green-700 rounded-lg px-2.5 py-1.5 text-[11px] font-black"><Share2 size={13} />واتساب</a>
                {(r.status === 'open' || r.status === 'claimed') && <button onClick={() => window.confirm('تأكيد أن المبلغ وصل فعلًا؟') && act('pay_mark', r.id)} className="flex items-center gap-1 bg-emerald-600 rounded-lg px-2.5 py-1.5 text-[11px] font-black"><Check size={13} />تم استلام المبلغ</button>}
                {(r.status === 'open' || r.status === 'claimed') && <button onClick={() => act('pay_cancel', r.id)} className="flex items-center gap-1 bg-rose-700 rounded-lg px-2.5 py-1.5 text-[11px] font-black"><X size={13} />إلغاء</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
