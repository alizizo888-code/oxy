import { useState } from 'react'
import { Share, SquarePlus, X, Copy, Check, ArrowDown } from 'lucide-react'
import { isIOSSafari } from '../lib/install'

const APP_URL = 'https://mutqan.oxygen11.com/app/'

// iPhone has no install API: this sheet walks the user through Safari's "Add to Home Screen".
export default function IosInstallSheet({ open, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!open) return null
  const safari = isIOSSafari()
  async function copy() {
    try { await navigator.clipboard.writeText(APP_URL); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  const steps = [
    [<Share size={20} />, 'اضغط زر المشاركة', 'في أسفل شاشة Safari (المربع والسهم للأعلى).'],
    [<SquarePlus size={20} />, 'اختر «إضافة إلى الشاشة الرئيسية»', 'مرّر القائمة للأسفل إن لم تظهر.'],
    [<Check size={20} />, 'اضغط «إضافة»', 'سيظهر «أكسجين» بين تطبيقاتك ويفتح بملء الشاشة.'],
  ]
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose} dir="rtl">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl" data-keep-colors>
        <div className="flex items-center mb-3">
          <p className="font-display font-black text-slate-900 flex-1">تثبيت التطبيق على الآيفون</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X size={16} className="text-slate-600" /></button>
        </div>
        {!safari && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
            التثبيت على الآيفون يعمل من <b>Safari</b> فقط. انسخ الرابط وافتحه هناك:
            <button onClick={copy} className="mt-2 w-full flex items-center justify-center gap-2 bg-amber-500 text-black font-black rounded-lg py-2">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'تم النسخ' : 'نسخ رابط التطبيق'}</button>
          </div>
        )}
        <ol className="flex flex-col gap-3">
          {steps.map(([icon, t, d], i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{icon}</span>
              <div><p className="text-sm font-black text-slate-900">{i + 1}. {t}</p><p className="text-[11px] text-slate-500 mt-0.5">{d}</p></div>
            </li>
          ))}
        </ol>
        {safari && <p className="mt-4 text-center text-primary text-xs font-bold flex items-center justify-center gap-1"><ArrowDown size={14} className="animate-bounce" /> زر المشاركة أسفل الشاشة</p>}
        <button onClick={onClose} className="mt-4 w-full bg-slate-900 text-white font-black rounded-xl py-3 text-sm">فهمت</button>
      </div>
    </div>
  )
}
