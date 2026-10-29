import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, HardHat, LogIn, MapPin, Loader2, Check, Clock, XCircle, CheckCircle2 } from 'lucide-react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { maps } from '../lib/maps'
import { useLiveShared } from '../lib/useLive'
import { useTeamRole } from '../hooks/useTeamRole'
import { SPECIALTIES } from '../constants'
import { isValidPhone } from '../registration'
import PermissionHelp from '../components/PermissionHelp'
import { permissionState } from '../hooks/useLocator'

// Technician self-registration: one-tap sign-in → name, mobile, specialties, location (automatic)
// → application waits for the owner / operations supervisor to approve.
const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15'

export default function TechJoin() {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => auth.getCurrentUser())
  useEffect(() => auth.onAuthChange(setUser), [])
  const { role, loading: roleLoading } = useTeamRole()
  const { data: apps, loading: appsLoading } = useLiveShared('tech_applications', {
    filters: { userId: user?.id || '__none__' },
    order: '-createdAt',
    limit: 1,
  })
  const app = apps?.[0] || null

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [years, setYears] = useState('')
  const [specialties, setSpecialties] = useState([])
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locDenied, setLocDenied] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reapply, setReapply] = useState(false)

  useEffect(() => { if (user?.displayName && !name) setName(user.displayName) }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function locate() {
    setLocating(true)
    setError('')
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      let address = ''
      try { address = (await maps.reverseGeocode(lat, lng))?.address || '' } catch {}
      setLocation({ lat, lng, address })
      setLocDenied(false)
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setError(denied ? 'صلاحية الموقع مقفولة — اضغط «تفعيل الأذونات» ثم أعد المحاولة.' : 'تعذر تحديد موقعك الآن — تأكد من تشغيل الموقع وأعد المحاولة.')
    } finally {
      setLocating(false)
    }
  }

  // Location is requested only when the technician taps "تحديد موقعي".
  const showForm = user && (!app || (app.status === 'rejected' && reapply))

  const toggleSpec = (id) => setSpecialties((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function submit() {
    setError('')
    if (name.trim().length < 2) return setError('اكتب اسمك الكامل')
    if (!isValidPhone(phone)) return setError('اكتب رقم جوال صحيح')
    if (!specialties.length) return setError('اختر تخصصًا واحدًا على الأقل')
    if (!consent) return setError('يلزم موافقتك على حفظ بياناتك ومراجعتها')
    setBusy(true)
    try {
      const gid = await team.groupId()
      await db.insertShared(
        'tech_applications',
        {
          userId: user.id,
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          years: Number(years) || 0,
          specialties,
          notes: notes.trim(),
          location,
          status: 'pending',
          source: 'app',
          createdAt: new Date().toISOString(),
        },
        undefined,
        { groupId: gid, visibleTo: 'creator-and-admin', writableBy: 'admins' }
      )
      setReapply(false)
    } catch {
      setError('تعذر إرسال الطلب، حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  const isTech = role === 'technician'

  return (
    <div className="h-full overflow-y-auto pb-16 bg-gradient-to-b from-amber-50 via-[#f4f8fc] to-[#eaf3fc]" dir="rtl">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-amber-100 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="font-display text-lg font-black text-slate-900">انضم كفني إلى مُتقن</h1>
            <p className="text-[11px] text-slate-500">يُفعّل حسابك بعد موافقة الإدارة</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 pt-5 flex flex-col gap-4">
        <div className="bg-gradient-to-l from-amber-500 to-orange-500 rounded-3xl p-5 text-white shadow-lg shadow-amber-200 fade-up">
          <HardHat size={30} />
          <p className="font-display font-black text-xl mt-2">اشتغل مع مُتقن</p>
          <p className="text-xs text-white/85 mt-1 leading-relaxed">سجّل بضغطة، أضف تخصصاتك وموقعك، وبعد موافقة الإدارة تبدأ استلام الطلبات القريبة منك.</p>
        </div>

        {!user ? (
          <Card>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">الخطوة الأولى: سجّل الدخول بضغطة واحدة بحساب Google أو Apple.</p>
            <button onClick={() => auth.signIn()} className="w-full bg-slate-900 text-white font-display font-black rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform hover:bg-slate-800">
              <LogIn size={18} /> تسجيل الدخول / إنشاء حساب
            </button>
          </Card>
        ) : roleLoading || appsLoading ? (
          <p className="text-center text-slate-400 text-sm py-8">جارِ التحميل…</p>
        ) : isTech ? (
          <Card>
            <CheckCircle2 size={34} className="text-emerald-500 mx-auto" />
            <p className="text-center font-display font-black text-slate-900 mt-2">حسابك كفني مفعّل ✅</p>
            <button onClick={() => navigate('/staff')} className="w-full mt-4 bg-emerald-500 text-white font-display font-black rounded-2xl py-3.5 active:scale-[0.98] transition-transform">الدخول إلى رادار الفني</button>
          </Card>
        ) : app && !showForm ? (
          <Card>
            {app.status === 'pending' && (
              <>
                <Clock size={34} className="text-amber-500 mx-auto" />
                <p className="text-center font-display font-black text-slate-900 mt-2">طلبك بانتظار موافقة الإدارة</p>
                <p className="text-center text-[11px] text-slate-500 mt-1">ستتفعّل صلاحياتك تلقائيًا بعد الموافقة — افتح هذه الصفحة للمتابعة.</p>
              </>
            )}
            {app.status === 'approved' && (
              <>
                <CheckCircle2 size={34} className="text-emerald-500 mx-auto" />
                <p className="text-center font-display font-black text-slate-900 mt-2">تمت الموافقة على طلبك ✅</p>
                <button onClick={() => navigate('/staff')} className="w-full mt-4 bg-emerald-500 text-white font-display font-black rounded-2xl py-3.5 active:scale-[0.98] transition-transform">الدخول إلى رادار الفني</button>
              </>
            )}
            {app.status === 'rejected' && (
              <>
                <XCircle size={34} className="text-rose-500 mx-auto" />
                <p className="text-center font-display font-black text-slate-900 mt-2">لم تتم الموافقة على الطلب</p>
                {app.reviewNote && <p className="text-center text-[11px] text-slate-500 mt-1">ملاحظة الإدارة: {app.reviewNote}</p>}
                <button onClick={() => setReapply(true)} className="w-full mt-4 bg-amber-500 text-white font-display font-black rounded-2xl py-3 active:scale-[0.98] transition-transform">تقديم طلب جديد</button>
              </>
            )}
            <div className="mt-4 bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
              <p><b>الاسم:</b> {app.name}</p>
              <p><b>الجوال:</b> <span dir="ltr">{app.phone}</span></p>
              <p><b>التخصصات:</b> {(app.specialties || []).map((id) => SPECIALTIES.find((s) => s.id === id)?.label || id).join('، ')}</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-col gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" className={inputCls} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال 05xxxxxxxx" dir="ltr" inputMode="tel" className={`${inputCls} text-right`} />
              <div className="grid grid-cols-2 gap-3">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="المدينة / الحي" className={inputCls} />
                <input value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="سنوات الخبرة" inputMode="numeric" className={inputCls} />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">التخصصات</p>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((s) => {
                    const on = specialties.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => toggleSpec(s.id)} className={`text-[11px] font-bold rounded-full px-3 py-1.5 border transition-colors ${on ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                        {s.icon} {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={locate} disabled={locating} className={`flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-bold border ${location ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="truncate">{locating ? 'جارٍ تحديد موقعك…' : location ? location.address || 'تم تحديد موقعك' : 'تحديد موقعي'}</span>
              </button>
              {locDenied && <PermissionHelp kind="location" onRetry={locate} />}

              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="نبذة عن خبرتك (اختياري)" rows={3} className={inputCls} />

              <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-amber-500" />
                أوافق على حفظ بياناتي ومراجعتها من إدارة مُتقن لتفعيل حسابي كفني.
              </label>

              {error && <p className="text-rose-600 text-xs font-bold text-center">{error}</p>}
              <button onClick={submit} disabled={busy} className="w-full bg-gradient-to-l from-amber-500 to-orange-500 text-white font-display font-black rounded-2xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                إرسال طلب الانضمام
              </button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

function Card({ children }) {
  return <div className="bg-white rounded-3xl border border-black/5 shadow-sm p-5 fade-up">{children}</div>
}
