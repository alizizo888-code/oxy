// Built-in artwork: always-available illustrated slides per specialty (data-URI SVG),
// so every gallery/banner has plenty of images even without photos.
import { SPECIALTIES } from '../constants'
import { sceneLibrary } from './sceneLib'
import { SHOWCASE } from '../serviceShowcase'

const PALETTE = {
  ac: ['#0ea5e9', '#1e3a8a'], electric: ['#f59e0b', '#7c2d12'], plumbing: ['#06b6d4', '#1e3a8a'], locks: ['#6366f1', '#312e81'],
  appliances: ['#a855f7', '#4c1d95'], satellite: ['#64748b', '#0f172a'], paint: ['#f43f5e', '#7f1d1d'], tiling: ['#fb923c', '#7c2d12'],
  cameras: ['#14b8a6', '#134e4a'], fridge: ['#38bdf8', '#0c4a6e'], cleaning: ['#10b981', '#064e3b'], pest: ['#84cc16', '#365314'],
  tanks: ['#3b82f6', '#1e1b4b'], moving: ['#eab308', '#713f12'], solar: ['#fde047', '#9a3412'], corporate: ['#3b82f6', '#0f172a'],
  general: ['#0ea5e9', '#312e81'], contracting: ['#f97316', '#431407'],
}

// Four layouts per specialty: rings, diagonal bars, dots grid, waves.
function svg(id, variant, label) {
  const [a, b] = PALETTE[id] || PALETTE.general
  const deco = [
    `<circle cx="760" cy="120" r="210" fill="#fff" fill-opacity=".10"/><circle cx="760" cy="120" r="140" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/><circle cx="120" cy="470" r="150" fill="#fff" fill-opacity=".08"/>`,
    `<g fill="#fff" fill-opacity=".09"><rect x="-40" y="60" width="420" height="46" transform="rotate(-18 0 0)"/><rect x="200" y="200" width="620" height="46" transform="rotate(-18 0 0)"/><rect x="420" y="360" width="520" height="46" transform="rotate(-18 0 0)"/></g>`,
    `<g fill="#fff" fill-opacity=".16">${Array.from({ length: 60 }, (_, i) => `<circle cx="${60 + (i % 10) * 90}" cy="${50 + Math.floor(i / 10) * 90}" r="${3 + (i % 3)}"/>`).join('')}</g>`,
    `<path d="M0 420 Q 200 330 400 420 T 800 420 T 1200 420 V600 H0Z" fill="#fff" fill-opacity=".10"/><path d="M0 480 Q 200 400 400 480 T 800 480 T 1200 480 V600 H0Z" fill="#fff" fill-opacity=".10"/>`,
  ][variant % 4]
  const glyph = `<text x="${variant % 2 ? 150 : 650}" y="${variant % 2 ? 380 : 230}" font-size="260" font-family="Cairo,Tajawal,sans-serif" font-weight="900" fill="#fff" fill-opacity=".16">${label}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/>${deco}${glyph}</svg>`
}

// 15+ animated illustrated scenes per specialty (see sceneLib); the old static backdrops are kept as extras at the end.
const cache = {}
export function artFor(id) {
  if (cache[id]) return cache[id]
  const spec = SPECIALTIES.find((s) => s.id === id)
  const label = spec?.label || ''
  const lib = sceneLibrary(id, label, SHOWCASE[id]?.lines)
  const lab = label.split(' ')[0].slice(0, 6)
  const extra = [0, 1, 2, 3].map((v) => ({ url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(id, v, lab)), by: null, art: true }))
  return (cache[id] = [...lib, ...extra])
}
