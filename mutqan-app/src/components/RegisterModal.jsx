import { useState } from 'react'
import { UserX, X, ArrowLeft } from 'lucide-react'
import AiRegistration from './AiRegistration'
import { isValidPhone } from '../registration'

// Shown only at the very end — when the visitor presses the final confirm button
// after choosing the service, location and agreeing on everything:
// register (one tap + name + mobile + location) or continue as a guest (name + mobile).
const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

export default function RegisterModal({ open, onClose, onDone, initial = {} }) {
  const [guest, setGuest] = useState(false)
  const [name, setName] = useState(initial.name || '')
  const [phone, setPhone] = useState(initial.phone || '')
  const [err, setErr] = useState('')
  if (!open) return null

  function continueGuest() {
    if (name.trim().length < 2) return setErr('اكتب اسمك')
    if (!isValidPhone(phone)) return setErr('اكتب رقم جوال صحيح ليتواصل معك الفني')
    setErr('')
    onDone({ type: 'guest', name: name.trim(), phone: phone.trim(), at: new Date().toISOString() })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 overflow-y-auto fade-up"
        style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-black text-slate-900 text-lg">خطوة أخيرة لإرسال طلبك</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
            <X size={16} className="text-slate-500" />
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">سجّل بياناتك لتتابع طلبك من أي جهاز، أو أكمل كزائر.</p>

        {!guest ? (
          <>
            <AiRegistration initialName={name} initialPhone={phone} onDone={onDone} source="app" />
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] text-slate-400 font-bold">أو</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <button onClick={() => setGuest(true)} className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold rounded-2xl py-3.5 border border-slate-200 active:scale-[0.98] transition-transform hover:bg-slate-200">
              <UserX size={17} />
              متابعة كزائر
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2.5 bg-white border border-slate-200 rounded-2xl p-4">
            <p className="font-display font-black text-slate-900 text-sm flex items-center gap-1.5"><UserX size={16} className="text-slate-500" /> متابعة كزائر</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال 05xxxxxxxx" dir="ltr" inputMode="tel" className={`${inputCls} text-right`} />
            {err && <p className="text-rose-600 text-[11px] font-bold text-center">{err}</p>}
            <button onClick={continueGuest} className="w-full bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-xl py-2.5 text-sm active:scale-[0.98] transition-transform">
              إرسال الطلب
            </button>
            <button onClick={() => setGuest(false)} className="text-[11px] font-bold text-primary flex items-center justify-center gap-1 py-1">
              <ArrowLeft size={12} className="rotate-180" /> الرجوع للتسجيل
            </button>
          </div>
        )}
        <p className="text-[11px] text-slate-400 leading-relaxed text-center mt-2">
          كزائر تُحفظ طلباتك على هذا الجهاز فقط. بالتسجيل تُربط طلباتك بحسابك على أي جهاز.
        </p>
      </div>
    </div>
  )
}
