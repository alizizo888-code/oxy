import { useState } from 'react'
import { auth } from '../lib/auth'
import { currentUser } from '../lib/_api'

const ROLE = { owner: 'مالك', operations: 'مشرف عمليات', supervisor: 'مشرف', technician: 'فني' }

// Shown instead of a bare "no permission": tells the person WHICH account they are signed in with and lets them fix it in one tap.
export default function AccessDenied({ need = 'المالك ومشرف العمليات', refresh }) {
  const u = currentUser()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const recheck = async () => {
    setBusy(true); setMsg('')
    try { await auth.refresh(); await refresh?.(); const n = currentUser(); setMsg(n?.role ? `الصلاحية الحالية: ${ROLE[n.role] || n.role}` : 'الحساب الحالي بلا صلاحيات فريق') } catch { setMsg('تعذر التحقق الآن — تحقق من الاتصال') } finally { setBusy(false) }
  }
  const switchAcc = async () => { try { await auth.signOut() } catch { /* ignore */ } location.hash = '#/staff'; location.reload() }
  return (
    <div className="h-full flex items-center justify-center p-6 text-center text-white" dir="rtl">
      <div className="max-w-sm grid gap-3">
        <p className="font-black text-base">هذه الصفحة لـ{need} فقط</p>
        <p className="text-sm text-slate-300 leading-relaxed">
          {u ? <>أنت داخل الآن باسم <b>{u.displayName || u.handle}</b> ({u.role ? ROLE[u.role] || u.role : 'حساب عميل'}).</> : 'لم يتم التعرف على حساب مسجّل.'}
          {u && !u.role && ' هذا حساب عميل وليس حساب المالك — سجّل الدخول باسم المستخدم أو برقم جوال حساب المالك.'}
        </p>
        <button onClick={recheck} disabled={busy} className="rounded-xl bg-sky-500 text-black font-black py-2.5 text-sm disabled:opacity-50">{busy ? 'جارِ التحقق…' : 'إعادة التحقق من صلاحيتي'}</button>
        <button onClick={switchAcc} className="rounded-xl bg-white/10 font-black py-2.5 text-sm">الدخول بحساب المالك</button>
        {msg && <p className="text-xs font-bold text-amber-300">{msg}</p>}
      </div>
    </div>
  )
}
