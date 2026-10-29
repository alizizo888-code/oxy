import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

export default function ThemeToggle({ className = '' }) {
  const [t, toggle] = useTheme()
  return (
    <button onClick={toggle} aria-label={t === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'} data-keep-colors
      className={`w-10 h-10 rounded-full bg-white/90 border border-sky-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform shrink-0 ${className}`}>
      {t === 'dark' ? <Sun size={17} className="text-amber-500" /> : <Moon size={17} className="text-slate-600" />}
    </button>
  )
}
