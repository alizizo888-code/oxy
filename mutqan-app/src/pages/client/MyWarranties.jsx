import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, ShieldCheck, ShieldOff, Sparkles, FileText } from 'lucide-react'
import { useLiveShared } from '../../lib/useLive'
import { useSession } from '../../hooks/useSession'
import { auth } from '../../lib/auth'
import { useWarrantyPolicy } from '../../hooks/useWarranty'
import { orderWarranty, warrantyText, fmtDate, specialtyLabel, CLAIM_STATUS } from '../../warranty'
import WarrantyClaimForm from '../../components/WarrantyClaimForm'

export default function MyWarranties() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session } = useSession()
  const user = auth.getCurrentUser()
  const customer = { name: session?.name || user?.displayName || '', phone: session?.phone || '' }
  const { policy } = useWarrantyPolicy()
  const { data: orders, loading } = useLiveShared('orders', { order: '-createdAt', limit: 100 })
  const { data: claims } = useLiveShared('warranty_claims', { order: '-createdAt', limit: 30 })
  const [claimFor, setClaimFor] = useState(params.get('order') || null)
  const [sent, setSent] = useState(false)

  const done = useMemo(() => (orders || []).filter((o) => ['completed', 'closed'].includes(o.status)), [orders])

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#eef4fb]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#eef4fb]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center"><ChevronRight size={18} className="text-slate-600" /></button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-black text-slate-900">ضماناتي</h1>
            <p className="text-[11px] text-slate-500">المدة المتبقية لكل خدمة من سجل مُتقن</p>
          </div>
          <ShieldCheck size={20} className="text-emerald-500" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 pt-4 flex flex-col gap-3">
        {sent && <p className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-3 py-2.5 text-xs font-bold">تم إرسال ملف الضمان لفريق العمليات ✅ ستصلك النتيجة هنا.</p>}

        {loading ? (
          <p className="text-center text-slate-400 text-xs py-8">جارِ التحميل…</p>
        ) : done.length === 0 ? (
          <div className="bg-white rounded-3xl border border-sky-100 p-6 text-center">
            <ShieldOff size={28} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600 mt-2">لا توجد خدمات مكتملة بعد</p>
            <p className="text-[11px] text-slate-400 mt-1">يبدأ ضمان كل خدمة من تاريخ اكتمالها ({policy.defaultDays} يوم افتراضيًا).</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {done.map((o, i) => {
              const w = orderWarranty(o, policy)
              const pct = w.known ? Math.min(100, Math.round((w.remainingDays / Math.max(1, w.days)) * 100)) : 0
              return (
                <div key={o.id} className="bg-white rounded-3xl border border-sky-100 shadow-sm p-4 fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center justify-between">
                    <p className="font-display font-black text-slate-900 text-sm">{specialtyLabel(o.specialtyId)}</p>
                    <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${w.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{w.active ? 'ساري' : 'منتهي'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">#{String(o.id).slice(-5)} · اكتملت {fmtDate(w.start)}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden"><div className={`h-full rounded-full ${w.active ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} /></div>
                  <p className="text-[11px] text-slate-600 mt-2">{warrantyText(w)}</p>
                  <button onClick={() => { setClaimFor(o.id); setSent(false) }} className="mt-3 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl py-2 text-xs font-bold">فتح ملف ضمان</button>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={() => { setClaimFor('external'); setSent(false) }} className="bg-white border border-dashed border-sky-300 rounded-2xl py-3 text-xs font-bold text-sky-700">ضمان تركيب أو جهاز مسجل خارج التطبيق؟ افتح ملف ضمان</button>

        {claimFor && (
          <WarrantyClaimForm
            key={claimFor}
            orders={orders}
            policy={policy}
            customer={customer}
            presetOrderId={claimFor}
            onDone={() => { setClaimFor(null); setSent(true) }}
          />
        )}

        {(claims || []).length > 0 && (
          <section className="mt-2">
            <p className="text-xs font-black text-slate-500 mb-2 flex items-center gap-1"><FileText size={13} /> ملفات الضمان</p>
            <div className="flex flex-col gap-2">
              {claims.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-sky-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{c.specialtyId ? specialtyLabel(c.specialtyId) : c.certificateNo || 'ضمان خارجي'}</p>
                    <span className="text-[10px] font-bold text-sky-700 shrink-0">{CLAIM_STATUS[c.status]?.label || c.status}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{c.problem}</p>
                  {c.decisionNote && <p className="text-[11px] text-slate-700 bg-slate-50 rounded-lg px-2 py-1.5 mt-1.5">رد الفريق: {c.decisionNote}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {policy.terms && <p className="text-[11px] text-slate-500 leading-relaxed bg-white/60 rounded-2xl p-3">شروط الضمان: {policy.terms}</p>}

        <button onClick={() => navigate('/ai?q=' + encodeURIComponent('عندي مشكلة وعاوز أعرف الضمان بتاعي'))} className="flex items-center justify-center gap-2 bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-2xl py-3 text-xs font-bold">
          <Sparkles size={14} /> اسأل MUTQAN AI عن ضمانك
        </button>
      </main>
    </div>
  )
}
