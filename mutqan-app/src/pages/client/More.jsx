import { perfMode, setPerfMode, isLowEnd } from '../../lib/perf'
import { hardRefresh, lastError } from '../../lib/recover'
import AppPromoBanner from '../../components/AppPromoBanner'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Newspaper, ChevronRight, Wrench, Percent, ShoppingBag, Calculator as CalcIcon, Sparkles, Share2, Copy, ShieldCheck, UserCog, Gift, Snowflake, MessageCircle, Smartphone, Palette } from 'lucide-react'
import { share } from '../../lib/share'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export default function More() {
  const navigate = useNavigate()
  const [guaranteeOpen, setGuaranteeOpen] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  async function copyLink() {
    try {
      await share.copy(APP_URL)
      showToast('تم نسخ رابط التطبيق')
    } catch {
      showToast('تعذر النسخ')
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#e8f5f2]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-black text-slate-900">المزيد</h1>
            <p className="text-[11px] text-slate-500">كل أقسام MUTQAN في مكان واحد</p>
          </div>
          <Snowflake size={20} className="text-sky-400" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-4 flex flex-col gap-2.5">
        <AppPromoBanner />
        <Row icon={<Palette size={18} />} tint="bg-fuchsia-100 text-fuchsia-700" title="قوالب المظهر" sub="غيّر ألوان التطبيق: شتوي، زمرّدي، ملكي وغيرها" onClick={() => navigate('/theme')} />
        <Row icon={<Wrench size={18} />} tint="bg-sky-100 text-sky-700" title="كل الخدمات" sub="18 تخصصًا معتمدًا بضمان MUTQAN" onClick={() => navigate('/services')} />
        <Row icon={<Newspaper size={18} />} tint="bg-indigo-100 text-indigo-700" title="المقالات" sub="المنشورة والمحدَّثة والقديمة — أدلة ونصائح الصيانة" onClick={() => navigate('/articles')} />
        <Row icon={<Percent size={18} />} tint="bg-rose-100 text-rose-600" title="العروض الموسمية" sub="أسعار خاصة تشمل الضمان والتركيب" onClick={() => navigate('/offers')} />
        <Row icon={<ShoppingBag size={18} />} tint="bg-violet-100 text-violet-600" title="المتجر" sub="أجهزة ومعدات أصلية مع التوريد والتركيب" onClick={() => navigate('/store')} />
        <Row icon={<CalcIcon size={18} />} tint="bg-amber-100 text-amber-700" title="حاسب الأسعار" sub="تقدير فوري لتكلفة خدمتك" onClick={() => navigate('/calculator')} />
        <Row icon={<Sparkles size={18} />} tint="bg-blue-100 text-blue-600" title="مساعد MUTQAN AI" sub="اسأل عن الأسعار والخدمات واطلب فني" onClick={() => navigate('/ai')} />
        <Row icon={<MessageCircle size={18} />} tint="bg-emerald-100 text-emerald-700" title="تواصل واطلب" sub="واتساب حسب القسم + MUTQAN AI" onClick={() => navigate('/contact')} />
        <Row icon={<ShieldCheck size={18} />} tint="bg-teal-100 text-teal-700" title="ضماناتي" sub="المدة المتبقية وفتح ملف ضمان" onClick={() => navigate('/warranty')} />
        <Row icon={<ShieldCheck size={18} />} tint="bg-emerald-100 text-emerald-700" title="ضمان الفنيين الذهبي" sub="30 يومًا على كل خدمة — اعرف التفاصيل" onClick={() => setGuaranteeOpen(true)} />
        <Row icon={<ShieldCheck size={18} />} tint="bg-sky-100 text-sky-700" title="الخصوصية وبياناتك" sub="الموافقات، مدة الاحتفاظ، حذف محادثاتك" onClick={() => navigate('/privacy')} />
        <PerfRow />
        <Row icon={<Smartphone size={18} />} tint="bg-emerald-100 text-emerald-700" title="تحميل التطبيق" sub="أندرويد وآيفون — بدون متجر وبدون تحذيرات" onClick={() => navigate('/install')} />
        <Row icon={<UserCog size={18} />} tint="bg-slate-200 text-slate-700" title="دخول فريق العمل" sub="للفنيين والمشرفين عبر حسابات الفريق" onClick={() => navigate('/staff')} />

        {/* Share / referral */}
        <div className="bg-gradient-to-l from-sky-500 to-blue-600 rounded-3xl p-4 text-white shadow-lg shadow-sky-200 fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Gift size={19} className="text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-sm">شارك التطبيق واكسب 30 ر.س 🎁</p>
              <p className="text-[11px] text-white/80 mt-0.5">أرسل رابط الدعوة لصديق واحصل على خصم فوري في طلبك التالي.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => share.whatsapp('', `جرّب تطبيق MUTQAN لخدمات الصيانة — فنيون معتمدون وتتبع حي للطلب:\n${APP_URL}`)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-blue-700 font-bold rounded-full py-2.5 text-xs active:scale-95 transition-transform"
            >
              <Share2 size={14} />
              مشاركة عبر واتساب
            </button>
            <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1.5 bg-white/15 border border-white/25 rounded-full py-2.5 text-xs font-bold active:scale-95 transition-transform">
              <Copy size={14} />
              نسخ الرابط
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 py-2">MUTQAN — الصيانة والمقاولات العامة • راحة بيتك مسؤوليتنا</p>
      </div>

      {guaranteeOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={() => setGuaranteeOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-amber-700" />
              </div>
              <div>
                <p className="font-display font-black text-slate-900">ضمان الفنيين الذهبي</p>
                <p className="text-[11px] text-slate-500">30 يومًا على كل خدمة</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 border border-amber-100 rounded-2xl p-3">
              إذا تكرّر نفس العطل خلال 30 يومًا من إغلاق الطلب: إعادة زيارة مجانية، أو استرداد كامل المبلغ في حال عدم الرضا. يُفتح مسار الضمان مباشرة من صفحة الطلب المكتمل.
            </p>
            <button onClick={() => setGuaranteeOpen(false)} className="w-full mt-4 bg-primary text-white font-display font-black rounded-2xl py-3 text-sm active:scale-[0.98] transition-transform">
              تمام
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-white text-xs font-bold rounded-full px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function Row({ icon, tint, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl border border-sky-100 shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform hover:shadow-md fade-up text-right w-full">
      <div className={`w-10 h-10 rounded-xl ${tint} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-black text-slate-900 text-sm">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 rotate-180" />
    </button>
  )
}

// Speed tools: performance mode (auto / light / full) + one-tap repair.
function PerfRow() {
  const [m, setM] = useState(perfMode)
  const pick = (v) => { setPerfMode(v); setM(v) }
  const err = lastError()
  return (
    <div className="rounded-2xl bg-white border border-sky-100 shadow-sm p-3.5">
      <p className="font-display font-black text-sm text-slate-900">⚡ وضع الأداء</p>
      <p className="text-[11px] text-slate-500 mt-0.5">«خفيف» يوقف الخلفيات والحركات الزخرفية لتسريع التطبيق على الجوالات الضعيفة.{m === 'auto' && ` (تلقائي الآن: ${isLowEnd() ? 'خفيف' : 'كامل'})`}</p>
      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        {[['auto', 'تلقائي'], ['lite', 'خفيف'], ['full', 'كامل']].map(([id, l]) => (
          <button key={id} onClick={() => pick(id)} className={`rounded-xl py-2 text-xs font-black border ${m === id ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{l}</button>
        ))}
      </div>
      <button onClick={hardRefresh} className="mt-2.5 w-full rounded-xl py-2 text-xs font-bold bg-slate-100 text-slate-600">🔧 إصلاح وإعادة تشغيل التطبيق</button>
      {err && <p className="mt-2 text-[9px] text-slate-400 break-all" dir="ltr">{err}</p>}
    </div>
  )
}
