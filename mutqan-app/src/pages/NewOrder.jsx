import { rememberSpecialty } from '../components/TitleBoot'
import AppPromoBanner from '../components/AppPromoBanner'
import { useWelcome, welcomeOff, WELCOME_LABEL } from '../lib/welcome'
import { getDeviceId } from '../lib/device'
import SpecialtyFx from '../components/SpecialtyFx'
import FxIcon from '../components/FxIcon'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, MapPin, Loader2, Link2, Map as MapIcon, PencilLine, CheckCircle2 } from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { team } from '../lib/team'
import { push } from '../lib/push'
import { maps } from '../lib/maps'
import { useLiveShared } from '../lib/useLive'
import MapView from '../components/MapView'
import RegisterModal from '../components/RegisterModal'
import { useSession } from '../hooks/useSession'
import { SPECIALTIES } from '../constants'
// One strong colour per specialty (selected = solid fill; idle = coloured edge) for quick recognition.
const SPEC_COLORS = { ac: '#0369a1', electric: '#d97706', plumbing: '#0e7490', locks: '#6d28d9', appliances: '#be185d', satellite: '#4338ca', paint: '#c2410c', tiling: '#a16207', cameras: '#be123c', fridge: '#0891b2', cleaning: '#15803d', pest: '#b91c1c' }
const specColor = (id) => SPEC_COLORS[id] || '#0f766e'
import { isRegistered } from '../registration'
import SpecialtyGallery from '../components/SpecialtyGallery'
import FloatingContact from '../components/FloatingContact'
import InstantService from '../components/InstantService'
import AppointmentPicker from '../components/AppointmentPicker'
import { useOrderRouting } from '../hooks/useOrderRouting'
import AcCalculator from '../components/AcCalculator'
import PermissionHelp from '../components/PermissionHelp'
import { permissionState } from '../hooks/useLocator'

const inputCls = 'w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 shadow-sm focus:outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-200'

export default function NewOrder() {
  const navigate = useNavigate()
  const fromAd = new URLSearchParams(window.location.hash.split('?')[1] || '').get('from') === 'ad'
  const [params] = useSearchParams()
  const warrantyOf = params.get('warrantyOf')
  const offerKey = params.get('offer')
  const productKey = params.get('product')

  const { session, setSession } = useSession()
  const platformUser = auth.getCurrentUser()

  const registered = isRegistered(session, platformUser)
  // A returning guest who already gave name + mobile is not asked again
  const knownGuest = session?.type === 'guest' && session?.phone ? session : null
  const [specialtyId, setSpecialtyId] = useState(params.get('specialty') || '')
  const [changing, setChanging] = useState(false)
  const [description, setDescription] = useState('')
  const [appt, setAppt] = useState({ label: '', at: null })
  const routing = useOrderRouting()
  const [noteOpen, setNoteOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const priority = params.get('priority') === 'urgent' ? 'urgent' : 'normal'
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [acSel, setAcSel] = useState(null)
  const welcome = useWelcome()
  const welcomeOk = welcome.state === 'available' || welcome.state === 'claimed'
  const off = acSel && welcomeOk ? welcomeOff(acSel.total, welcome.pct) : 0
  const [noDiscount, setNoDiscount] = useState(false)
  const [locDenied, setLocDenied] = useState(false)
  useEffect(() => { setAcSel(null) }, [specialtyId])
  useEffect(() => { rememberSpecialty(specialtyId) }, [specialtyId])

  const { data: offers } = useLiveShared('offers', { limit: 50 })
  const { data: products } = useLiveShared('products', { limit: 50 })

  // Prefill from an offer / product tap
  useEffect(() => {
    if (offerKey && offers) {
      const o = offers.find((x) => (x.key || x.id) === offerKey)
      if (o) {
        setSpecialtyId(o.specialtyId || specialtyId)
        setDescription(`${o.title} — ضمن العرض الحالي (${o.price} ر.س)`)
      }
    }
    if (productKey && products) {
      const p = products.find((x) => (x.key || x.id) === productKey)
      if (p) {
        setSpecialtyId(p.specialtyId || specialtyId)
        setDescription(`توريد وتركيب: ${p.name}${p.price ? ` (${p.price} ر.س)` : ''}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerKey, productKey, offers, products])

  async function useMyLocation(silent) {
    silent = silent === true
    setLocating(true)
    if (!silent) setError('')
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      setCoords({ lat, lng })
      setLocDenied(false)
      try {
        const { address: addr } = await maps.reverseGeocode(lat, lng)
        if (addr) setAddress(addr)
      } catch {}
      return { lat, lng }
    } catch (e) {
      if (silent) return null
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setMapOpen(true)
      setError(denied ? 'صلاحية الموقع مقفولة — فعّلها، أو اضغط على الخريطة، أو الصق رابط موقعك من خرائط جوجل.' : 'تعذر تحديد موقعك الآن — اضغط على الخريطة أو الصق رابط موقعك.')
      return null
    } finally {
      setLocating(false)
    }
  }

  // Automatic location: detect once as soon as the page opens (silent if the browser asks/denies).
  const autoRef = useRef(false)
  useEffect(() => {
    if (autoRef.current) return
    autoRef.current = true
    useMyLocation(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Accepts a Google Maps link (or "lat,lng") and extracts the coordinates.
  function applyLink() {
    const t = linkText.trim()
    const m = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/) || t.match(/[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i) || t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/) || t.match(/^\s*(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/)
    if (!m) { setError('الرابط ما فيه إحداثيات — افتح موقعك في خرائط جوجل وانسخ الرابط الكامل (مش المختصر)، أو استخدم زر تحديد الموقع.'); return }
    const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { setError('إحداثيات غير صحيحة'); return }
    setError(''); setCoords({ lat, lng }); setLinkOpen(false); setLinkText('')
    maps.reverseGeocode(lat, lng).then((r) => r.address && setAddress(r.address)).catch(() => {})
  }

  function validate() {
    if (!specialtyId) return 'الرجاء اختيار نوع الخدمة'
    return ''
  }

  async function submit() {
    const err = validate()
    if (err) return setError(err)
    setError('')
    // One tap: if the location is not set yet, ask for it right now instead of making the customer hunt for it
    if (!coords) {
      const got = await useMyLocation()
      if (!got) return
      return proceed(got)
    }
    proceed(coords)
  }

  function proceed(c) {
    // Name + mobile are asked only now, at the final button: register or continue as guest
    if (registered) return createOrder(session, c)
    // No sign-up step: the WhatsApp message the customer sends next carries their number.
    return createOrder(knownGuest || { type: 'guest', name: '', phone: '' }, c)
  }

  async function createOrder(sess, c) {
    const cc = c || coords
    setSubmitting(true)
    setError('')
    try {
      const gid = await team.groupId()
      const payload = {
        clientId: platformUser?.id || null,
        clientName: (sess?.name || '').trim(),
        clientPhone: (sess?.phone || '').trim(),
        clientType: sess?.type || 'guest',
        specialtyId,
        serviceDetails: acSel ? `${({ wash: 'غسيل', install: 'تركيب ونقل', maintenance: 'صيانة وفحص' })[acSel.mode]} — ${acSel.type}${acSel.mode !== 'maintenance' ? ` × ${acSel.qty}` : ''}` : null,
        qty: acSel?.qty || 1,
        acQuote: acSel ? { mode: acSel.mode, type: acSel.type, qty: acSel.qty, full: acSel.full, warranty: acSel.warranty, vat: acSel.vat, total: acSel.total - (noDiscount ? 0 : off), welcomeOff: noDiscount ? 0 : off, offerKey: acSel.offer ? (acSel.offer.key || acSel.offer.id) : null } : null,
        description: description.trim(),
        preferredTime: appt.label || null,
        appointmentAt: appt.at || null,
        priority,
        promoCode: null,
        deviceId: getDeviceId(),
        offerKey: offerKey || null,
        productKey: productKey || null,
        address,
        lat: cc.lat,
        lng: cc.lng,
        status: 'new',
        statusHistory: [{ status: 'new', at: new Date().toISOString(), by: 'client' }],
        isWarranty: !!warrantyOf,
        warrantyOf: warrantyOf || null,
      }
      const order = await db.insertShared('orders', payload, undefined, {
        groupId: gid,
        visibleTo: 'creator-and-admin',
      })
      // The server alerts owner + operations about every new order (see Mutqan_Rest::alert_new_order).

      navigate(`/order/${order.id}${routing.mode === 'operations' ? '' : '?wa=1'}`, { replace: true })
    } catch (e) {
      if (e?.code === 'price_below_floor' && !noDiscount && off > 0) { setNoDiscount(true); setError('انتهى خصمك الترحيبي على هذا الجهاز — اضغط إتمام الطلب لإرساله بالسعر الأصلي.'); setSubmitting(false); return }
      setError('تعذر إرسال الطلب، حاول مرة أخرى')
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-48 md:pb-16" dir="rtl">
      {specialtyId && <SpecialtyFx key={specialtyId} id={specialtyId} count={18} fixed light className="!opacity-70" />}
      <header className="sticky top-0 z-20 bg-[#f5f7f5]/90 backdrop-blur border-b border-black/5 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => (fromAd && !(window.history.state && window.history.state.idx > 0) ? navigate('/', { replace: true }) : navigate(-1))} className="w-9 h-9 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center active:scale-[0.95] transition-transform">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="font-display text-lg font-black text-slate-900">{warrantyOf ? 'طلب ضمان' : 'طلب صيانة جديد'}</h1>
            <p className="text-[11px] text-slate-500">اختر الخدمة وأرسل الطلب — ونتولى الباقي</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-5 flex flex-col gap-5 relative z-10">
        {specialtyId && <SpecialtyGallery specialtyId={specialtyId} />}
        <AppPromoBanner variant="compact" />

        {specialtyId && !changing ? (
          <div className="flex items-center justify-between bg-white border border-sky-100 rounded-2xl px-3 py-2.5 shadow-sm">
            <span className="flex items-center gap-2 text-sm font-black text-slate-800">
              <FxIcon id={specialtyId} className="text-lg">{SPECIALTIES.find((x) => x.id === specialtyId)?.icon}</FxIcon>
              {SPECIALTIES.find((x) => x.id === specialtyId)?.label}
            </span>
            <button onClick={() => setChanging(true)} className="text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1.5 active:scale-95 transition-transform">تغيير الخدمة</button>
          </div>
        ) : (
          <Field label="اختر الخدمة">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSpecialtyId(s.id); setChanging(false) }}
                  style={specialtyId === s.id ? { backgroundColor: specColor(s.id), borderColor: specColor(s.id) } : { borderRightColor: specColor(s.id) }}
                  className={`flex items-center gap-2 rounded-xl px-3 py-3 border-2 border-r-[6px] text-xs font-black transition-all ${
                    specialtyId === s.id
                      ? 'text-white shadow-lg scale-[1.03]'
                      : 'bg-white border-slate-300 text-slate-900 shadow-sm active:scale-95'
                  }`}
                >
                  <span className="text-lg">{s.icon}</span> {s.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {specialtyId === 'ac' && <AcCalculator offerKey={offerKey} onChange={setAcSel} />}
        {off > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm" data-keep-colors>
            <p className="font-display font-black text-amber-800">🎁 خصم ترحيبي {WELCOME_LABEL} على أول طلب</p>
            <div className="mt-2 flex justify-between text-slate-600"><span>السعر قبل الخصم</span><span>{acSel.total} ر.س</span></div>
            <div className="flex justify-between text-emerald-700 font-bold"><span>الخصم الفعلي</span><span>− {off} ر.س</span></div>
            <div className="flex justify-between text-slate-900 font-black border-t border-amber-200 mt-1.5 pt-1.5"><span>الإجمالي بعد الخصم</span><span>{acSel.total - off} ر.س</span></div>
          </div>
        )}

        {/* optional note — collapsed so the flow stays one-tap */}
        {noteOpen ? (
          <Field label="ملاحظة للفني (اختياري)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="مثال: الدور الثاني — رن الجرس" className={`${inputCls} resize-none`} />
          </Field>
        ) : (
          <button onClick={() => setNoteOpen(true)} className="self-start flex items-center gap-1.5 text-xs font-black text-slate-800 bg-slate-100 border-2 border-slate-300 rounded-full px-3 py-1.5 active:scale-95 transition-transform">
            <PencilLine size={14} /> {description ? 'تعديل الملاحظة' : 'إضافة ملاحظة (اختياري)'}
          </button>
        )}

        {priority !== 'urgent' && <AppointmentPicker onChange={setAppt} />}

        <Field label="موقع الخدمة">
          {coords ? (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-3 flex items-start gap-2.5">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-emerald-800">تم تحديد موقعك تلقائيًا — وسيُرسل مع طلبك على واتساب</p>
                <p className="text-xs text-emerald-700/80 mt-0.5 leading-relaxed">{address || `${coords.lat.toFixed(5)}، ${coords.lng.toFixed(5)}`}</p>
              </div>
              <button onClick={() => setMapOpen((v) => !v)} className="text-[11px] font-bold text-emerald-700 bg-white rounded-full px-3 py-1.5 border border-emerald-200 shrink-0">إرسال موقع آخر</button>
            </div>
          ) : (
            <button
              onClick={() => useMyLocation()}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-2xl py-3.5 text-sm shadow-lg shadow-sky-200 active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {locating ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}
              حدد موقعي تلقائيًا
            </button>
          )}
          {locDenied && <div className="mt-2"><PermissionHelp kind="location" onRetry={() => useMyLocation()} /></div>}
          <div className="flex gap-4 mt-2.5">
            <button onClick={() => setMapOpen((v) => !v)} className="flex items-center gap-1 text-xs font-black text-sky-700"><MapIcon size={13} /> {mapOpen ? 'إخفاء الخريطة' : 'اختر من الخريطة'}</button>
            <button onClick={() => setLinkOpen((v) => !v)} className="flex items-center gap-1 text-xs font-black text-sky-700"><Link2 size={13} /> لصق رابط خرائط جوجل</button>
          </div>
          {linkOpen && (
            <div className="mt-2 flex gap-2">
              <input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="https://www.google.com/maps/…" dir="ltr" className={`${inputCls} flex-1 text-left`} />
              <button onClick={applyLink} className="bg-slate-900 text-white font-bold rounded-xl px-4 text-xs">تأكيد</button>
            </div>
          )}
          {mapOpen && (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-2">
              <MapView
                center={coords ? [coords.lat, coords.lng] : [24.7136, 46.6753]}
                zoom={coords ? 16 : 11}
                markers={coords ? [{ lat: coords.lat, lng: coords.lng, label: '📍' }] : []}
                onMapClick={async ({ lat, lng }) => {
                  setCoords({ lat, lng })
                  try {
                    const { address: addr } = await maps.reverseGeocode(lat, lng)
                    if (addr) setAddress(addr)
                  } catch {}
                }}
                className="h-52"
              />
              <p className="text-[10px] text-slate-400 text-center py-1.5 bg-white">اضغط على الخريطة لتحريك الدبوس</p>
            </div>
          )}
        </Field>

        {error && <p className="text-rose-600 text-sm font-bold text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-display font-black text-base rounded-2xl py-4 disabled:opacity-50 active:scale-[0.98] transition-transform shadow-xl shadow-emerald-300 ring-2 ring-emerald-200"
        >
          {submitting ? 'جارِ الإرسال…' : locating ? 'جارِ تحديد موقعك…' : coords ? 'تأكيد الطلب وإرسال الموقع عبر واتساب' : 'تحديد الموقع وتأكيد الطلب'}
        </button>
        <p className="text-xs font-bold text-slate-600 text-center -mt-2 pb-4">
          {registered || knownGuest ? `يُرسل الطلب باسم ${(session?.name || '').trim() || 'حسابك'}` : 'بدون تسجيل — بعد الإرسال نتواصل معك على واتساب لتأكيد الموعد'}
        </p>
      </div>

      <RegisterModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onDone={(s) => {
          setSession(s)
          setShowRegister(false)
          createOrder(s)
        }}
        initial={{ name: session?.name || platformUser?.displayName || '', phone: session?.phone || '' }}
      />
      <FloatingContact bottomClass="bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]" />
      <InstantService bottomClass="bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]" />
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-black text-slate-900 mb-1.5 border-r-4 border-sky-600 pr-2">{label}</label>
      {children}
    </div>
  )
}
