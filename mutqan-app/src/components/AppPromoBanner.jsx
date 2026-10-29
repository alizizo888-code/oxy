import { useNavigate } from 'react-router-dom'
import { Gift, Download, Share2 } from 'lucide-react'
import { useWelcome, WELCOME_LABEL, shareText } from '../lib/welcome'
import { useState } from 'react'
import { useInstall } from '../lib/install'
import IosInstallSheet from './IosInstallSheet'

// Rotating-free, honest ad: welcome offer (30% up to 20 SAR) + install the app + share. Hides itself when nothing is left to promote.
// variant: 'wide' (banners/galleries) | 'compact' (settings/account)
export default function AppPromoBanner({ variant = 'wide', className = '' }) {
  const navigate = useNavigate()
  const w = useWelcome()
  const { installed, install, canPrompt, ios } = useInstall()
  const [sheet, setSheet] = useState(false)
  const offer = w.state === 'available' || w.state === 'claimed'
  if (installed && !offer) return null

  async function share() {
    const text = shareText()
    try { if (navigator.share) { await navigator.share({ text }); return } } catch { return }
    try { await navigator.clipboard.writeText(text) } catch {}
  }
  const onDownload = () => (canPrompt ? install() : ios ? setSheet(true) : navigate('/install'))
  const small = variant === 'compact'

  return (
    <section data-keep-colors className={`relative overflow-hidden rounded-2xl text-white shadow-md bg-gradient-to-l from-[#0b7a75] via-[#0f5f8f] to-[#071a33] ${small ? 'p-3.5' : 'p-4'} ${className}`}>
      <div className="absolute -left-6 -top-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><Gift size={22} /></div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-black text-sm leading-snug">{offer ? `خصم ${WELCOME_LABEL} على أول طلب` : 'حمّل تطبيق أكسجين'}</p>
          <p className="text-[11px] text-white/80 leading-relaxed mt-0.5">{offer ? 'حمّل التطبيق وشاركه مع أصدقائك — لكل جهاز جديد مرة واحدة.' : 'طلباتك وإشعاراتك ومحادثاتك في تطبيق واحد على جوالك.'}</p>
        </div>
      </div>
      <div className="relative flex gap-2 mt-3">
        {!installed && <button onClick={onDownload} className="flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-900 rounded-xl py-2 text-xs font-black active:scale-95 transition-transform"><Download size={14} /> تحميل التطبيق</button>}
        {offer && w.state === 'available' && <button onClick={() => w.claim()} className="flex-1 bg-amber-400 text-black rounded-xl py-2 text-xs font-black active:scale-95 transition-transform">فعّل الخصم</button>}
        <button onClick={share} className="flex items-center justify-center gap-1.5 bg-white/15 border border-white/25 rounded-xl px-3 py-2 text-xs font-bold active:scale-95 transition-transform"><Share2 size={14} /> مشاركة</button>
      </div>
      <IosInstallSheet open={sheet} onClose={() => setSheet(false)} />
    </section>
  )
}
