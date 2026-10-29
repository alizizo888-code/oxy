import AppPromoBanner from '../../components/AppPromoBanner'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { SPECIALTIES } from '../../constants'
import ServiceTile from '../../components/ServiceTile'

export default function Services() {
  const navigate = useNavigate()
  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#eaf3fc]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center active:scale-[0.95] transition-transform">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="font-display text-lg font-black text-slate-900">كل الخدمات</h1>
            <p className="text-[11px] text-slate-500">18 خدمة معتمدة بضمان مُتقن</p>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto w-full px-4 pt-4"><AppPromoBanner variant="compact" /></div>

      <div className="max-w-3xl mx-auto w-full px-4 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SPECIALTIES.map((s, i) => (
            <ServiceTile key={s.id} id={s.id} label={s.label} desc={s.desc} delay={i * 40} onClick={() => navigate(`/new?specialty=${s.id}`)} />
          ))}
        </div>
      </div>
    </div>
  )
}
