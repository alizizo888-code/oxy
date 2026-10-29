import { useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Share, SquarePlus, Smartphone, ShieldCheck, CheckCircle2, Apple, Bot } from 'lucide-react'
import { useState } from 'react'
import { useInstall } from '../lib/install'
import IosInstallSheet from '../components/IosInstallSheet'

const APP_URL = 'https://mutqan.oxygen11.com/app/'

export default function InstallApp() {
  const navigate = useNavigate()
  const { canPrompt, installed, ios, iosSafari, android, install } = useInstall()
  const [sheet, setSheet] = useState(false)
  return (
    <div className="h-full overflow-y-auto bg-[#f5f7f5] pb-16" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#f5f7f5]/90 backdrop-blur border-b border-black/5 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center"><ChevronRight size={18} className="text-slate-600" /></button>
          <h1 className="font-display text-lg font-black text-slate-900">تحميل تطبيق متقن</h1>
        </div>
      </header>
      <div className="max-w-xl mx-auto w-full px-4 pt-5 flex flex-col gap-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#0b7a75] to-[#071a33] text-white p-6 text-center shadow-lg" data-keep-colors>
          <img src={`${window.__MUTQAN__?.app || "/app/"}icon-192.png`} alt="" className="w-20 h-20 rounded-2xl mx-auto shadow-xl" />
          <p className="font-display font-black text-xl mt-3">مُتقن</p>
          <p className="text-xs text-white/80 mt-1 leading-relaxed">طلباتك وإشعاراتك ومحادثاتك في تطبيق واحد على شاشة جوالك — للعملاء والفنيين والإدارة.</p>
          {installed && <p className="mt-3 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-bold"><CheckCircle2 size={14} /> أنت تستخدم التطبيق الآن</p>}
        </div>

        <Card icon={<Bot size={18} />} title="أندرويد" highlight={android}>
          {canPrompt ? (
            <button onClick={install} className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-black font-display font-black rounded-2xl py-3.5 active:scale-[0.98] transition-transform"><Download size={18} /> تثبيت التطبيق الآن</button>
          ) : (
            <ol className="text-sm text-slate-700 leading-loose list-decimal pr-5">
              <li>افتح الرابط في متصفح <b>Chrome</b>: <span dir="ltr" className="font-mono text-xs break-all">{APP_URL}</span></li>
              <li>اضغط ⋮ (القائمة) ثم <b>«تثبيت التطبيق»</b> أو «إضافة إلى الشاشة الرئيسية».</li>
              <li>سيظهر «متقن» بين تطبيقاتك ويفتح بملء الشاشة.</li>
            </ol>
          )}
        </Card>

        <Card icon={<Apple size={18} />} title="آيفون / آيباد" highlight={ios}>
          {ios && !iosSafari && <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3">افتح هذه الصفحة في متصفح <b>Safari</b> — التثبيت على الآيفون يعمل منه فقط.</p>}
          <button onClick={() => setSheet(true)} className="w-full mb-3 flex items-center justify-center gap-2 bg-slate-900 text-white font-display font-black rounded-2xl py-3.5 active:scale-[0.98] transition-transform"><Download size={18} /> تثبيت على الآيفون</button>
          <ol className="text-sm text-slate-700 leading-loose list-decimal pr-5">
            <li>افتح <span dir="ltr" className="font-mono text-xs break-all">{APP_URL}</span> في <b>Safari</b>.</li>
            <li>اضغط زر المشاركة <Share size={14} className="inline mx-1" /> أسفل الشاشة.</li>
            <li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> <SquarePlus size={14} className="inline mx-1" /> ثم «إضافة».</li>
          </ol>
        </Card>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex gap-3">
          <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <p className="font-black text-sm mb-1">آمن ولا يظهر تحذير «تطبيق مجهول»</p>
            التثبيت يتم من موقعنا المشفّر (HTTPS) مباشرة، فلا حاجة لتحميل ملف APK ولا لتفعيل «مصادر غير معروفة»، ولا يمر عبر متاجر قد تحجبه. التحديثات تصلك تلقائيًا.
          </div>
        </div>
        <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1"><Smartphone size={12} /> نفس الحساب والبيانات على الويب والتطبيق.</p>
      </div>
      <IosInstallSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  )
}

function Card({ icon, title, highlight, children }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm border ${highlight ? 'border-primary ring-2 ring-primary/20' : 'border-black/5'}`}>
      <p className="font-display font-black text-slate-900 flex items-center gap-2 mb-3"><span className="text-primary">{icon}</span> {title}{highlight && <span className="mr-auto text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">جهازك</span>}</p>
      {children}
    </section>
  )
}
