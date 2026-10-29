import { useState } from 'react'
import PermissionHelp from './PermissionHelp'
import { permissionState } from '../hooks/useLocator'
import { ShieldCheck, Loader2, MapPin, Check, LogIn } from 'lucide-react'
import { auth } from '../lib/auth'
import { maps } from '../lib/maps'
import { isValidPhone, saveCustomer } from '../registration'

// Guest → Customer, inline in the MUTQAN AI conversation (or inside RegisterModal).
// 1) one-tap account sign-in (Google / Apple / platform sign-in) — the app never asks for an email
// 2) name + mobile  3) location — requested only when the customer taps the button  4) consent → customer created.
const STAGES = [
  { k: 'account', label: 'الحساب' },
  { k: 'profile', label: 'الاسم والجوال' },
  { k: 'location', label: 'الموقع' },
  { k: 'consent', label: 'التأكيد' },
]

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

export default function AiRegistration({ initialName = '', initialPhone = '', onDone, onProgress, source = 'mutqan_ai' }) {
  const [user, setUser] = useState(() => auth.getCurrentUser())
  const [stage, setStage] = useState(() => (auth.getCurrentUser() ? 'profile' : 'account'))
  const [name, setName] = useState(initialName || auth.getCurrentUser()?.displayName || '')
  const [phone, setPhone] = useState(initialPhone)
  const [location, setLocation] = useState(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [locDenied, setLocDenied] = useState(false)

  const go = (s, note) => {
    setError('')
    setStage(s)
    onProgress?.(s, note)
  }

  async function signIn() {
    setError('')
    setBusy(true)
    try {
      const u = await auth.signIn()
      if (u) {
        setUser(u)
        if (!name && u.displayName) setName(u.displayName)
        go('profile', 'تم تسجيل الدخول بنجاح')
      }
    } finally {
      setBusy(false)
    }
  }

  function nextFromProfile() {
    if (name.trim().length < 2) return setError('اكتب اسمك')
    if (!isValidPhone(phone)) return setError('اكتب رقم جوال صحيح')
    go('location')
  }

  async function allowLocation() {
    setError('')
    setBusy(true)
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      let address = ''
      try { address = (await maps.reverseGeocode(lat, lng))?.address || '' } catch {}
      setLocation({ lat, lng, address })
      setLocDenied(false)
      go('consent', 'تم تحديد موقعك')
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      setError(denied ? 'صلاحية الموقع مقفولة — اضغط «تفعيل الأذونات»، أو حدده لاحقًا عند الطلب.' : 'تعذر تحديد موقعك الآن — تأكد من تشغيل الموقع وأعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (!consent) return setError('يلزم موافقتك لإنشاء الحساب')
    const u = user || auth.getCurrentUser()
    if (!u) return go('account')
    setBusy(true)
    const session = await saveCustomer(u, { name, phone, location, source })
    setBusy(false)
    onDone(session)
  }

  const idx = STAGES.findIndex((s) => s.k === stage)

  return (
    <div className="bg-white border border-sky-100 rounded-2xl shadow-sm p-4 fade-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-display font-black text-slate-900 text-sm">إنشاء حساب عميل</p>
          <p className="text-[10px] text-slate-500">دخول بضغطة ← الاسم والجوال ← الموقع</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4">
        {STAGES.map((s, i) => (
          <div key={s.k} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${i <= idx ? 'bg-primary' : 'bg-slate-200'}`} />
            <span className={`text-[9px] font-bold ${i <= idx ? 'text-primary' : 'text-slate-400'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {stage === 'account' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            سجّل بضغطة واحدة بحساب Google أو Apple أو بالطريقة التي تفضّلها — بعدها نطلب اسمك ورقم جوالك فقط.
          </p>
          <Btn onClick={signIn} busy={busy} icon={<LogIn size={16} />}>تسجيل الدخول / إنشاء حساب</Btn>
        </div>
      )}

      {stage === 'profile' && (
        <div className="flex flex-col gap-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" className={inputCls} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال 05xxxxxxxx" dir="ltr" inputMode="tel" className={`${inputCls} text-right`} />
          <p className="text-[10px] text-slate-400">رقم الجوال يُحفظ في ملفك ليتواصل معك الفني.</p>
          <Btn onClick={nextFromProfile}>متابعة</Btn>
        </div>
      )}

      {stage === 'location' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-slate-500">{busy ? 'جارٍ تحديد موقعك…' : 'اضغط «تحديد موقعي» ليصلك أقرب فني متاح.'}</p>
          {locDenied && <PermissionHelp kind="location" onRetry={allowLocation} />}
          <Btn onClick={allowLocation} busy={busy} icon={<MapPin size={16} />}>تحديد موقعي</Btn>
          <button onClick={() => go('consent')} className="text-[11px] font-bold text-slate-400 py-1">تحديده لاحقًا عند الطلب</button>
        </div>
      )}

      {stage === 'consent' && (
        <div className="flex flex-col gap-2.5">
          <div className="bg-sky-50 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
            <p><b>الاسم:</b> {name}</p>
            <p><b>الجوال:</b> <span dir="ltr">{phone}</span></p>
            <p><b>الموقع:</b> {location ? location.address || 'تم تحديده' : 'يُحدد عند الطلب'}</p>
          </div>
          <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-sky-600" />
            أوافق على إنشاء حساب عميل في مُتقن وحفظ بياناتي ومحادثتي وربطها بطلباتي.
          </label>
          <Btn onClick={finish} busy={busy} icon={<Check size={16} />}>تأكيد إنشاء الحساب</Btn>
        </div>
      )}

      {error && <p className="text-rose-600 text-[11px] font-bold text-center mt-2">{error}</p>}
    </div>
  )
}

function Btn({ children, onClick, busy, icon }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}
