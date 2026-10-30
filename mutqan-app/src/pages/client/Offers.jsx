import AppPromoBanner from '../../components/AppPromoBanner'
import { useNavigate } from 'react-router-dom'
import { Percent } from 'lucide-react'
import { useLiveShared } from '../../lib/useLive'
import OfferCard from '../../components/OfferCard'

export default function Offers() {
  const navigate = useNavigate()
  const { data: offers, loading } = useLiveShared('offers', { order: '-createdAt', limit: 50 })

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#e8f5f2]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4">
          <h1 className="font-display text-lg font-black text-slate-900">العروض</h1>
          <p className="text-[11px] text-slate-500">أسعار خاصة لفترة محدودة تشمل الضمان والتركيب</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-4">
        <AppPromoBanner className="mb-4" />
        {loading ? (
          <div className="flex flex-col gap-2.5">
            <div className="h-28 rounded-2xl bg-white border border-black/5 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white border border-black/5 animate-pulse" />
          </div>
        ) : (offers || []).length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-white border border-black/5 shadow-sm flex items-center justify-center mx-auto mb-4">
              <Percent size={26} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">لا توجد عروض حاليًا</p>
            <p className="text-[11px] text-slate-400 mt-1">ترقبنا — العروض الموسمية قادمة قريبًا</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(offers || []).map((o) => (
              <OfferCard key={o.id} offer={o} onOrder={() => navigate(`/new?offer=${o.key || o.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
