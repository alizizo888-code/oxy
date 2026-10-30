// ZATCA Phase-1 simplified tax invoice QR (TLV, Base64): seller name, VAT number, ISO timestamp, total incl. VAT, VAT amount.
// This is the printed/QR requirement only. Phase-2 (Fatoora e-invoicing: signed XML + clearance/reporting) needs ZATCA onboarding and is NOT done here.
const enc = new TextEncoder()
const tlv = (tag, val) => { const v = enc.encode(String(val)); return [tag, v.length, ...v] }
export function zatcaQrBase64({ seller, vat, at, total, vatAmount }) {
  const bytes = new Uint8Array([...tlv(1, seller), ...tlv(2, vat), ...tlv(3, at), ...tlv(4, Number(total).toFixed(2)), ...tlv(5, Number(vatAmount).toFixed(2))])
  let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin)
}
export const VAT_RATE = 0.15
export function totals(items, inclusive) {
  const sum = items.reduce((s, i) => s + (Number(i.price) || 0), 0)
  const total = inclusive ? sum : sum * (1 + VAT_RATE)
  const net = inclusive ? sum / (1 + VAT_RATE) : sum
  const r = (n) => Math.round(n * 100) / 100
  return { net: r(net), vat: r(total - net), total: r(total) }
}
export const validVat = (v) => /^3\d{13}3$/.test(String(v || '').replace(/\s/g, ''))
