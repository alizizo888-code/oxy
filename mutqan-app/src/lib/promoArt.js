// Illustrated scenes for the business/corporate offer slides (data-URI SVG, no network needed).
// Each kind has 3 variants (palette + backdrop) that cross-fade in the carousel; owners can add real photos under specialty "promo_<kind>".
const W = '#fff'
const SCENES = {
  warranty: `<path d="M450 90 L640 160 V310 C640 410 560 480 450 520 C340 480 260 410 260 310 V160 Z" fill="${W}" fill-opacity=".18" stroke="${W}" stroke-width="10"/><path d="M365 305 L430 370 L545 235" fill="none" stroke="${W}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><text x="450" y="565" text-anchor="middle" font-size="46" font-weight="900" fill="${W}" font-family="Cairo,sans-serif">30</text>`,
  parts: `<g fill="none" stroke="${W}" stroke-width="14"><circle cx="400" cy="300" r="95"/><circle cx="400" cy="300" r="40" fill="${W}" fill-opacity=".3"/>${Array.from({ length: 10 }, (_, i) => `<rect x="386" y="170" width="28" height="42" fill="${W}" stroke="none" transform="rotate(${i * 36} 400 300)"/>`).join('')}</g><g transform="rotate(35 560 380)"><rect x="545" y="230" width="30" height="270" rx="14" fill="${W}"/><circle cx="560" cy="225" r="50" fill="none" stroke="${W}" stroke-width="26"/></g>`,
  contract: `<rect x="270" y="90" width="300" height="400" rx="22" fill="${W}" fill-opacity=".92"/><g stroke="#94a3b8" stroke-width="12" stroke-linecap="round"><path d="M320 160H520M320 215H520M320 270H470"/></g><path d="M320 400 q30 -70 60 -10 t60 -10 t50 -20" fill="none" stroke="#2563eb" stroke-width="12" stroke-linecap="round"/><circle cx="560" cy="450" r="62" fill="#10b981" stroke="${W}" stroke-width="10"/><path d="M532 450 l20 22 l38 -44" fill="none" stroke="${W}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="420" y="545" text-anchor="middle" font-size="40" font-weight="900" fill="${W}" font-family="Cairo,sans-serif">12</text>`,
  field: `<path d="M450 80 C370 80 320 140 320 210 C320 300 450 440 450 440 C450 440 580 300 580 210 C580 140 530 80 450 80Z" fill="${W}" fill-opacity=".92"/><circle cx="450" cy="210" r="52" fill="#0ea5e9"/><path d="M250 520 H650" stroke="${W}" stroke-width="12" stroke-linecap="round"/><path d="M300 480 a60 60 0 0 1 120 0 z M395 440 h110" fill="${W}" stroke="${W}" stroke-width="10"/><circle cx="560" cy="500" r="26" fill="${W}"/><circle cx="340" cy="500" r="26" fill="${W}"/><rect x="330" y="440" width="260" height="60" rx="14" fill="${W}" fill-opacity=".35"/>`,
  emergency: `<path d="M330 430 V300 a120 120 0 0 1 240 0 V430 Z" fill="${W}" fill-opacity=".95"/><rect x="290" y="430" width="320" height="50" rx="14" fill="${W}"/>${[-60, -30, 0, 30, 60].map((a) => `<path d="M450 130 V60" stroke="${W}" stroke-width="14" stroke-linecap="round" transform="rotate(${a} 450 300)"/>`).join('')}<path d="M470 240 L420 320 H460 L440 390 L500 300 H460Z" fill="#f59e0b"/><text x="450" y="565" text-anchor="middle" font-size="50" font-weight="900" fill="${W}" font-family="Cairo,sans-serif">24/7</text>`,
  hotel: `<rect x="300" y="110" width="300" height="400" rx="10" fill="${W}" fill-opacity=".93"/>${Array.from({ length: 20 }, (_, i) => `<rect x="${325 + (i % 4) * 65}" y="${140 + Math.floor(i / 4) * 66}" width="40" height="40" rx="6" fill="${i % 7 === 3 ? '#fbbf24' : '#0ea5e9'}" fill-opacity="${i % 7 === 3 ? 1 : .55}"/>`).join('')}<rect x="400" y="440" width="100" height="70" rx="8" fill="#0f172a" fill-opacity=".55"/><path d="M450 60 l16 34 l38 5 l-28 26 l8 37 l-34 -19 l-34 19 l8 -37 l-28 -26 l38 -5Z" fill="#fbbf24" transform="translate(0 -20) scale(1)"/>`,
  restaurant: `<path d="M260 400 a190 170 0 0 1 380 0Z" fill="${W}" fill-opacity=".95"/><rect x="230" y="400" width="440" height="34" rx="17" fill="${W}"/><circle cx="450" cy="212" r="24" fill="${W}"/><path d="M200 520 H700" stroke="${W}" stroke-width="12" stroke-linecap="round"/><g stroke="${W}" stroke-width="12" stroke-linecap="round"><path d="M180 140 V330 M155 140 V220 a25 25 0 0 0 50 0 V140"/><path d="M720 140 c-40 40 -40 120 0 160 V330"/></g>`,
  mosque: `<path d="M300 420 V330 a150 150 0 0 1 300 0 V420Z" fill="${W}" fill-opacity=".95"/><path d="M450 120 a38 38 0 1 0 22 -68 a30 30 0 1 1 -22 68Z" fill="#fbbf24" transform="translate(0 20)"/><rect x="180" y="190" width="46" height="300" rx="10" fill="${W}"/><path d="M180 190 L203 130 L226 190Z" fill="${W}"/><rect x="674" y="190" width="46" height="300" rx="10" fill="${W}"/><path d="M674 190 L697 130 L720 190Z" fill="${W}"/><rect x="240" y="420" width="420" height="90" rx="8" fill="${W}" fill-opacity=".85"/><path d="M420 510 v-60 a30 30 0 0 1 60 0 v60Z" fill="#0f172a" fill-opacity=".5"/>`,
  factory: `<path d="M180 500 V300 L330 380 V300 L480 380 V300 L630 380 V230 H720 V500Z" fill="${W}" fill-opacity=".95"/><rect x="540" y="110" width="50" height="170" fill="${W}"/><rect x="630" y="70" width="50" height="170" fill="${W}"/><circle cx="560" cy="80" r="34" fill="${W}" fill-opacity=".45"/><circle cx="610" cy="40" r="40" fill="${W}" fill-opacity=".3"/>${Array.from({ length: 5 }, (_, i) => `<rect x="${215 + i * 100}" y="430" width="60" height="45" rx="6" fill="#0ea5e9" fill-opacity=".6"/>`).join('')}`,
  company: `<rect x="230" y="180" width="140" height="320" rx="8" fill="${W}" fill-opacity=".85"/><rect x="390" y="90" width="170" height="410" rx="8" fill="${W}" fill-opacity=".97"/><rect x="580" y="230" width="120" height="270" rx="8" fill="${W}" fill-opacity=".8"/>${Array.from({ length: 28 }, (_, i) => `<rect x="${405 + (i % 4) * 38}" y="${110 + Math.floor(i / 4) * 52}" width="24" height="30" rx="4" fill="#0ea5e9" fill-opacity="${i % 5 ? .5 : .95}"/>`).join('')}<path d="M180 500 H750" stroke="${W}" stroke-width="12" stroke-linecap="round"/>`,
}
const PAL = {
  warranty: [['#059669', '#064e3b'], ['#0ea5e9', '#1e3a8a'], ['#10b981', '#134e4a']],
  parts: [['#f59e0b', '#7c2d12'], ['#6366f1', '#1e1b4b'], ['#14b8a6', '#134e4a']],
  contract: [['#2563eb', '#0f172a'], ['#7c3aed', '#312e81'], ['#0891b2', '#082f49']],
  field: [['#0ea5e9', '#1e3a8a'], ['#f97316', '#7c2d12'], ['#22c55e', '#14532d']],
  emergency: [['#ef4444', '#7f1d1d'], ['#f97316', '#431407'], ['#e11d48', '#4c0519']],
  hotel: [['#7c3aed', '#1e1b4b'], ['#0ea5e9', '#0c4a6e'], ['#d97706', '#451a03']],
  restaurant: [['#f43f5e', '#4c0519'], ['#f59e0b', '#78350f'], ['#10b981', '#064e3b']],
  mosque: [['#059669', '#022c22'], ['#0369a1', '#082f49'], ['#a16207', '#422006']],
  factory: [['#64748b', '#0f172a'], ['#0ea5e9', '#082f49'], ['#f97316', '#431407']],
  company: [['#3b82f6', '#0f172a'], ['#6366f1', '#1e1b4b'], ['#06b6d4', '#083344']],
}
const BACK = [
  '<circle cx="760" cy="120" r="210" fill="#fff" fill-opacity=".10"/><circle cx="120" cy="480" r="150" fill="#fff" fill-opacity=".08"/>',
  '<g fill="#fff" fill-opacity=".08"><rect x="-40" y="60" width="520" height="40" transform="rotate(-18)"/><rect x="260" y="230" width="640" height="40" transform="rotate(-18)"/></g>',
  '<path d="M0 470 Q 220 390 450 470 T 900 470 V600 H0Z" fill="#fff" fill-opacity=".10"/><g fill="#fff" fill-opacity=".14">' + Array.from({ length: 24 }, (_, i) => `<circle cx="${50 + (i % 8) * 110}" cy="${40 + Math.floor(i / 8) * 40}" r="3"/>`).join('') + '</g>',
]
const cache = {}
export function promoArt(kind) {
  if (cache[kind]) return cache[kind]
  const sc = SCENES[kind] || SCENES.company
  const pal = PAL[kind] || PAL.company
  cache[kind] = [0, 1, 2].map((v) => {
    const [a, b] = pal[v]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/>${BACK[v]}<g transform="translate(${v === 1 ? 20 : v === 2 ? -20 : 0} 0)">${sc}</g></svg>`
    return { url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), art: true }
  })
  return cache[kind]
}
export const PROMO_KINDS = Object.keys(SCENES)
export const PROMO_LABELS = { warranty: 'الضمان', parts: 'ضمان قطع الغيار', contract: 'العقود السنوية', field: 'الخدمات الميدانية', emergency: 'الطوارئ', hotel: 'الفنادق', restaurant: 'المطاعم', mosque: 'المساجد', factory: 'المصانع', company: 'الشركات' }
