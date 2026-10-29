import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, LogOut, Wrench, User, Phone, Fingerprint, Loader2, HardHat, Settings2 } from 'lucide-react'
import { isRegistered } from '../../registration'
import { passkeySupported, getPasskey, enrollPasskey, unlockWithPasskey, removePasskey, passkeyErrorMessage } from '../../passkey'
import { useAiSettings } from '../../hooks/useAiSettings'
import { auth } from '../../lib/auth'
import { useSession } from '../../hooks/useSession'
import AppPromoBanner from '../../components/AppPromoBanner'
import RegisterModal from '../../components/RegisterModal'

export default function Account() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const [showRegister, setShowRegister] = useState(false)
  const platformUser = auth.getCurrentUser()
  const { settings: aiSettings } = useAiSettings()
  const [pkSupported, setPkSupported] = useState(false)
  const [passkey, setPasskey] = useState(getPasskey)
  const [pkBusy, setPkBusy] = useState(false)
  const [pkMsg, setPkMsg] = useState('')
  useEffect(() => { passkeySupported().then(setPkSupported) }, [])
  const passkeyAllowed = aiSettings.registration.passkeyEnabled

  async function enablePasskey() {
    setPkBusy(true)
    setPkMsg('')
    try {
      setPasskey(await enrollPasskey(session))
      setPkMsg('تم تفعيل الدخول بالبصمة على هذا الجهاز ✅')
    } catch (e) {
      setPkMsg(passkeyErrorMessage(e))
    } finally {
      setPkBusy(false)
    }
  }

  async function loginWithPasskey() {
    setPkBusy(true)
    setPkMsg('')
    try {
      const profile = await unlockWithPasskey()
      setSession({ ...profile, type: 'verified', via: 'passkey', at: new Date().toISOString() })
      if (!auth.getCurrentUser()) await auth.signIn()
    } catch (e) {
      setPkMsg(passkeyErrorMessage(e))
    } finally {
      setPkBusy(false)
    }
  }

  const verified = isRegistered(session, platformUser)
  const name = session?.name || platformUser?.displayName || ''
  const phone = verified ? session?.phone || '' : ''
  const initial = (name || 'م').trim().charAt(0)

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#eaf3fc]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-4">
          <h1 className="font-display text-lg font-black text-slate-900">حسابي</h1>
          <p className="text-[11px] text-slate-500">هويتك وجلستك في تطبيق مُتقن</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        <AppPromoBanner variant="compact" />
        {/* Profile card */}
        <div className="bg-white rounded-3xl border border-black/5 shadow-sm p-5 fade-up">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary text-white font-display font-black text-xl flex items-center justify-center shrink-0">
              {verified || platformUser ? initial : <User size={22} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-slate-900 truncate">{name || 'زائر مُتقن'}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {verified || platformUser ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <ShieldCheck size={11} />
                    {verified ? 'عميل مسجّل' : 'أكمل الاسم ورقم الجوال'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">وضع الزائر</span>
                )}
              </div>
              {phone && (
                <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-1.5 truncate" dir="ltr">
                  <Phone size={11} /> {phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-5">
            {!verified && passkey && passkeyAllowed && (
              <button
                onClick={loginWithPasskey}
                disabled={pkBusy}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-2xl py-3.5 shadow-md shadow-sky-200 disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                {pkBusy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
                الدخول بالبصمة كـ {passkey.profile?.name || 'عميل مُتقن'}
              </button>
            )}
            {verified && passkeyAllowed && pkSupported && !passkey && (
              <button
                onClick={enablePasskey}
                disabled={pkBusy}
                className="w-full flex items-center justify-center gap-2 bg-sky-50 text-sky-700 font-bold rounded-2xl py-3 border border-sky-200 disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                {pkBusy ? <Loader2 size={17} className="animate-spin" /> : <Fingerprint size={17} />}
                تفعيل الدخول بالبصمة / السمات الحيوية
              </button>
            )}
            {verified && passkey && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><Fingerprint size={14} /> الدخول بالبصمة مفعّل على هذا الجهاز</span>
                <button
                  onClick={() => { if (confirm('إيقاف الدخول بالبصمة على هذا الجهاز؟')) { removePasskey(); setPasskey(null) } }}
                  className="text-[10px] font-bold text-slate-500 underline"
                >
                  إيقاف
                </button>
              </div>
            )}
            {pkMsg && <p className="text-[11px] font-bold text-center text-slate-600">{pkMsg}</p>}
            {!verified && (
              <button
                onClick={() => setShowRegister(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white font-display font-black rounded-2xl py-3.5 active:scale-[0.98] transition-transform hover:bg-primary/90"
              >
                <ShieldCheck size={18} />
                {platformUser ? 'أكمل تسجيلك (الاسم والجوال والموقع)' : passkey && passkeyAllowed ? 'أو سجّل الدخول بحساب Google / Apple' : 'تسجيل / دخول بحساب Google / Apple'}
              </button>
            )}
            {platformUser && (
              <button
                onClick={() => auth.signIn()}
                className="w-full flex items-center justify-center gap-2 bg-white text-slate-600 font-bold rounded-2xl py-3 border border-slate-200 active:scale-[0.98] transition-transform hover:bg-slate-50"
              >
                <Settings2 size={16} />
                إدارة الحساب
              </button>
            )}
            {(verified || session?.type === 'guest') && (
              <button
                onClick={() => {
                  if (confirm('سيتم تسجيل الخروج من جلسة هذا الجهاز فقط. طلباتك السابقة تبقى محفوظة عليه.')) setSession(null)
                }}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold rounded-2xl py-3 border border-slate-200 active:scale-[0.98] transition-transform"
              >
                <LogOut size={16} />
                تسجيل الخروج من هذا الجهاز
              </button>
            )}
          </div>

          {session?.type === 'guest' && (
            <p className="text-[11px] text-slate-400 leading-relaxed mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
              جلستك الحالية كزائر: تُحفظ طلباتك على هذا الجهاز فقط. بالتسجيل بضغطة (Google أو Apple) تُربط طلباتك الجديدة بحسابك.
            </p>
          )}
        </div>

        {/* Staff entry */}
        <button
          onClick={() => navigate('/staff')}
          className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-center gap-3 active:scale-[0.98] transition-transform hover:shadow-md fade-up"
          style={{ animationDelay: '80ms' }}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <Wrench size={18} className="text-white" />
          </div>
          <div className="flex-1 text-right">
            <p className="font-display font-black text-slate-900 text-sm">دخول فريق العمل</p>
            <p className="text-[11px] text-slate-500 mt-0.5">للفنيين والمشرفين عبر حسابات الفريق</p>
          </div>
        </button>

        {/* Technician signup */}
        <button
          onClick={() => navigate('/join-tech')}
          className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-center gap-3 active:scale-[0.98] transition-transform hover:shadow-md fade-up"
          style={{ animationDelay: '110ms' }}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <HardHat size={18} className="text-white" />
          </div>
          <div className="flex-1 text-right">
            <p className="font-display font-black text-slate-900 text-sm">سجّل كفني في مُتقن</p>
            <p className="text-[11px] text-slate-500 mt-0.5">قدّم طلب انضمام — يُفعّل حسابك بعد موافقة الإدارة</p>
          </div>
        </button>

        {/* Facts */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-2.5 fade-up" style={{ animationDelay: '140ms' }}>
          <Fact icon="🛡️" title="ضمان الفنيين الذهبي" sub="30 يومًا على كل خدمة — إعادة زيارة مجانية أو استرداد المبلغ" />
          <Fact icon="📍" title="تتبّع حي" sub="شاهد موقع الفني على الخريطة لحظة تحركه نحوك" />
          <Fact icon="⚡" title="طوارئ 24 ساعة" sub="استجابة عاجلة للأعطال الحرجة في أي وقت" />
        </div>

        <p className="text-center text-[10px] text-slate-400 pb-2">مُتقن — إحدى مبادرات مؤسسة البقمي للصيانة والمقاولات العامة</p>
      </div>

      <RegisterModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onDone={(s) => {
          setSession(s)
          setShowRegister(false)
        }}
        initial={{ name: session?.name || name, phone: session?.phone || '' }}
      />
    </div>
  )
}

function Fact({ icon, title, sub }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-black text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{sub}</p>
      </div>
    </div>
  )
}
