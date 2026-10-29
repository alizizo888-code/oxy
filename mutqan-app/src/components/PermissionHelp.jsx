import { useState } from 'react'
import { MapPinOff, BellOff, Settings, RefreshCw, X } from 'lucide-react'

// Shown only AFTER a permission was blocked. The web cannot open the phone's
// settings by itself, so this guides the user there step by step, then retries.
function platform() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

const STEPS = {
  location: {
    ios: ['افتح «الإعدادات» في الآيفون', 'اختر «الخصوصية والأمن» ثم «خدمات الموقع» وتأكد أنها مفعّلة', 'انزل واختر «Safari» (أو التطبيق المثبّت) واختر «أثناء استخدام التطبيق»', 'ارجع هنا واضغط «أعد المحاولة»'],
    android: ['اضغط على رمز القفل 🔒 بجانب عنوان الموقع أعلى المتصفح', 'اختر «الأذونات» ثم «الموقع» واجعله «سماح»', 'إذا كان التطبيق مثبّتًا: الإعدادات ← التطبيقات ← مُتقن ← الأذونات ← الموقع', 'ارجع هنا واضغط «أعد المحاولة»'],
    desktop: ['اضغط على رمز القفل 🔒 بجانب عنوان الموقع', 'غيّر «الموقع» إلى «سماح»', 'اضغط «أعد المحاولة»'],
  },
  notifications: {
    ios: ['ثبّت التطبيق على الشاشة الرئيسية أولًا (مشاركة ← إضافة إلى الشاشة الرئيسية)', 'افتح «الإعدادات» ← «الإشعارات» ← مُتقن', 'فعّل «السماح بالإشعارات»', 'ارجع هنا واضغط «أعد المحاولة»'],
    android: ['اضغط على رمز القفل 🔒 بجانب عنوان الموقع', 'اختر «الأذونات» ثم «الإشعارات» واجعلها «سماح»', 'أو: الإعدادات ← التطبيقات ← مُتقن ← الإشعارات', 'ارجع هنا واضغط «أعد المحاولة»'],
    desktop: ['اضغط على رمز القفل 🔒 بجانب عنوان الموقع', 'غيّر «الإشعارات» إلى «سماح»', 'اضغط «أعد المحاولة»'],
  },
}

export default function PermissionHelp({ kind = 'location', onRetry, dark = false }) {
  const [open, setOpen] = useState(false)
  const Icon = kind === 'location' ? MapPinOff : BellOff
  const title = kind === 'location' ? 'صلاحية الموقع مقفولة' : 'الإشعارات مقفولة'
  const steps = STEPS[kind][platform()]

  return (
    <>
      <div className={`rounded-2xl p-3 flex items-center gap-2.5 border ${dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`} dir="rtl">
        <Icon size={18} className={dark ? 'text-amber-300 shrink-0' : 'text-amber-600 shrink-0'} />
        <p className={`flex-1 min-w-0 text-[11px] font-bold ${dark ? 'text-amber-200' : 'text-amber-800'}`}>{title} على جهازك</p>
        <button onClick={() => setOpen(true)} className="shrink-0 flex items-center gap-1 bg-amber-500 text-white rounded-full px-3 py-2 text-[11px] font-black active:scale-95 transition-transform">
          <Settings size={12} /> تفعيل الأذونات
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 flex items-end md:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Icon size={18} className="text-amber-700" /></span>
              <p className="flex-1 font-display font-black text-slate-900">{kind === 'location' ? 'تفعيل صلاحية الموقع' : 'تفعيل الإشعارات'}</p>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X size={15} className="text-slate-500" /></button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">سبق رفض الإذن، ولا يستطيع التطبيق فتحه تلقائيًا — فعّله من جهازك بهذه الخطوات:</p>
            <ol className="flex flex-col gap-2 mb-4">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <button
              onClick={() => { setOpen(false); onRetry?.() }}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-display font-black rounded-2xl py-3 text-sm active:scale-[0.98] transition-transform"
            >
              <RefreshCw size={15} /> أعد المحاولة
            </button>
          </div>
        </div>
      )}
    </>
  )
}
