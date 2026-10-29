// Small dependency-free SVG charts (bar / hbar / line / pie / donut). Every text and colour is escaped/sanitised.
export const xesc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const safeColor = (c, fb = '#38bdf8') => (/^#[0-9a-fA-F]{3,8}$/.test(String(c || '')) ? c : fb)
const PALETTE = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#fb7185', '#facc15', '#2dd4bf']
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }
const trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }
const fmt = (n) => (n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n * 100) / 100))
const TXT = '#94a3b8'

export function chartSvg(spec) {
  const kind = ['bar', 'hbar', 'line', 'pie', 'donut'].includes(spec.kind) ? spec.kind : 'bar'
  const series = (Array.isArray(spec.series) ? spec.series : []).map((s, i) => ({ name: s.name || '', data: (s.data || []).map(num), color: safeColor(s.color, PALETTE[i % PALETTE.length]) }))
  const labels = (spec.labels || []).map((l) => String(l ?? ''))
  const n = Math.max(0, ...series.map((s) => s.data.length), labels.length)
  const title = spec.options && spec.options.title
  const W = 560
  let body = '', H
  if (kind === 'pie' || kind === 'donut') {
    const s0 = series[0] || { data: [] }
    const total = s0.data.reduce((a, b) => a + b, 0) || 1
    const cx = 130, cy = 130, r = 110
    let a = -Math.PI / 2
    s0.data.forEach((v, i) => {
      const ang = (v / total) * Math.PI * 2
      if (ang <= 0) return
      const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a)
      a += ang
      const x2 = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a)
      const col = PALETTE[i % PALETTE.length]
      body += ang >= Math.PI * 2 - 1e-6
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`
        : `<path d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${col}"/>`
      body += `<rect x="270" y="${24 + i * 22}" width="12" height="12" rx="3" fill="${col}"/><text x="290" y="${34 + i * 22}" font-size="12" fill="${TXT}">${xesc(trunc(labels[i] || '', 24))} — ${fmt(s0.data[i])}</text>`
    })
    if (kind === 'donut') body += `<circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="#0f172a"/>`
    H = Math.max(260, 40 + s0.data.length * 22)
  } else if (kind === 'hbar') {
    const max = Math.max(1, ...series.flatMap((s) => s.data))
    const rowH = 28, left = 130
    for (let i = 0; i < n; i++) {
      const y = 12 + i * rowH
      body += `<text x="${left - 8}" y="${y + 16}" text-anchor="end" font-size="12" fill="${TXT}">${xesc(trunc(labels[i] || '', 18))}</text>`
      series.forEach((s, j) => {
        const w = ((s.data[i] || 0) / max) * (W - left - 50)
        body += `<rect x="${left}" y="${y + j * 8}" width="${Math.max(w, 0).toFixed(1)}" height="${series.length > 1 ? 7 : 16}" rx="4" fill="${s.color}"/>`
      })
      body += `<text x="${left + 6 + ((series[0]?.data[i] || 0) / max) * (W - left - 50)}" y="${y + 13}" font-size="11" fill="${TXT}">${fmt(series[0]?.data[i] || 0)}</text>`
    }
    H = 24 + n * rowH
  } else {
    const max = Math.max(1, spec.options?.yMax || 0, ...series.flatMap((s) => s.data))
    const L = 38, T = 14, B = 34, h = 200
    H = T + h + B
    for (let g = 0; g <= 4; g++) {
      const y = T + h - (g / 4) * h
      body += `<line x1="${L}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="#334155" stroke-opacity=".5"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="${TXT}">${fmt((g / 4) * max)}</text>`
    }
    const step = (W - L - 8) / Math.max(n, 1)
    const every = Math.ceil(n / 12)
    for (let i = 0; i < n; i++) if (i % every === 0) body += `<text x="${(L + step * (i + 0.5)).toFixed(1)}" y="${T + h + 16}" text-anchor="middle" font-size="10" fill="${TXT}">${xesc(trunc(labels[i] || '', 8))}</text>`
    if (kind === 'line') {
      series.forEach((s) => {
        const pts = s.data.map((v, i) => `${(L + step * (i + 0.5)).toFixed(1)},${(T + h - (v / max) * h).toFixed(1)}`)
        if (pts.length) body += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>` + pts.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="${s.color}"/>`).join('')
      })
    } else {
      const grp = step * 0.7, bw = grp / Math.max(series.length, 1)
      series.forEach((s, j) => s.data.forEach((v, i) => {
        const bh = (v / max) * h
        body += `<rect x="${(L + step * i + (step - grp) / 2 + j * bw).toFixed(1)}" y="${(T + h - bh).toFixed(1)}" width="${Math.max(bw - 2, 1).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${s.color}"/>`
      }))
    }
  }
  const head = title ? `<text x="8" y="14" font-size="13" font-weight="700" fill="#e2e8f0">${xesc(title)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + (title ? 20 : 0)}" width="100%" role="img" direction="ltr">${head}<g transform="translate(0 ${title ? 20 : 0})">${body}</g></svg>`
}
export const ganttSvg = () => ''
export const ganttDomain = () => ({ start: 0, end: 0 })
