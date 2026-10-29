// Conversation simulator: drives localTurn the same way AiChat does (quote, negotiation ladder, draft merge).
import { localTurn } from '../../mutqan-app/src/localBot.js'
import { computeQuote, nextNegotiationStep, normalizeRule, DEFAULT_NEGOTIATION } from '../../mutqan-app/src/pricing.js'
import { acQuote, acQuoteFromAcq, normalizeAc } from '../../mutqan-app/src/acPricing.js'
import { SPECIALTIES } from '../../mutqan-app/src/constants.js'

export const rules = Object.fromEntries(SPECIALTIES.map((s) => [s.id, normalizeRule(s.id, null)]))
export const acCfg = normalizeAc({})
export const acOffers = [
  { acMode: 'wash', acType: 'سبليت', qty: 3, price: 200, title: 'غسيل 3 سبليت', badge: '🔥 الأكثر طلباً', active: true },
  { acMode: 'wash', acType: 'سبليت', qty: 6, price: 380, title: 'غسيل 6 سبليت', active: true },
]
const MERGE = ['specialtyId', 'problem', 'priority', 'preferredTime', 'locationText', 'qty', 'acq', 'contact']

export function quoteFor(d) {
  if (!d?.specialtyId || !rules[d.specialtyId]) return null
  let rule = rules[d.specialtyId]
  if (d.specialtyId === 'ac' && d.acq) {
    const aq = acQuoteFromAcq(acCfg, d.acq, acOffers)
    if (aq.total > 0) rule = { ...rule, base: aq.total, min: Math.round(aq.total * (1 - acCfg.maxDiscountPct / 100)), max: aq.total, discountPct: acCfg.maxDiscountPct, extraUnitPct: 100, visitFee: 0 }
  }
  const q = computeQuote(rule, { qty: d.specialtyId === 'ac' && d.acq ? 1 : d.qty || 1, urgent: d.priority === 'urgent', globalMaxDiscountPct: 20 })
  return { ...q, maxAttempts: rule.maxAttempts, negotiable: rule.aiNegotiation !== false, agreed: d.agreedPrice }
}

export function converse(turns, { dialect = 'auto', customer = { verified: false }, orders = [], draft = {} } = {}) {
  let d = { ...draft }
  const history = []
  const results = []
  for (const turn of turns) {
    if (typeof turn === 'object' && turn.loc) { d = { ...d, coords: { lat: 21.4, lng: 39.8, address: 'مكة' } }; continue }
    history.push({ role: 'user', content: turn })
    const quote = quoteFor(d)
    const nego = quote?.negotiable ? nextNegotiationStep(d.negotiation, quote, DEFAULT_NEGOTIATION, quote.maxAttempts) : null
    const res = localTurn({ history, customer, orders, draft: d, dialect, rules, quote, nego, settings: { negotiation: { enabled: true } }, ac: { cfg: acCfg, offers: acOffers } })
    history.push({ role: 'assistant', content: res.reply })
    let next = { ...d }
    for (const k of MERGE) { const v = res.intent?.[k]; if (v !== null && v !== undefined && v !== '' && v !== 'null') next[k] = v }
    if (res.action === 'negotiate' && nego) next.negotiation = { i: nego.last ? nego.i : nego.i + 1, offer: nego.offer, stage: nego.stage }
    if (res.intent?.counterPrice && next.negotiation && quote && res.intent.counterPrice >= quote.floor && res.intent.counterPrice <= quote.total) next.negotiation = { ...next.negotiation, offer: res.intent.counterPrice }
    if (res.intent?.acceptedOffer && next.negotiation?.offer) next.agreedPrice = next.negotiation.offer
    results.push({ ...res, quote, nego, draft: next, said: turn })
    d = next
  }
  return { results, last: results[results.length - 1], draft: d }
}
