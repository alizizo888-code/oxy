import { useState } from 'react'

// Two short phrases at a time, a divider between them; the pair drifts to the right and the next pair follows each pass.
const PAIRS = [
  // تسبيح
  ['سبحان الله', 'الحمد لله'],
  ['سبحان الله وبحمده', 'سبحان الله العظيم'],
  ['سبحان الله والحمد لله', 'ولا إله إلا الله والله أكبر'],
  ['سبحان ربي العظيم', 'سبحان ربي الأعلى'],
  ['سبحان الله وبحمده', 'عدد خلقه ورضا نفسه'],
  // تهليل
  ['لا إله إلا الله', 'محمد رسول الله'],
  ['لا إله إلا الله وحده لا شريك له', 'له الملك وله الحمد'],
  ['لا إله إلا أنت', 'سبحانك إني كنت من الظالمين'],
  ['أشهد أن لا إله إلا الله', 'وأشهد أن محمدًا رسول الله'],
  ['لا حول ولا قوة إلا بالله', 'العلي العظيم'],
  // تكبير
  ['الله أكبر', 'الله أكبر كبيرًا'],
  ['الله أكبر', 'ولله الحمد'],
  ['الله أكبر الله أكبر', 'لا إله إلا الله'],
  ['الله أكبر كبيرًا', 'والحمد لله كثيرًا'],
  // استغفار وصلاة وتوكل
  ['استغفر الله', 'وأتوب إليه'],
  ['أستغفر الله العظيم', 'الذي لا إله إلا هو'],
  ['اللهم صلِّ على محمد', 'وعلى آل محمد'],
  ['حسبنا الله ونعم الوكيل', 'توكلت على الله'],
  ['ما شاء الله', 'لا قوة إلا بالله'],
]

// Slim dhikr ticker for the home header. Tap = the bar flashes yellow, blue and light green, then settles.
export default function DhikrBanner({ className = '' }) {
  const [n, setN] = useState(0)
  const [i, setI] = useState(0)
  const [a, b] = PAIRS[i % PAIRS.length]
  const unit = (k) => <span key={k} className="px-4 inline-flex items-center gap-4"><span>{a}</span><span className="text-sky-500 font-black">/</span><span>{b}</span><span className="text-sky-500 font-black">/</span></span>
  return (
    <button
      key={n}
      onClick={() => setN((x) => x + 1)}
      aria-label="أذكار"
      className={`${n ? 'dhikr-flash' : ''} flex-1 min-w-0 overflow-hidden bg-white/90 border border-sky-100 rounded-full py-2.5 text-[12px] font-black text-emerald-800 shadow-sm active:scale-[0.98] transition-transform ${className}`}
      dir="ltr"
    >
      <span className="dhikr-track" dir="rtl" onAnimationIteration={(e) => { if (e.target === e.currentTarget) setI((x) => x + 1) }}>
        {unit(0)}{unit(1)}{unit(2)}{unit(3)}
      </span>
    </button>
  )
}
