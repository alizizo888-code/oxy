import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ShieldCheck } from 'lucide-react'
import { useLiveShared } from '../../lib/useLive'
import { auth } from '../../lib/auth'
import { useSession } from '../../hooks/useSession'
import OrderCard from '../../components/OrderCard'
import RegisterModal from '../../components/RegisterModal'
import { ACTIVE_STATUSES } from '../../constants'

export default function MyOrders() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const [showRegister, setShowRegister] = useState(false)
  const platformUser = auth.getCurrentUser()
  const registered = session?.type === 'verified' || !!platformUser

  const { data: orders, loading } = useLiveShared('orders', { order: '-createdAt', limit: 100 })
  const mine = orders || []
  const active = useMemo(() => mine.filter((o) => ACTIVE_STATUSES.includes(o.status)), [mine])
  const history = useMemo(() => mine.filter((o) => !ACTIVE_STATUSES.includes(o.status)), [mine])

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#eaf3fc]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4">
          <h1 className="font-display text-lg font-black text-slate-900">طلباتي</h1>
          <p className="text-[11px] text-slate-500">تابع حالة طلباتك لحظة بلحظة</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {!registered && (
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-sky-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-sky-900">أنت تتصفح كزائر — طلباتك محفوظة على هذا الجهاز</p>
              <p className="text-[11px] text-sky-700 mt-0.5">سجّل بضغطة (Google أو Apple) لربط طلباتك بحسابك.</p>
            </div>
            <button onClick={() => setShowRegister(true)} className="bg-primary text-white text-[11px] font-bold rounded-full px-3 py-2 shrink-0 active:scale-[0.96] transition-transform">
              تسجيل
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">جارِ التحميل…</p>
        ) : mine.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-white border border-black/5 shadow-sm flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={26} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500 mb-1">لا توجد طلبات بعد</p>
            <p className="text-[11px] text-slate-400 mb-5">ابدأ بطلب خدمة وسنتولى الباقي</p>
            <button onClick={() => navigate('/')} className="bg-primary text-white text-sm font-bold rounded-full px-6 py-3 active:scale-[0.97] transition-transform">
              تصفح الخدمات
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 mb-2.5 px-1">الطلبات النشطة</h2>
                <div className="flex flex-col gap-2.5">
                  {active.map((o) => <OrderCard key={o.id} order={o} onClick={() => navigate(`/order/${o.id}`)} />)}
                </div>
              </section>
            )}
            {history.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 mb-2.5 px-1">السجل</h2>
                <div className="flex flex-col gap-2.5">
                  {history.map((o) => <OrderCard key={o.id} order={o} onClick={() => navigate(`/order/${o.id}`)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <RegisterModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onDone={(s) => {
          setSession(s)
          setShowRegister(false)
        }}
        initial={{ name: session?.name || '', phone: session?.phone || '' }}
      />
    </div>
  )
}
