import { useLocation } from 'react-router-dom'
import { useInstall } from '../lib/install'
import { Download, Smartphone } from 'lucide-react'
import { APK_OPS, isNativeShell } from '../lib/nativeApps'

// Operations supervisor app: a separately installable app (own icon/name, opens on the operations room) served from /app/ops.
const opsUrl = () => { try { return new URL('ops', window.__MUTQAN__?.app || location.origin + '/app/').toString() } catch { return '/app/ops' } }
const onOps = () => typeof location !== 'undefined' && /\/app\/ops\/?$/.test(location.pathname)

export default function OpsInstall() {
  const { canPrompt, installed, ios, install } = useInstall()
  const { pathname } = useLocation()
  if (installed || isNativeShell()) return null
  if (!onOps()) {
    if (pathname !== '/staff/operations') return null
    return (
      <a href={opsUrl()} className="fixed top-2 left-2 z-30 flex items-center gap-1.5 rounded-full bg-sky-500/90 text-black text-[11px] font-black px-3 py-1.5 shadow-lg">
        <Smartphone size={13} /> تطبيق المشرف
      </a>
    )
  }
  return (
    <div className="fixed top-2 inset-x-3 z-30 rounded-2xl bg-sky-500 text-black px-4 py-3 shadow-xl flex items-center gap-3" dir="rtl">
      <Smartphone size={20} />
      <div className="flex-1 text-xs font-black leading-relaxed">
        {canPrompt ? 'ثبّت «مشرف العمليات» كتطبيق مستقل: إشعارات وواتساب وخط ساخن.' : ios ? 'في آيفون: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».' : 'من قائمة المتصفح اختر «تثبيت التطبيق».'}
      </div>
      <a href={APK_OPS} className="rounded-xl bg-white text-black text-xs font-black px-3 py-2">🤖 APK</a>
      {canPrompt && <button onClick={install} className="rounded-xl bg-black text-white text-xs font-black px-3 py-2 flex items-center gap-1"><Download size={14} /> تثبيت</button>}
    </div>
  )
}
