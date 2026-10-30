import DhikrBanner from '../../components/DhikrBanner'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, MapPin, Search, SlidersHorizontal, ChevronRight, ChevronLeft, ShieldCheck, Phone, Headphones, MessageCircle, Loader2, ArrowLeft, Snowflake, Menu, User, CheckCircle2, Sparkles } from 'lucide-react'
import { useLiveShared } from '../../lib/useLive'
import { maps } from '../../lib/maps'
import { share } from '../../lib/share'
import { ACTIVE_STATUSES, STATUS_META, specialtyLabel, BUSINESS_PHONE, BUSINESS_WHATSAPP } from '../../constants'
import ServiceBanner from '../../components/ServiceBanner'
import AiLogo from '../../components/AiLogo'
import ServiceTile from '../../components/ServiceTile'
import PermissionHelp from '../../components/PermissionHelp'
import PromoCarousel from '../../components/PromoCarousel'
import AppPromoBanner from '../../components/AppPromoBanner'
import ThemeToggle from '../../components/ThemeToggle'
import { useWelcome, WELCOME_LABEL } from '../../lib/welcome'
import { permissionState } from '../../hooks/useLocator'
import { auth } from '../../lib/auth'

const TILES = [
  { id: 'ac', label: 'صيانة وتكييف' },
  { id: 'plumbing', label: 'سباكة' },
  { id: 'electric', label: 'كهرباء' },
  { id: 'cleaning', label: 'نظافة وتعقيم' },
  { id: 'appliances', label: 'أجهزة منزلية' },
  { id: 'paint', label: 'دهانات وديكور' },
  { id: 'fridge', label: 'غرف التبريد' },
  { id: 'tanks', label: 'خزانات مياه' },
  { id: 'locks', label: 'أقفال ذكية' },
  { id: 'cameras', label: 'كاميرات مراقبة' },
  { id: 'satellite', label: 'ساتلايت ودش' },
  { id: 'solar', label: 'طاقة شمسية' },
]

const AI_CHIPS = ['كم سعر غسل 3 مكيفات؟', 'أريد فني سباكة', 'عندي مشكلة في التبريد']

export default function Home() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState({ label: 'حدد موقعك', loading: false })
  const [locDenied, setLocDenied] = useState(false)
  const { data: myNotifs } = useLiveShared('notifications', { order: '-at', limit: 50 })
  const me = auth.getCurrentUser()?.id
  const unreadBase = (myNotifs || []).filter((n) => n.audience !== 'ops' && n.userId === me && !n.read).length
  const [guaranteeOpen, setGuaranteeOpen] = useState(false)
  const [toast, setToast] = useState('')

  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 50 })
  const { data: offers } = useLiveShared('offers', { limit: 6 })

  const activeOrders = useMemo(() => (orders || []).filter((o) => ACTIVE_STATUSES.includes(o.status)), [orders])
  const activeOrder = activeOrders[0] || null

  // Location is requested only when the customer taps the location pill — never on open.

  async function locate() {
    setLoc((l) => ({ ...l, loading: true }))
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      const { address } = await maps.reverseGeocode(lat, lng)
      setLocDenied(false)
      if (address) setLoc({ label: address.split('،').slice(0, 2).join('، '), loading: false })
      else setLoc({ label: 'موقعي الحالي', loading: false })
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setLoc({ label: denied ? 'الموقع مقفول' : 'تعذر التحديد — اضغط للمحاولة', loading: false })
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function callDirect() {
    if (BUSINESS_PHONE) window.location.href = `tel:${BUSINESS_PHONE}`
    else showToast('رقم الاتصال المباشر لم يُفعّل بعد — اطلب فنيك الآن وسيصلك')
  }

  function contactWhatsapp() {
    // All WhatsApp numbers are managed from the WhatsApp center — route to the public contact page
    if (BUSINESS_WHATSAPP) share.whatsapp(BUSINESS_WHATSAPP, 'السلام عليكم، أرغب بخدمة صيانة من MUTQAN.')
    else navigate('/contact')
  }

  const query = q.trim()
  const tiles = useMemo(() => {
    if (!query) return TILES
    return TILES.filter((t) => t.label.includes(query))
  }, [query])

  const previewOffers = useMemo(() => {
    const list = offers || []
    if (!query) return list.slice(0, 4)
    return list.filter((o) => (o.title || '').includes(query) || (o.sub || '').includes(query))
  }, [offers, query])

  const welcome = useWelcome()
  const unreadCount = unreadBase + (welcome.state === 'available' ? 1 : 0)
  const SLIDES = [
    { id: 'welcome', sid: 'ac', badge: 'عرض ترحيبي', title: `خصم ${WELCOME_LABEL} على أول طلب`, sub: welcome.state === 'claimed' ? 'تم تفعيل خصمك — يُطبَّق تلقائيًا على أول طلب' : welcome.state === 'used' || welcome.state === 'blocked' ? 'العرض الترحيبي استُخدم على هذا الجهاز — تابع بقية العروض' : 'مرة واحدة لكل جهاز — فعّله الآن ثم اطلب خدمتك', cta: welcome.state === 'available' ? 'فعّل الخصم' : 'اطلب الآن', go: async () => { if (welcome.state === 'available') { await welcome.claim(); } navigate('/new?specialty=ac') } },
    { id: 'warranty', kind: 'warranty', badge: 'ضمان', title: 'ضمان معتمد على كل خدمة', sub: 'ضمان الفنيين الذهبي 30 يومًا — يشمل العمل والتركيب', cta: 'تفاصيل الضمان', go: () => setGuaranteeOpen(true) },
    { id: 'parts', kind: 'parts', badge: 'قطع غيار', title: 'ضمان على قطع الغيار', sub: 'قطع مطابقة للمواصفات بسعر معلن قبل التركيب وضمان على القطعة', cta: 'اطلب صيانة', go: () => navigate('/new?specialty=general') },
    { id: 'contract', kind: 'contract', badge: 'للشركات', title: 'عقود الصيانة السنوية', sub: 'زيارات مجدولة وتقارير وأولوية استجابة للشركات والمنشآت', cta: 'اطلب عرض عقد', go: () => navigate('/new?specialty=corporate') },
    { id: 'field', kind: 'field', badge: 'ميداني', title: 'خدمات ميدانية للمواقع', sub: 'فرق تصل إلى موقعك: مشاريع، مواقع عمل، مستودعات ومبانٍ', cta: 'اطلب فريقاً ميدانياً', go: () => navigate('/new?specialty=corporate') },
    { id: 'urgent', kind: 'emergency', badge: 'طوارئ', title: 'طوارئ 24 ساعة', sub: 'استجابة عاجلة للأعطال الحرجة في المنازل والمنشآت', cta: 'طلب طارئ', go: () => navigate('/new?priority=urgent') },
    { id: 'hotel', kind: 'hotel', badge: 'فنادق', title: 'صيانة الفنادق والشقق المفروشة', sub: 'تكييف وكهرباء وسباكة بدون توقف تشغيل مع عقود موسمية', cta: 'اطلب عرض فنادق', go: () => navigate('/new?specialty=corporate') },
    { id: 'rest', kind: 'restaurant', badge: 'مطاعم', title: 'المطاعم والمطابخ التجارية', sub: 'غرف تبريد وتجميد وتهوية وسباكة ومكافحة حشرات بجدول ثابت', cta: 'اطلب عرض مطاعم', go: () => navigate('/new?specialty=fridge') },
    { id: 'mosque', kind: 'mosque', badge: 'مساجد', title: 'المساجد والمنشآت الدينية', sub: 'تكييف وإنارة وصيانة دورية بعناية وفي أوقات مناسبة للصلاة', cta: 'اطلب صيانة مسجد', go: () => navigate('/new?specialty=corporate') },
    { id: 'factory', kind: 'factory', badge: 'مصانع', title: 'المصانع والمستودعات', sub: 'تبريد صناعي وكهرباء وسلامة مع عقد صيانة وقائية', cta: 'اطلب عرض مصنع', go: () => navigate('/new?specialty=corporate') },
    { id: 'company', kind: 'company', badge: 'شركات', title: 'للشركات والمكاتب', sub: 'مدير حساب واحد وفواتير منظمة وصيانة شاملة لمقراتك', cta: 'تواصل للشركات', go: () => navigate('/new?specialty=corporate') },
  ]

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10 relative" dir="rtl">
      {/* decorative snow */}
      <span className="snowflake pointer-events-none fixed top-24 right-8 text-sky-300/50 text-sm z-0 select-none">❄</span>
      <span className="snowflake pointer-events-none fixed top-16 left-12 text-sky-300/40 text-xs z-0 select-none" style={{ animationDelay: '1.6s' }}>❄</span>
      <span className="snowflake pointer-events-none fixed top-40 left-1/3 text-sky-300/30 text-[10px] z-0 select-none" style={{ animationDelay: '3.2s' }}>❄</span>

      <header className="sticky top-0 z-20 bg-[#e8f5f2]/85 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-2.5 flex items-center gap-2">
          <button onClick={() => navigate('/account')} className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-300/50 active:scale-95 transition-transform shrink-0">
            <User size={18} />
          </button>
          <DhikrBanner />
          <ThemeToggle />
          <button onClick={() => navigate('/notifications')} aria-label="الإشعارات" className="relative w-10 h-10 rounded-full bg-white/90 border border-sky-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform shrink-0">
            <Bell size={17} className="text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/more')} className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-300/50 active:scale-95 transition-transform shrink-0">
            <Menu size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-3 flex flex-col gap-4 relative z-10">
        {locDenied && <PermissionHelp kind="location" onRetry={locate} />}

        {/* Hero — fixed brand, rotating specialty photo + services */}
        <ServiceBanner onOpen={(id) => navigate(`/new?specialty=${id}`)} />

        {/* Search */}
        <div className="relative fade-up" style={{ animationDelay: '60ms' }}>
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن: صيانة، مكيف، سباكة، كهربائي، قفل ذكي…"
            className="w-full bg-white border border-sky-100 shadow-sm rounded-full pr-10 pl-12 py-3 text-sm text-slate-800 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <button onClick={() => navigate('/services')} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center active:scale-95 transition-transform">
            <SlidersHorizontal size={15} className="text-primary" />
          </button>
        </div>

        {/* Promo carousel: each slide shows its own specialty's rotating photos */}
        <PromoCarousel slides={SLIDES} />
        <AppPromoBanner variant="compact" />

        {/* Services grid */}
        <section className="fade-up" style={{ animationDelay: '180ms' }}>
          <div className="grid grid-cols-4 gap-2.5">
            {tiles.map((t, i) => (
              <ServiceTile key={t.id} id={t.id} label={t.label} compact delay={i * 35} onClick={() => navigate(`/new?specialty=${t.id}`)} />
            ))}
          </div>
          {!query && (
            <Link to="/services" className="flex items-center justify-center gap-1 text-[11px] font-bold text-primary mt-2">
              عرض كل الخدمات
              <ChevronLeft size={13} />
            </Link>
          )}
          {query && tiles.length === 0 && <p className="text-xs text-slate-400 text-center py-3">لا توجد خدمات مطابقة لبحثك</p>}
        </section>

        {/* Contact action cards */}
        <section className="grid grid-cols-3 gap-2.5 fade-up" style={{ animationDelay: '240ms' }}>
          <button onClick={callDirect} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-3 flex flex-col items-center gap-2 shadow-md shadow-rose-200 active:scale-95 transition-transform">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <Phone size={20} />
            </span>
            <span className="font-display font-black text-xs">اتصال مباشر</span>
            <span className="text-[9px] text-white/80 -mt-1">تحدث مع خدمة العملاء</span>
          </button>
          <button onClick={() => navigate('/new')} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white p-3 flex flex-col items-center gap-2 shadow-md shadow-sky-200 active:scale-95 transition-transform">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <Headphones size={20} />
            </span>
            <span className="font-display font-black text-xs">اطلب فني الآن</span>
            <span className="text-[9px] text-white/80 -mt-1">خدمة سريعة 24 ساعة</span>
          </button>
          <button onClick={contactWhatsapp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white p-3 flex flex-col items-center gap-2 shadow-md shadow-emerald-200 active:scale-95 transition-transform">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle size={20} />
            </span>
            <span className="font-display font-black text-xs">تواصل واتساب</span>
            <span className="text-[9px] text-white/80 -mt-1">رد سريع وفوري</span>
          </button>
        </section>

        {/* Live order tracking */}
        {activeOrder && (
          <button onClick={() => navigate(`/order/${activeOrder.id}`)} className="w-full text-right bg-white/90 backdrop-blur border border-sky-100 rounded-2xl p-3.5 shadow-sm active:scale-[0.99] transition-transform fade-up">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <p className="text-[11px] font-bold text-primary">طلب صيانة حالي في الطريق</p>
              <span className="mr-auto text-[10px] text-slate-400 font-bold">#{String(activeOrder.id).slice(-4)}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base">
                {activeOrder.specialtyIcon || '🔧'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{activeOrder.inhouse ? 'تم إسناد طلبك لفني' : `الفني: ${activeOrder.technicianName || 'جارِ الإسناد'}`}</p>
                <p className="text-[11px] text-slate-500 truncate">{specialtyLabel(activeOrder.specialtyId)} • {activeOrder.inhouse ? 'جارٍ اتخاذ الإجراء اللازم' : (STATUS_META[activeOrder.status] || {}).label}</p>
              </div>
              <ChevronLeft size={16} className="text-slate-300" />
            </div>
          </button>
        )}

        {/* Offers strip */}
        <section className="fade-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-end justify-end mb-2.5">
            <Link to="/offers" className="flex items-center gap-0.5 text-[11px] font-bold text-primary shrink-0">
              عرض الكل
              <ChevronLeft size={13} />
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
            {(previewOffers || []).map((o) => (
              <OfferMini key={o.id} offer={o} onOrder={() => navigate(`/new?offer=${o.key || o.id}`)} />
            ))}
            {previewOffers.length === 0 && (
              <div className="w-full bg-white/80 border border-sky-100 rounded-2xl p-4 text-center text-xs text-slate-400">لا توجد عروض حاليًا — ترقبنا</div>
            )}
          </div>
        </section>

        {/* AI assistant */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-100 via-blue-50 to-white border border-sky-100 p-4 fade-up" style={{ animationDelay: '360ms' }}>
          <span className="pointer-events-none absolute top-2 left-6 text-sky-300/50 text-lg select-none">❄</span>
          <div className="flex items-center gap-3">
            <AiLogo size={72} className="float-soft drop-shadow-md" />
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl rounded-tr-sm border border-sky-100 shadow-sm p-3">
                <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                  مرحباً 👋 <span className="font-display font-black text-primary">MUTQAN AI</span>
                  <br />
                  مساعدك الذكي للصيانة — اسألني عن الأسعار، الخدمات، أو اطلب فني الآن.
                </p>
              </div>
              <button onClick={() => navigate('/ai')} className="mt-2 w-full flex items-center justify-center gap-1.5 bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-full py-2.5 text-xs shadow-md shadow-sky-200 active:scale-95 transition-transform">
                <Sparkles size={14} />
                تحدث الآن مع المساعد
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
            {AI_CHIPS.map((c) => (
              <button key={c} onClick={() => navigate(`/ai?q=${encodeURIComponent(c)}`)} className="shrink-0 bg-white/90 border border-sky-100 rounded-full px-3 py-1.5 text-[10px] font-bold text-sky-700 active:scale-95 transition-transform">
                {c}
              </button>
            ))}
          </div>
        </section>

        <p className="text-center text-[10px] text-slate-400 pb-2">MUTQAN — الصيانة والمقاولات العامة • راحة بيتك مسؤوليتنا</p>
      </div>

      {/* Guarantee sheet */}
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

function OfferMini({ offer, onOrder }) {
  const [imgState, setImgState] = useState('loading')
  return (
    <div className="w-60 shrink-0 snap-start bg-white rounded-2xl border border-sky-50 shadow-sm p-2.5 flex gap-2.5">
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="w-fit text-[9px] font-bold text-white bg-rose-500 rounded-full px-2 py-0.5 mb-1">{offer.badge || offer.tag || 'عرض'}</span>
        <h3 className="font-display font-black text-slate-900 text-[12px] leading-snug line-clamp-1">{offer.title}</h3>
        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{offer.sub}</p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-primary text-base">{offer.price}</span>
            {offer.oldPrice && <span className="text-[10px] text-slate-400 line-through">{offer.oldPrice}</span>}
          </div>
          <button onClick={onOrder} className="bg-primary text-white text-[10px] font-bold rounded-full px-3 py-1.5 active:scale-95 transition-transform">
            اطلب الآن
          </button>
        </div>
      </div>
      <div className="w-20 h-20 rounded-xl overflow-hidden relative bg-sky-50 shrink-0">
        {imgState !== 'error' && (
          <img src={offer.image} alt={offer.title} onLoad={() => setImgState('ok')} onError={() => setImgState('error')} className={`w-full h-full object-cover transition-opacity ${imgState === 'ok' ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {imgState === 'loading' && <div className="absolute inset-0 animate-pulse bg-sky-100" />}
        {imgState === 'error' && <div className="absolute inset-0 bg-gradient-to-br from-sky-200 to-blue-300 flex items-center justify-center text-xl">❄</div>}
      </div>
    </div>
  )
}
