// AC price engine — same data & rules as the Oxygen AC app (v24), configurable by the owner.
export const AC_TYPES = {
  wash: ['سبليت', 'شباك', 'باكيدج', 'كونسيلد', 'داكت', 'مركزي', 'دولابي'],
  install: [
    { v: 'تركيب مكيف', l: 'تركيب مكيف' },
    { v: 'فك مكيف', l: 'فك مكيف فقط' },
    { v: 'فك ونقل وتركيب', l: 'فك ونقل وتركيب شامل' },
    { v: 'تأسيس مواسير نحاس', l: 'تأسيس وتمديد مواسير نحاس' },
  ],
  maintenance: ['سبليت', 'شباك', 'داكت', 'كونسيلد', 'مركزي', 'باكيدج', 'دولابي', 'غرفة تبريد وتجميد'],
}
export const AC_MODES = [
  { id: 'wash', label: 'غسيل', icon: '🧼' },
  { id: 'install', label: 'تركيب ونقل', icon: '🔧' },
  { id: 'maintenance', label: 'صيانة وفحص', icon: '🛠️' },
]
export const AC_WARRANTY = [
  { v: 'بدون', l: 'ضمان ذهبي 15 يوم (مجاناً)', add: 'w0' },
  { v: 'شهر', l: 'ضمان شامل لمدة شهر', add: 'w1' },
  { v: 'شهرين', l: 'ضمان شامل لمدة شهرين', add: 'w2' },
  { v: '3 شهور', l: 'ضمان شامل لمدة 3 شهور VIP', add: 'w3' },
]
export const DEFAULT_AC = {
  split1: 100, split2: 140, split3: 200, win1: 60, win2: 100, win3: 150, winExtra: 50, other1: 180,
  innerOff1: 10, innerOff2: 20, innerOff3: 40, w1: 10, w2: 20, w3: 30, vatPct: 15,
  installPrices: { 'تركيب مكيف': 0, 'فك مكيف': 0, 'فك ونقل وتركيب': 0, 'تأسيس مواسير نحاس': 0 }, // 0 = يحدد بعد المعاينة
  visitFee: 50, maxDiscountPct: 10, waNumber: '966549423050',
}
const n = (v, fb) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : fb)
export function normalizeAc(row) {
  const o = { ...DEFAULT_AC, installPrices: { ...DEFAULT_AC.installPrices } }
  o.waNumber = String(row?.waNumber || DEFAULT_AC.waNumber).replace(/\D/g, '') || DEFAULT_AC.waNumber
  for (const k of Object.keys(DEFAULT_AC)) if (k !== 'installPrices' && k !== 'waNumber') o[k] = Math.max(0, n(row?.[k], DEFAULT_AC[k]))
  for (const k of Object.keys(DEFAULT_AC.installPrices)) o.installPrices[k] = Math.max(0, n(row?.installPrices?.[k], 0))
  return o
}
const NO_DEPTH = ['شباك', 'داكت', 'مركزي', 'باكيدج', 'دولابي']
export const hasDepth = (mode, type) => mode === 'wash' && !NO_DEPTH.includes(type)

// Returns { total, base, warrantyAdd, vat, label, offer, onInspection, listPrice }
export function acQuote(cfgRaw, { mode = 'wash', type = 'سبليت', qty = 1, full = true, warranty = 'بدون', vat = false, offers = [] } = {}) {
  const c = normalizeAc(cfgRaw)
  qty = Math.max(1, Math.min(50, Math.floor(qty) || 1))
  let base = 0
  let offer = null
  let onInspection = false
  if (mode === 'wash') {
    offer = (offers || []).find((o) => o.active !== false && full !== false && o.acMode === 'wash' && Number(o.qty) === qty && (o.acType || 'سبليت') === type) || null
    if (offer) base = Number(offer.price) || 0
    else if (type === 'سبليت') {
      const off = full ? [0, 0, 0] : [c.innerOff1, c.innerOff2, c.innerOff3]
      const p1 = c.split1 - off[0], p2 = c.split2 - off[1], p3 = c.split3 - off[2]
      base = qty === 1 ? p1 : qty === 2 ? p2 : qty === 3 ? p3 : p3 + (qty - 3) * (p3 / 3)
    } else if (type === 'شباك') {
      base = qty === 1 ? c.win1 : qty === 2 ? c.win2 : qty === 3 ? c.win3 : c.win3 + (qty - 3) * c.winExtra
    } else base = qty * c.other1
  } else if (mode === 'install') {
    const u = c.installPrices[type] || 0
    base = u * qty
    onInspection = !u
  } else {
    onInspection = true // maintenance: priced after inspection; visit fee only if declined
  }
  const wAdd = mode === 'wash' ? qty * (({ شهر: c.w1, شهرين: c.w2, '3 شهور': c.w3 })[warranty] || 0) : 0
  let total = base + wAdd
  const vatAmt = vat ? total * (c.vatPct / 100) : 0
  total = Math.round(total + vatAmt)
  return { mode, type, qty, base: Math.round(base), warrantyAdd: wAdd, vat: Math.round(vatAmt), total, offer, onInspection, visitFee: c.visitFee, listPrice: Math.round(base + wAdd) }
}
// Lowest total negotiation may reach
export function acFloor(cfg, q) {
  const c = normalizeAc(cfg)
  if (q.onInspection) return 0
  return Math.round(q.total * (1 - c.maxDiscountPct / 100))
}

// Mixed orders: items = [{ type, qty, full? }] priced one by one (each line follows the normal table/offer rules).
export function acMultiQuote(cfg, items, { warranty = 'بدون', vat = false, offers = [] } = {}) {
  const lines = items.map((it) => acQuote(cfg, { mode: 'wash', type: it.type, qty: it.qty, full: it.full !== false, warranty, vat: false, offers }))
  const sub = lines.reduce((n, l) => n + l.total, 0)
  const vatAmt = vat ? Math.round(sub * (normalizeAc(cfg).vatPct / 100)) : 0
  return { lines, total: sub + vatAmt, base: sub, vat: vatAmt }
}

// One entry point for a stored draft.acq (single line or mixed items): used by the chat, the order payload and tests.
export function acQuoteFromAcq(cfg, acq, offers = []) {
  if (!acq) return null
  if (Array.isArray(acq.items) && acq.items.length) {
    const m = acMultiQuote(cfg, acq.items, { warranty: acq.warranty, vat: acq.vat, offers })
    const c = normalizeAc(cfg)
    const per = { شهر: c.w1, شهرين: c.w2, '3 شهور': c.w3 }[acq.warranty] || 0
    const units = acq.items.reduce((n, it) => n + (Number(it.qty) || 1), 0)
    const wAdd = units * per
    const sub = m.base + wAdd
    const vatAmt = acq.vat ? Math.round(sub * (c.vatPct / 100)) : 0
    return { total: Math.round(sub + vatAmt), lines: m.lines, warrantyAdd: wAdd, vat: vatAmt, offer: null, onInspection: false }
  }
  return acQuote(cfg, { ...acq, offers })
}
