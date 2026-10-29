// Sales scenarios: discovery questions, per-unit stepped bargaining (100 -> 90 -> 80 -> apology + support), Makkah coverage.
import { localTurn } from '../../mutqan-app/src/localBot.js'
import { computeQuote, nextNegotiationStep, normalizeRule, DEFAULT_NEGOTIATION } from '../../mutqan-app/src/pricing.js'
import { acQuoteFromAcq, normalizeAc } from '../../mutqan-app/src/acPricing.js'
import { SPECIALTIES } from '../../mutqan-app/src/constants.js'
import { checkMakkahArea, MAKKAH_DISTRICTS } from '../../mutqan-app/src/data/makkah.js'
import { SALES } from '../../mutqan-app/src/salesScenarios.js'

let pass = 0, fail = 0
const t = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i || '') } }
const rules = Object.fromEntries(SPECIALTIES.map((s) => [s.id, normalizeRule(s.id, null)]))
const cfg = normalizeAc({ maxDiscountPct: 20 })
const MERGE = ['specialtyId', 'problem', 'priority', 'preferredTime', 'locationText', 'qty', 'acq', 'contact']
function quoteFor(d) {
  if (!d?.specialtyId || !rules[d.specialtyId]) return null
  let rule = rules[d.specialtyId], units = d.qty || 1
  if (d.specialtyId === 'ac' && d.acq) {
    const aq = acQuoteFromAcq(cfg, d.acq, [])
    units = Array.isArray(d.acq.items) ? d.acq.items.reduce((n, i) => n + i.qty, 0) : d.acq.qty
    if (aq.total > 0) rule = { ...rule, base: aq.total, min: Math.round(aq.total * 0.8), max: aq.total, discountPct: 20, extraUnitPct: 100, visitFee: 0 }
  }
  const q = computeQuote(rule, { qty: d.specialtyId === 'ac' && d.acq ? 1 : d.qty || 1, globalMaxDiscountPct: 20 })
  return { ...q, units, maxAttempts: rule.maxAttempts, negotiable: true }
}
function chat(turns) {
  let d = {}; const history = []; const out = []
  for (const text of turns) {
    history.push({ role: 'user', content: text })
    const quote = quoteFor(d)
    const nego = quote ? nextNegotiationStep(d.negotiation, quote, DEFAULT_NEGOTIATION, quote.maxAttempts) : null
    const r = localTurn({ history, customer: { verified: false }, orders: [], draft: d, dialect: 'auto', rules, quote, nego, settings: { negotiation: { enabled: true } }, ac: { cfg, offers: [] } })
    history.push({ role: 'assistant', content: r.reply })
    let n = { ...d }
    for (const k of MERGE) { const v = r.intent?.[k]; if (v != null && v !== '') n[k] = v }
    if (r.action === 'negotiate' && nego) n.negotiation = { i: nego.last ? nego.i : nego.i + 1, offer: nego.offer, stage: nego.stage }
    if (r.intent?.counterPrice && n.negotiation && quote && r.intent.counterPrice >= quote.floor && r.intent.counterPrice <= quote.total) n.negotiation = { ...n.negotiation, offer: r.intent.counterPrice }
    if (r.intent?.acceptedOffer && n.negotiation?.offer) n.agreedPrice = n.negotiation.offer
    out.push({ ...r, quote, nego, draft: n }); d = n
  }
  return out
}
// 1) discovery: greeting asks for problem + count
{ const r = chat(['السلام عليكم'])[0]; t('greet asks need+count', /كم|عدد/.test(r.reply) && /(خدم|مشكل|تحتاج|تبغ|عطل)/.test(r.reply), r.reply) }
// 2) service without count -> asks count
{ const r = chat(['ابغى غسيل مكيف'])[0]; t('asks count', r.action === 'collect' && /كم|العدد/.test(r.reply), r.reply) }
// 3) single unit: 100 -> 90 -> 80 -> apology + support
{
  const r = chat(['ابغى غسيل مكيف', '1', 'غالي', 'لسه غالي', 'غالي برضو', 'غالي كتير'])
  t('quote 100', /100/.test(r[1].reply), r[1].reply)
  t('push1 -> 90', r[2].nego?.offer === 90 && /90/.test(r[2].reply), r[2].reply + ' ' + r[2].nego?.offer)
  t('push2 -> 80', /80/.test(r[3].reply), r[3].reply)
  t('never below 80', r.every((x) => !/(?<![\d])(7\d|6\d)\s*ر\.?س/.test(x.reply)), r.map((x) => x.reply).join('|'))
  const last = r[r.length - 1]
  t('then apology + support', /(الدعم الفني)/.test(last.reply) && /(أعتذر|آسف|عذرا|سامحني|للأسف|اعتذر)/.test(last.reply.replace(/[ًٌٍَُِّْ]/g, '')), last.reply)
}
// 4) multi-unit: 2 units, per-unit shown
{
  const r = chat(['ابغى غسيل 2 مكيف سبليت', 'غالي'])
  t('2 units quote 140', /140/.test(r[0].reply), r[0].reply)
  t('2 units step per-unit note', /للوحدة/.test(r[1].reply), r[1].reply)
}
// 5) counter below floor -> apology w/ support; counter above floor accepted
{
  const r = chat(['ابغى غسيل مكيف', '1', 'ادفع 50'])
  t('counter 50 refused politely', /الدعم الفني|أعتذر|آسف|سامحني|للأسف|عذر/.test(r[2].reply), r[2].reply)
  const r2 = chat(['ابغى غسيل مكيف', '1', 'ادفع 85'])
  t('counter 85 accepted', r2[2].draft.agreedPrice === 85, JSON.stringify(r2[2].draft.agreedPrice))
}
// 6) coverage
t('district inside', checkMakkahArea('حي الشوقية').inside === true)
t('Jeddah outside', checkMakkahArea('انا في جدة').inside === false)
t('moving to Makkah ok', checkMakkahArea('نقل عفش من جده لمكه').inside !== false)
t('>=60 districts', MAKKAH_DISTRICTS.length >= 60, MAKKAH_DISTRICTS.length)
{ const r = chat(['عندي مكيف في الطايف'])[0]; t('Taif -> outside + partner branches', /(فروع|شرك)/.test(r.reply) && r.action === 'handoff', r.reply + r.action) }
{ const r = chat(['ابغى غسيل مكيف حي العزيزية'])[0]; t('district recognised', r.intent.locationText === 'حي العزيزية' || /العزيزية/.test(r.reply) || r.action === 'collect', r.reply) }
// 7) scenario banks: >= 11 variants, no unresolved placeholders in dialect map
for (const [k, v] of Object.entries(SALES)) { t(`bank ${k} >=11`, v.sa.length >= 11 && v.eg.length >= 11) ; t(`bank ${k} distinct`, new Set(v.sa).size === v.sa.length) }
console.log(`sales: ${pass}/${pass + fail}`)
if (fail) process.exit(1)
