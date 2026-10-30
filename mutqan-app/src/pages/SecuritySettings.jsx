import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Fingerprint, Trash2, Loader2, ShieldCheck } from 'lucide-react'
import { passkey } from '../lib/passkey'
import { auth } from '../lib/auth'
import { useTeamRole } from '../hooks/useTeamRole'

// الأمان والدخول: تفعيل البصمة / الوجه لهذا الجهاز، قائمة الأجهزة المفعّلة، وحالة تثبيت الجلسة.
export default function SecuritySettings() {
  const nav = useNavigate()
  const { isOwner, loading } = useTeamRole()
  const [sup, setSup] = useState(null)
  const [keys, setKeys] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [persisted, setPersisted] = useState(null)
  const [ph, setPh] = useState(() => auth.getCurrentUser()?.phone || '')
  const [phMsg, setPhMsg] = useState('')
  const savePhone = async () => { setPhMsg(''); try { await auth.updateProfile({ phone: ph }); setPhMsg('تم الحفظ ✓ — تقدر الآن تدخل برقم جوالك أو باسم المستخدم') } catch { setPhMsg('تعذر الحفظ') } }
  const load = useCallback(() => { passkey.list().then(setKeys).catch(() => setKeys([])) }, [])
  useEffect(() => { passkey.supported().then(setSup); try { navigator.storage?.persisted?.().then(setPersisted) } catch { /* ignore */ } }, [])
  useEffect(() => { if (isOwner) load() }, [isOwner, load])
  if (loading) return <p className="p-6 text-slate-400 text-sm" dir="rtl">جارِ التحقق…</p>
  if (!isOwner) return <p className="p-6 text-white text-sm font-bold" dir="rtl">الدخول بالبصمة متاح لحساب المالك.</p>
  const enable = async () => {
    setBusy(true); setMsg('')
    try { await passkey.register(); setMsg('تم تفعيل البصمة على هذا الجهاز ✓'); load() }
    catch (e) { setMsg(e && e.name === 'NotAllowedError' ? 'تم الإلغاء أو لم يُسمح بالبصمة.' : (e && e.message) || 'تعذر التفعيل.') }
    finally { setBusy(false) }
  }
  const remove = async (id) => { if (!window.confirm('إزالة هذا الجهاز من الدخول بالبصمة؟')) return; try { await passkey.remove(id); passkey.forgetDevice(); load() } catch { setMsg('تعذر الإزالة') } }
  const card = 'rounded-2xl bg-white/5 border border-white/10 p-4 grid gap-2'
  return (
    <div className="h-full overflow-y-auto pb-24 text-white" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button>
        <div className="flex-1"><h1 className="font-display font-black text-base">الأمان والدخول</h1><p className="text-[11px] text-white/60">البصمة / الوجه وتثبيت تسجيل الدخول</p></div>
      </header>
      <div className="p-4 max-w-xl mx-auto grid gap-3">
        <section className={card}>
          <p className="font-black text-sm">📱 رقم جوال الدخول</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">احفظ رقمك هنا ليتعرف عليك النظام كمالك عند الدخول به (بأي صيغة: 05… أو 966…). لا يمكن إنشاء حساب عميل بنفس الرقم.</p>
          <input dir="ltr" inputMode="tel" value={ph} onChange={(e) => setPh(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-primary" placeholder="05xxxxxxxx" />
          <button onClick={savePhone} className="rounded-xl bg-emerald-500 text-black font-black py-2.5 text-sm">حفظ الرقم</button>
          {phMsg && <p className="text-xs font-bold text-amber-300">{phMsg}</p>}
        </section>
        <section className={card}>
          <p className="font-black flex items-center gap-2"><Fingerprint size={18} className="text-primary" /> الدخول بالبصمة أو الوجه</p>
          <p className="text-xs text-slate-400">بعد التفعيل تدخل ببصمتك فقط من شاشة الدخول، دون اسم مستخدم أو كلمة مرور. تُفعَّل لكل جهاز على حدة.</p>
          {sup === false && <p className="text-xs text-amber-300 font-bold">هذا الجهاز/المتصفح لا يدعم البصمة (أو لم يُضبط قفل شاشة/بصمة في الجهاز). جرّب كروم أو سفاري على جوال مضبوط عليه بصمة أو رمز قفل.</p>}
          <button onClick={enable} disabled={busy || sup === false} className="rounded-xl bg-primary text-black font-black py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />} تفعيل البصمة على هذا الجهاز</button>
          {msg && <p className="text-xs font-bold text-amber-300">{msg}</p>}
          {keys.length > 0 && <p className="text-xs font-black mt-2">الأجهزة المفعّلة ({keys.length})</p>}
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs">
              <span className="flex-1">{k.name || 'جهاز'}<span className="block text-[10px] text-slate-500">{k.last ? `آخر دخول: ${new Date(k.last).toLocaleDateString('ar-SA')}` : 'لم يُستخدم بعد'}</span></span>
              <button onClick={() => remove(k.id)} aria-label="إزالة" className="text-rose-400"><Trash2 size={15} /></button>
            </div>
          ))}
        </section>
        <section className={card}>
          <p className="font-black flex items-center gap-2"><ShieldCheck size={18} className="text-primary" /> تثبيت تسجيل الدخول</p>
          <p className="text-xs text-slate-400">الجلسة تبقى 90 يومًا وتتجدّد تلقائيًا كلما فتحت التطبيق، وتُحفظ بثلاث طبقات (المتصفح، قاعدة الجهاز، كوكي) حتى لا تُفقد.</p>
          <p className="text-xs">حماية التخزين من الحذف التلقائي: <b className={persisted ? 'text-emerald-300' : 'text-amber-300'}>{persisted == null ? 'غير معروفة' : persisted ? 'مفعّلة' : 'غير مفعّلة — ثبّت التطبيق على الشاشة الرئيسية لتفعيلها'}</b></p>
          <button onClick={() => auth.refresh()} className="rounded-xl bg-white/10 py-2 text-xs font-bold">تجديد الجلسة الآن</button>
        </section>
      </div>
    </div>
  )
}
