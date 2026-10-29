// Local assistant v2 — no model, no tokens, no network. Understands Saudi / Gulf / Egyptian / MSA wording,
// tolerates typos and voice-transcript noise, negotiates through the owner's ladder, and collects every order field.
// Prices ALWAYS come from the owner's tables (AC table, pricing rules, negotiation ladder) — never invented.
import { SPECIALTIES, STATUS_META } from './constants'
import { computeQuote } from './pricing'
import { acQuote, acQuoteFromAcq } from './acPricing'
import { INTENTS, SPEC_WORDS, R, norm, detectDialect, dialectFromPref } from './botData'
import { KB } from './kbData'
import { SALES } from './salesScenarios'
import { checkMakkahArea } from './data/makkah'

export { detectDialect }

// ── precompute ───────────────────────────────────────────────────────────────
const NI = Object.fromEntries(Object.entries(INTENTS).map(([k, a]) => [k, [...new Set(a.map(norm))].filter(Boolean)]))
const cd = (x) => x.replace(/(.)\1/g, '$1')
const NS = SPEC_WORDS.map(([id, a]) => [id, [...new Set(a.map((w) => cd(norm(w))))].filter(Boolean)])
const PRIORITY = ['human', 'frustrated', 'complaint', 'cancel_order', 'track', 'warranty', 'join_tech', 'reschedule', 'competitor', 'budget', 'expensive', 'discount_ask', 'hesitate', 'urgent', 'price_ask', 'offers_ask', 'includes_ask', 'payment_ask', 'time_ask_when', 'area_ask', 'location_ask', 'parts', 'rating', 'howitworks', 'whoareyou', 'accept', 'reject', 'repeat', 'thanks', 'bye', 'greet', 'smalltalk', 'offtopic', 'edit_time', 'edit_qty', 'ask_total_with_warranty', 'ask_vat', 'levant_gulf_price']

const lev1 = (a, b) => {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, d = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++d > 1) return false
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++ }
  }
  return d + (a.length - i) + (b.length - j) <= 1
}
const tokHas = (toks, w) => toks.some((t) => t === w || (w.length >= 6 && t.length >= 6 && lev1(t, w)))

const SHORT_ONLY = new Set(['accept', 'reject', 'greet', 'smalltalk', 'bye', 'thanks'])
function scoreIntent(intentId, t, toks, phrases) {
  let best = 0
  const padded = ` ${t} `
  for (const p of phrases) {
    const pt = p.split(' ')
    if (SHORT_ONLY.has(intentId) && pt.length === 1 && p.length <= 4 && toks.length > 2) continue   // 'لا' / 'تمام' only count in very short messages
    let s = 0
    if (padded.includes(` ${p} `)) s = 1 + Math.min(p.length, 30) / 60 + (t === p ? 0.5 : 0)
    else if (pt.length >= 2 && pt.every((w) => tokHas(toks, w))) s = 0.85
    else if (pt.length === 1 && p.length >= 5 && toks.some((x) => x.length > p.length && x.length - p.length <= 3 && x.endsWith(p))) s = 0.8   // attached prefix: بالمباراه / للمكيف
    else if (pt.length === 1 && p.length >= 6 && tokHas(toks, p)) s = 0.78
    if (s > best) best = s
  }
  return best
}

function detectSpec(t0, toks0) {
  const t = cd(t0), toks = toks0.map(cd)
  let best = null
  for (const [id, words] of NS) {
    for (const w of words) {
      const hit = w.length <= 3 ? toks.includes(w) : (t.includes(w) || (!w.includes(' ') && tokHas(toks, w)))
      if (hit) {
        const sc = w.length + (id === 'general' ? -8 : id === 'corporate' ? -6 : 0)       // generic words are weak
        if (!best || sc > best.sc) best = { id, sc }
      }
    }
  }
  return best?.id || null
}

const QTY_WORDS = { واحد: 1, وحده: 1, اتنين: 2, اثنين: 2, ثنتين: 2, مكيفين: 2, مكيفان: 2, تلات: 3, ثلاث: 3, تلاته: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, ست: 6, سته: 6, سبع: 7, سبعه: 7, تمان: 8, ثمان: 8, ثمانيه: 8, تمانيه: 8, تسع: 9, تسعه: 9, عشر: 10, عشره: 10 }
function detectQty(t, toks) {
  const m = t.match(/(?:^|\s)(\d{1,2})\s*(?:مكيف|مكيفات|وحد|وحدات|جهاز|اجهزه|سبليت|قطع|كاميرا|كاميرات|باب|ابواب|غرف|غرفه|مكان|اماكن)/)
  if (m) return Number(m[1])
  for (const w of toks) if (QTY_WORDS[w]) return QTY_WORDS[w]
  const n = t.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)
  if (n && Number(n[1]) >= 1 && Number(n[1]) <= 20 && !/ريال|ر\.?س|جنيه|دينار|sar/.test(t)) return Number(n[1])
  return null
}
function detectMoney(t) {
  const m = t.match(/(?:^|\s)(\d{2,5})(?:\s*(?:ريال|ر\.?س|جنيه|دينار|sar|ريالا))?(?:\s|$)/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 30 ? n : null
}
const detectAcType = (t) => /شباك/.test(t) ? 'شباك' : /باكيج|باكيدج/.test(t) ? 'باكيدج' : /كونسيلد|مخفي/.test(t) ? 'كونسيلد' : /داكت|دكت/.test(t) ? 'داكت' : /مركزي/.test(t) ? 'مركزي' : /دولابي|ستاند|عمودي/.test(t) ? 'دولابي' : /سبليت|سبلت|اسبليت|جداري/.test(t) ? 'سبليت' : null
const detectAcMode = (t) => /ركب|تركيب|فك|نقل|تاسيس|مواسير/.test(t) ? 'install'
  : /صيانه|عطل|خربان|بيبرد|يبرد|فحص|تسريب فريون|صوت|يقطر|ثلج|تجمد|ريحه|يفصل|يطفي|يسرب/.test(t) ? 'maintenance' : 'wash'
const TIME_RE = /اليوم|النهارده|بكره|بكرا|غدا|بعد بكره|بعد غد|صباح|الصبح|صبح|ظهر|الضهر|عصر|العصر|مغرب|المغرب|عشاء|مساء|المسا|ليل|الليل|الساعه|ساعه|(?:^|\s)\d{1,2}(?::\d\d)?\s*(?:ص|م|صباحا|مساء|الظهر|العصر|المغرب)(?=\s|$)|اي وقت|أي وقت|اقرب وقت|اي يوم|السبت|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|الحين|الان|فورا|دلوقتي|حالا/
function timePhrase(t, raw) {
  const day = /(?:^|\s)[لبو]?(بعد بكره|بعد غد|بكره|بكرا|غدا|اليوم|النهارده|السبت|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه)(?=\s|$)/.exec(t)
  const part = /(?:^|\s)[لبو]?(الصبح|صباحا|صباح|صبح|الظهر|الضهر|ظهرا|ظهر|العصر|عصرا|عصر|المغرب|مغرب|المسا|مساء|العشاء|عشاء|الليل|ليل)(?=\s|$)/.exec(t)
  const clock = /(?:^|\s)(\d{1,2}(?::\d\d)?)\s*(ص|م|صباحا|مساء)?(?=\s|$)/.exec(t.replace(/(\d)(ص|م)(?=\s|$)/g, '$1 $2'))
  const DAY = { 'بعد بكره': 'بعد بكرة', 'بعد غد': 'بعد غد', بكره: 'بكرة', بكرا: 'بكرة', غدا: 'غداً', اليوم: 'اليوم', النهارده: 'اليوم' }
  const PART = { الصبح: 'صباحاً', صباحا: 'صباحاً', صباح: 'صباحاً', صبح: 'صباحاً', الظهر: 'ظهراً', الضهر: 'ظهراً', ظهرا: 'ظهراً', ظهر: 'ظهراً', العصر: 'عصراً', عصرا: 'عصراً', عصر: 'عصراً', المغرب: 'مغرباً', مغرب: 'مغرباً', المسا: 'مساءً', مساء: 'مساءً', العشاء: 'مساءً', عشاء: 'مساءً', الليل: 'ليلاً', ليل: 'ليلاً' }
  const bits = []
  if (day) bits.push(DAY[day[1]] || day[1])
  if (part) bits.push(PART[part[1]])
  if (clock && Number(clock[1].split(':')[0]) <= 12 && (clock[2] || part || day)) bits.push(`الساعة ${clock[1]}${clock[2] ? ' ' + (/^ص/.test(clock[2]) ? 'ص' : 'م') : ''}`)
  if (!bits.length && /اي وقت|اقرب وقت|اي يوم/.test(t)) return 'أي وقت'
  if (!bits.length && /(?:^|\s)(الحين|الان|فورا|دلوقتي|حالا)(?=\s|$)/.test(t)) return 'عاجل — الآن'
  return bits.length ? bits.join(' ') : String(raw).slice(0, 60)
}
const SPEC_NAME_BLOCK = /^(ابغي|ابي|ابغا|عايز|عاوز|محتاج|عندي|اريد|بحاجه|مستعجل|في|كل)/
const money = (n) => `${Math.round(n)} ر.س`
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) }

// ── knowledge repository (practical Q&A) ────────────────────────────────────
const KB_SPEC = { ac: 'ac', plumb: 'plumbing', elec: 'electric', fridge: 'fridge', washer: 'appliances', dish: 'appliances', sat: 'satellite', lock: 'locks', smartlock: 'locks', cam: 'cameras', pest: 'pest', tank: 'tanks', clean: 'cleaning', paint: 'paint', tile: 'tiling', moving: 'moving', solar: 'solar', corp: 'corporate' }
const kbSpecOf = (id) => KB_SPEC[id.split('_')[0]] || null
const KB_N = KB.map((e) => ({ e, ph: e.k.map((p) => { const n = norm(p); return { n, tk: n.split(' ') } }) }))
export function kbMatch(t, toks) {
  const tset = new Set(toks)
  const padded = ` ${t} `
  let best = null
  for (const { e, ph } of KB_N) {
    for (const { n, tk } of ph) {
      let sc = 0
      if (tk.length === 1) { if (toks.length <= 3 && tset.has(n)) sc = 5 }
      else if (padded.includes(` ${n} `) || (t.length > 6 && t.includes(n) && tk.length >= 2)) sc = 10 + n.length
      else if (tk.length >= 3) { const hit = tk.filter((w) => tset.has(w) || (w.length > 3 && toks.some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x))))).length; if (hit / tk.length >= 0.85) sc = 6 + hit }
      if (sc && (!best || sc > best.sc)) best = { e, sc }
    }
  }
  return best && best.sc >= 8 ? best.e : null
}

// ── main ─────────────────────────────────────────────────────────────────────
export function localTurn(ctx) {
  const { history = [], customer, orders = [], draft = {}, rules = {}, quote, nego, settings } = ctx
  const ac = ctx.ac || {}
  const userMsgs = history.filter((m) => m.role === 'user').map((m) => m.content)
  const raw = userMsgs[userMsgs.length - 1] || ''
  const t = norm(raw)
  const toks = t.split(' ').filter(Boolean)
  const D = dialectFromPref(ctx.dialect) || detectDialect(...userMsgs.slice(-3).reverse()) || 'sa'
  const first = customer?.verified && customer?.name ? customer.name.split(' ')[0] : ''
  const nm = first ? ` ${first}` : ''
  const pickv = (arr, seed) => arr[hash(seed + userMsgs.length) % arr.length]
  const fmt = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? nm : v[k] ?? ''))
  const rep = (key, v) => fmt(pickv(((SALES[key] || R[key]) || R.unknown)[D], key + t), v)
  const SG = {
    sa: { book: ['احجز الحين', 'فيه خصم؟', 'بكرة العصر'], time: ['اليوم عصر', 'بكرة صباح', 'أي وقت'], loc: ['تحديد موقعي'], ready: ['تأكيد الطلب'], start: ['غسيل مكيفات', 'تسريب مياه', 'كهرباء', 'وين طلبي؟'], neg: ['موافق', 'آخر سعر؟', 'أبغى موظف'], none: ['الأسعار', 'العروض', 'أبغى موظف'] },
    eg: { book: ['احجزلي دلوقتي', 'فيه خصم؟', 'بكره العصر'], time: ['النهارده العصر', 'بكره الصبح', 'أي وقت'], loc: ['تحديد موقعي'], ready: ['تأكيد الطلب'], start: ['غسيل مكيفات', 'تسريب مياه', 'كهربا', 'فين طلبي؟'], neg: ['موافق', 'آخر سعر؟', 'عايز موظف'], none: ['الأسعار', 'العروض', 'عايز موظف'] },
  }
  const out = (reply, extra = {}) => {
    const kind = extra.action === 'ready_to_order' ? 'ready' : extra.action === 'location' ? 'loc' : extra.action === 'negotiate' ? 'neg' : extra.action === 'collect' && !draft.preferredTime ? 'time' : extra.action === 'calculator' ? (draft.preferredTime || extra.intent?.preferredTime ? 'loc' : 'book') : extra.action === 'handoff' || extra.action === 'warranty' || extra.action === 'track' ? null : (!draft.specialtyId && !extra.intent?.specialtyId ? 'start' : 'none')
    return { confidence: 0.85, sources: [], intent: {}, escalation: null, action: 'none', understood: true, reply, dialect: D, suggestions: kind ? SG[D][kind] : [], ...extra }
  }
  if (!t) return out(rep('greet') + (draft.specialtyId ? '' : ' ' + rep('ask_need')), { confidence: 0.5 })
  const perNote = (p) => (quote?.units > 1 ? ` (${Math.round(p / quote.units)} ر.س للوحدة)` : '')
  const areaInfo = checkMakkahArea(raw, settings?.extraDistricts || [])

  // ── slots ──
  const spec = detectSpec(t, toks)
  const qty = detectQty(t, toks)
  const cash = detectMoney(t)
  const timeHit = TIME_RE.test(t)
  const urgentHit = toks.some((w) => /^(عاجل|مستعجل|طارئ|طوارئ|ضروري|فورا|بسرعه|باسرع|حالا|الحين|دلوقتي|دلوقت|الان|الليله)$/.test(w))
  const scores = {}
  for (const k of Object.keys(NI)) scores[k] = scoreIntent(k, t, toks, NI[k])
  const ranked = PRIORITY.filter((k) => scores[k] >= 0.78).sort((a, b) => scores[b] - scores[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b))
  const top = ranked[0] || null
  const is = (k) => scores[k] >= 0.78
  const strong = (k) => scores[k] >= 1

  if (scores.levant_gulf_price >= 0.78) scores.price_ask = Math.max(scores.price_ask, 1.2)
  const digits = t.replace(/\s+/g, '')
  const phoneM = digits.match(/(?:\+?966|00966|0)?(5\d{8})|(01[0-25]\d{8})/)
  const nameM = t.match(/(?:اسمي|انا اسمي|معك|معاك|انا)\s+([\u0600-\u06FF]{2,12})(?:\s|$)/)
  const areaM = t.match(/(?:^|\s)(?:في |ب)?حي\s+([\u0600-\u06FF]{2,14}(?:\s[\u0600-\u06FF]{2,10})?)/)
  const contact = phoneM || (nameM && !SPEC_NAME_BLOCK.test(nameM[1])) ? { name: nameM && !SPEC_NAME_BLOCK.test(nameM[1]) ? nameM[1] : undefined, phone: phoneM ? (phoneM[1] ? '0' + phoneM[1] : phoneM[2]) : undefined } : null
  // stem rules (cover endless inflections without listing them)
  if (toks.length <= 5 && toks.some((w) => /^(ا?شكر|مشكور|ممنون|متشكر)/.test(w)) && !spec) scores.thanks = Math.max(scores.thanks, 1.2)
  const relapse = /(رجع|رجعت|عاد|رجعوا)/.test(t) && /(عطل|يعطل|خرب|مشكل|يقطر|يبرد|يفصل|صوت)/.test(t)
  if (relapse) scores.warranty = Math.max(scores.warranty, 1.2)

  // ── hard routes ──
  if (is('frustrated')) return out(rep('frustrated'), { action: 'handoff', escalation: 'complaint' })
  if (is('human') && (strong('human') || !spec)) return out(rep('human'), { action: 'handoff', escalation: 'customer_request' })
  if (is('complaint') && !is('warranty')) return out(rep('complaint'), { action: 'handoff', escalation: 'complaint' })
  if (is('cancel_order') || (is('reject') && /الغ|كنسل|cancel/.test(t) && orders.length)) return out(rep('cancel'), { action: 'handoff', escalation: 'customer_request' })
  if (is('track') && !spec || (is('track') && /طلب|فني/.test(t))) {
    const o = orders.find((x) => x.status !== 'completed' && x.status !== 'cancelled') || orders[0]
    if (!o) return out(rep('track_none'), { sources: ['orders'] })
    const st = STATUS_META?.[o.status]?.label || o.status
    return out(rep('track', { st, tech: o.technicianName ? `الفني: ${o.technicianName}.` : (D === 'eg' ? 'لسه محدش اتعين، فريق العمليات بيتابعه.' : 'لسا ما تعيّن فني، فريق العمليات يتابعه.') }), { action: 'track', sources: ['orders', 'tracking'] })
  }
  const warrantyPriceCtx = /ضمان/.test(t) && /(شهرين|3 شهور|ثلاث شهور|شهر\b|vip)/.test(t) && (spec || draft.acq)
  if (is('warranty') && !is('price_ask') && !warrantyPriceCtx) return out(rep('warranty'), { action: 'warranty', sources: ['warranty'] })
  if (is('join_tech')) return out(rep('join_tech'), { action: 'join_tech' })
  if ((is('edit_time') || is('reschedule')) && draft.specialtyId && draft.preferredTime && timeHit) {
    const intent = { preferredTime: timePhrase(t, raw) }
    return out(rep('time_changed', { t: timePhrase(t, raw) }) + ' ' + (!draft.coords ? rep('location_prompt') : rep('ready')), { intent, action: !draft.coords ? 'location' : 'ready_to_order' })
  }
  if (is('reschedule') && orders.length) return out(rep('reschedule'), { action: 'handoff', escalation: 'customer_request' })

  // ── coverage: outside Makkah → partner branches via technical support ──
  if (areaInfo && areaInfo.inside === false && !(spec === 'moving' && /(?:^|\s)من\s/.test(t))) return out(rep('out_cov', { c: areaInfo.city }), { action: is('area_ask') || /هل|ممكن|تخدم/.test(t) ? 'none' : 'handoff', escalation: is('area_ask') || /هل|ممكن|تخدم/.test(t) ? null : 'customer_request', sources: ['knowledge'] })

  // ── negotiation ──
  const payNum = cash && /ادفع|هدفع|اديك|هديك|اعطيك|بدفع|ادفعلك/.test(t)
  const negWords = is('expensive') || is('discount_ask') || is('competitor') || is('budget') || payNum || (cash && draft.negotiation)
  const negotiating = negWords && !(spec && !quote) && (!is('price_ask') || !!quote || !!draft.specialtyId)
  if (negotiating) {
    if (!quote && !draft.specialtyId && !spec) return out(rep('need_service'), { action: 'collect' })
    if (settings?.negotiation?.enabled === false || !nego || quote?.negotiable === false) {
      return out(rep('expensive_nopolicy'), { sources: ['pricing'] })
    }
    const p = Math.round(nego.offer)
    const stepped = nego.stepped || (quote?.units != null && ['discount', 'floor', 'handoff'].includes(nego.stage))
    if (stepped && !(cash && quote && cash >= quote.total)) {
      const atFloor = nego.stage === 'handoff' || (quote.floor != null && p <= quote.floor)
      if (cash && quote && cash < quote.floor) return out(rep('neg_counter_sorry', { p: Math.round(quote.floor), per: perNote(quote.floor), k: cash }), { action: 'negotiate', sources: ['pricing'], escalation: nego.handoff ? 'negotiation' : null })
      if (cash && quote && cash >= Math.max(quote.floor, 0) && cash < quote.total) return out(rep('neg_accept_counter', { p: cash }), { action: 'negotiate', intent: { acceptedOffer: true, counterPrice: cash }, sources: ['pricing'] })
      if (nego.stage === 'handoff') return out(rep('neg_sorry', { p: Math.round(quote.floor), per: perNote(quote.floor) }), { action: 'negotiate', sources: ['pricing'], escalation: 'negotiation' })
      return out(rep(nego.stage === 'floor' || atFloor ? 'neg_floor_s' : 'neg_step', { p, per: perNote(p) }), { action: 'negotiate', sources: ['pricing'] })
    }
    const stageKey = { base: 'neg_base', value: 'neg_value', alternative: 'neg_alt', discount: 'neg_discount', floor: 'neg_floor', handoff: 'neg_handoff' }[nego.stage] || 'neg_value'
    // customer names a price
    if (cash && quote && (is('budget') || is('discount_ask') || payNum || draft.negotiation)) {
      if (cash >= quote.total) return out(rep('neg_accept_counter', { p: Math.round(quote.total) }), { action: 'negotiate', intent: { acceptedOffer: true }, sources: ['pricing'] })
      if (cash >= p) return out(rep('neg_accept_counter', { p: cash }), { action: 'negotiate', intent: { acceptedOffer: true, counterPrice: cash }, sources: ['pricing'] })
      if (quote.floor != null && cash >= quote.floor) return out(rep('neg_accept_counter', { p: cash }), { action: 'negotiate', intent: { acceptedOffer: true, counterPrice: cash }, sources: ['pricing'] })
      return out(rep('neg_counter_low', { p, c: cash }), { action: 'negotiate', sources: ['pricing'], escalation: nego.handoff ? 'negotiation' : null })
    }
    if (is('competitor')) {
      const offer = nego.stage === 'base' || nego.stage === 'value' ? (D === 'eg' ? 'والسعر عندنا ' : 'والسعر عندنا ') + money(p) + '.' : (D === 'eg' ? 'وهقدر أديك ' : 'وأقدر أعطيك ') + money(p) + (D === 'eg' ? ' لو أكدنا دلوقتي.' : ' لو أكدنا الحين.')
      return out(rep('competitor', { offer }), { action: 'negotiate', sources: ['pricing'], escalation: nego.handoff ? 'negotiation' : null })
    }
    return out(rep(stageKey, { p }), { action: 'negotiate', sources: ['pricing'], escalation: nego.handoff ? 'negotiation' : null })
  }

  if (is('hesitate') && (draft.specialtyId || quote)) return out(rep('hesitate'), { sources: ['pricing'] })

  // ── accept (only when something is on the table) ──
  if (top === 'accept' && !is('price_ask') && !spec && !timeHit && !qty && !detectAcType(t)) {
    if (draft.negotiation?.offer || quote || draft.specialtyId) {
      const intent = draft.negotiation?.offer ? { acceptedOffer: true } : {}
      if (!draft.preferredTime && !urgentHit) return out(rep('time_prompt'), { intent, action: 'collect', sources: ['pricing'] })
      if (!draft.coords) return out(rep('location_prompt'), { intent, action: 'location', sources: ['pricing'] })
      return out(rep('ready'), { intent, action: 'ready_to_order', sources: ['pricing'] })
    }
  }
  if (top === 'reject' && !spec) return out(rep('reject'), { action: 'none' })

  // ── knowledge repository: practical answers (first aid, how-tos, policies) ──
  {
    const hit = !(is('price_ask') && /كم|بكم|بكام|سعر|تكلف/.test(t)) && !/(?:^|\s)(عرض|عروض|العروض|خصم)(?:\s|$)/.test(t) ? kbMatch(t, toks) : null
    if (hit) {
      const sp = kbSpecOf(hit.id)
      const ans = D === 'eg' && hit.eg ? hit.eg : hit.a
      const asks = /[؟?]\s*$/.test(ans)
      const pt = draft.preferredTime || (urgentHit ? 'عاجل — الآن' : timeHit ? timePhrase(t, raw) : null)
      const nextq = asks || !(sp || draft.specialtyId) ? '' : ' ' + (!pt ? rep('time_prompt') : !draft.coords ? rep('location_prompt') : rep('ready'))
      const intent = sp ? { specialtyId: sp, problem: raw.slice(0, 300), ...(urgentHit ? { priority: 'urgent' } : {}), ...(!draft.preferredTime && pt ? { preferredTime: pt } : {}) } : undefined
      const action = !(sp || draft.specialtyId) ? 'none' : !pt ? 'collect' : !draft.coords ? 'location' : 'ready_to_order'
      return out(ans + nextq, { intent, action, sources: ['knowledge'], confidence: 0.85 })
    }
  }

  // ── data collection answers ──
  if (draft.specialtyId && !draft.preferredTime && timeHit && !spec && !is('price_ask')) {
    const intent = { preferredTime: timePhrase(t, raw), priority: urgentHit ? 'urgent' : undefined }
    if (!draft.coords) return out(rep('time_saved_loc'), { intent, action: 'location' })
    return out(rep('ready'), { intent, action: 'ready_to_order' })
  }

  // ── AC pricing from the owner's table ──
  const prevAcq = draft.acq || null
  const warrantyWord = /ضمان/.test(t) && /(شهرين|3 شهور|ثلاث شهور|شهر|vip)/.test(t)
  const vatWord = /ضريبه|القيمه المضافه/.test(t)
  const acFollow = !spec && draft.specialtyId === 'ac' && prevAcq && (warrantyWord || vatWord || /داخلي|خارجي/.test(t) || is('edit_qty'))
  const acCtx = ac.cfg && (spec === 'ac' || acFollow || (!spec && draft.specialtyId === 'ac' && (is('price_ask') || detectAcType(t) || qty)))
  if (acCtx && spec === 'ac' && !qty && !prevAcq && !draft.qty && !is('price_ask') && !is('offers_ask') && !timeHit && !urgentHit && detectAcMode(t) === 'wash' && !/\d/.test(t)) {
    return out(`${urgentHit ? rep('urgent_ack') : ''}${rep('ask_qty', {})}`, { intent: { specialtyId: 'ac', priority: urgentHit ? 'urgent' : 'normal', problem: raw.slice(0, 200) }, action: 'collect', sources: ['pricing'] })
  }
  if (acCtx) {
    // items: "3 سبليت و 2 شباك"
    const items = []
    for (const m of t.matchAll(/(\d{1,2}|[؀-ۿ]{2,6})\s*(?:مكيف(?:ات)?\s*)?(سبليت|سبلت|شباك|داكت|دكت|باكيج|باكيدج|كونسيلد|مركزي|دولابي)/g)) {
      const n = /^\d/.test(m[1]) ? Number(m[1]) : QTY_WORDS[m[1]]
      if (n) items.push({ qty: n, type: detectAcType(m[2]) || 'سبليت' })
    }
    const multi = items.length >= 2 && new Set(items.map((i) => i.type)).size >= 2
    const explicitMode = /ركب|تركيب|فك|نقل|تاسيس|مواسير/.test(t) ? 'install' : /صيانه|عطل|خربان|بيبرد|يبرد|فحص|تسريب فريون|صوت|يقطر|ثلج|تجمد|ريحه|يفصل|يطفي|يسرب/.test(t) ? 'maintenance' : /غسيل|غسل|اغسل|نظف|تنظيف/.test(t) ? 'wash' : null
    const mode = multi ? 'wash' : explicitMode || prevAcq?.mode || 'wash'
    const type = detectAcType(t) || prevAcq?.type || 'سبليت'
    const nums = [...t.matchAll(/(?:^|\s)(\d{1,2})(?=\s|$)/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 50)
    const q = (/بدل|خل(ي|يها|يهم)|غير/.test(t) && nums.length ? nums[nums.length - 1] : qty) || prevAcq?.qty || draft.qty || 1
    const full = /داخلي فقط|داخلي بس|من جوا بس/.test(t) ? false : /داخلي وخارجي|كامل|شامل/.test(t) ? true : prevAcq?.full ?? true
    const warranty = /(3 شهور|ثلاث شهور|vip)/.test(t) ? '3 شهور' : /شهرين/.test(t) ? 'شهرين' : /(?:^|\s)شهر(?:\s|$)/.test(t) && /ضمان/.test(t) ? 'شهر' : prevAcq?.warranty || 'بدون'
    const vat = /بدون ضريبه|من غير ضريبه/.test(t) ? false : vatWord ? true : !!prevAcq?.vat
    const acq = multi ? { mode: 'wash', items, warranty, vat } : { mode, type, qty: q, full, warranty, vat }
    const r = acQuoteFromAcq(ac.cfg, acq, ac.offers || [])
    const intent = { specialtyId: 'ac', qty: multi ? items.reduce((n, i) => n + i.qty, 0) : q, priority: urgentHit ? 'urgent' : 'normal', problem: raw.slice(0, 200) }
    if (timeHit) intent.preferredTime = timePhrase(t, raw)
    if (areaM) intent.locationText = `حي ${areaM[1]}`
    if (contact) intent.contact = contact
    const nmode = { wash: 'غسيل', install: 'تركيب', maintenance: 'صيانة' }[mode]
    const label = multi ? 'غسيل ' + items.map((i) => `${i.qty} ${i.type}`).join(' و') : `${nmode} ${q > 1 || mode === 'wash' ? q + ' ' : ''}${type === 'سبليت' ? 'مكيف سبليت' : `مكيف ${type}`}${!full ? ' (داخلي فقط)' : ''}`
    const wLabel = { شهر: 'شهر', شهرين: 'شهرين', '3 شهور': '3 شهور VIP' }[warranty]
    let reply
    if (r.onInspection && !r.total) {
      reply = mode === 'maintenance'
        ? (D === 'eg' ? `الصيانة بنحدد سعرها بعد الفحص، والكشفية ببلاش لفحص لحد مكيفين، ولو العدد أكتر من مكيفين ومتمش شغل أو اتفاق بتتحسب كشفية ${money(ac.cfg.visitFee)} بس.` : `الصيانة نحدد سعرها بعد الفحص، والكشفية مجانية لفحص حتى مكيفين، وإذا زاد العدد عن مكيفين ولم يتم العمل أو الاتفاق تُحتسب كشفية ${money(ac.cfg.visitFee)} فقط.`)
        : (D === 'eg' ? 'التركيب بنسعره بعد المعاينة حسب المكان والنوع.' : 'التركيب نسعّره بعد المعاينة حسب الموقع والنوع.')
      intent.problem = `${label} (يُسعَّر بعد ${mode === 'maintenance' ? 'الفحص' : 'المعاينة'})`
    } else if (multi) {
      const lines = items.map((i, k) => `• ${i.qty} ${i.type}: ${money(r.lines[k].total)}`).join('\n')
      reply = rep('multi', { lines, total: r.total, w: (wLabel ? ` (شامل ضمان ${wLabel})` : '') + (vat ? ' شامل الضريبة' : '') })
      intent.acq = acq
      intent.problem = `${label} — ${money(r.total)}`
    } else if (acFollow && (warrantyWord || vatWord) && !spec) {
      reply = warrantyWord ? rep('warranty_added', { w: wLabel || 'شهر', p: r.total }) : rep('vat_added', { v: ac.cfg.vatPct, p: r.total })
      if (warrantyWord && vatWord) reply += ' ' + rep('vat_added', { v: ac.cfg.vatPct, p: r.total })
      intent.acq = acq
      intent.problem = `${label} — ${money(r.total)}`
    } else {
      const offerTxt = r.offer ? ` 🎉 ضمن عرض «${r.offer.title}».` : ''
      reply = `${label}: ${money(r.total)}.${offerTxt}${mode === 'wash' && warranty === 'بدون' ? (D === 'eg' ? ' وضمان 15 يوم ببلاش.' : ' وضمان 15 يوم مجاناً.') : ''}`
      intent.acq = acq
      intent.problem = `${label} — ${money(r.total)}`
      if (mode === 'wash' && type === 'سبليت' && q <= 2 && !r.offer && !prevAcq) {
        const r2 = acQuoteFromAcq(ac.cfg, { ...acq, qty: q + 1 }, ac.offers || [])
        const diff = Math.round(r2.total - r.total)
        const unit1 = acQuote(ac.cfg, { mode: 'wash', type: 'سبليت', qty: 1, offers: [] }).total
        if (diff > 0 && diff < unit1 * 0.8) reply += rep('upsell', { q2: q + 1, p2: Math.round(r2.total), diff })
      }
    }
    const missingTime = !draft.preferredTime && !timeHit && !urgentHit
    const next = missingTime ? rep('time_prompt') : (!draft.coords ? rep('location_prompt') : rep('ready'))
    const action = missingTime ? 'calculator' : (!draft.coords ? 'location' : 'ready_to_order')
    return out(`${urgentHit ? rep('urgent_ack') : ''}${reply} ${next}`, { intent, action, sources: ['pricing'] })
  }

  // ── contact / area details volunteered by the customer ──
  if ((contact || areaM || areaInfo?.district) && !spec) {
    const intent = {}
    if (contact) intent.contact = contact
    if (areaM) intent.locationText = `حي ${areaM[1]}`
    else if (areaInfo?.district) intent.locationText = `حي ${areaInfo.district}`
    const nextq = !draft.specialtyId ? rep('need_service') : !draft.preferredTime ? rep('time_prompt') : !draft.coords ? rep('location_prompt') : rep('ready')
    return out((contact ? rep('got_contact') : '') + (areaM ? rep('got_area', { a: areaM[1] }) : areaInfo?.district ? rep('in_cov', { d: areaInfo.district }) + ' ' : '') + nextq, { intent, action: !draft.specialtyId ? 'collect' : !draft.preferredTime ? 'collect' : !draft.coords ? 'location' : 'ready_to_order' })
  }

  // ── offers ──
  if (is('offers_ask') && !spec) {
    const list = (ac.offers || []).filter((o) => o.active !== false).map((o) => `• ${o.title}: ${money(o.price)}${o.badge ? ` (${o.badge})` : ''}`).join('\n')
    return out(list ? rep('offers_ask', { offers: list }) : rep('offers_none'), { action: 'calculator', sources: ['pricing'] })
  }

  // ── pricing for other services ──
  if (is('price_ask') || (spec && /كم|بكم|بكام|سعر/.test(t))) {
    const id = spec || draft.specialtyId
    if (id && rules[id]) {
      const q = computeQuote(rules[id], { qty: qty || 1, urgent: urgentHit })
      const label = SPECIALTIES.find((s) => s.id === id)?.label || ''
      return out(rep('quote_generic', { label, p: Math.round(q.total), visit: q.visitFee ? (D === 'eg' ? ' (شامل الزيارة)' : ' (شامل الزيارة)') : '' }), { intent: { specialtyId: id, qty: qty || null, priority: urgentHit ? 'urgent' : 'normal' }, action: 'calculator', sources: ['pricing'] })
    }
    if (ac.cfg) {
      const c = ac.cfg
      return out((D === 'eg' ? `أسعار غسيل المكيفات: سبليت ${money(c.split1)} للوحدة (${money(c.split3)} لـ3)، شباك ${money(c.win1)}، وباقي الأنواع ${money(c.other1)}. التركيب والصيانة بعد المعاينة. وباقي الخدمات قولي تحتاج إيه وأحسبهالك.` : `أسعار غسيل المكيفات: سبليت ${money(c.split1)} للوحدة (${money(c.split3)} لـ3)، شباك ${money(c.win1)}، وباقي الأنواع ${money(c.other1)}. التركيب والصيانة بعد المعاينة. وباقي الخدمات قل لي وش تحتاج وأحسبها لك.`), { action: 'calculator', sources: ['pricing'] })
    }
  }

  // ── info intents ──
  {
    const info = [['includes_ask', 'includes'], ['payment_ask', 'payment_ask'], ['time_ask_when', 'time_ask_when'], ['area_ask', 'area_ask'], ['parts', 'parts'], ['rating', 'rating'], ['howitworks', 'howitworks'], ['whoareyou', 'whoareyou']]
      .filter(([k]) => is(k) && (!spec || strong(k))).sort((a, b) => scores[b[0]] - scores[a[0]])[0]
    if (info) {
      const [k, key] = info
      return out(rep(key), { action: k === 'payment_ask' ? 'pay' : k === 'area_ask' ? 'location' : 'none', sources: k === 'payment_ask' ? ['payment'] : ['knowledge'] })
    }
  }
  if (is('location_ask') && draft.specialtyId) return out(rep('location_prompt'), { action: 'location' })
  if (is('repeat')) return out(rep('repeat'), { action: 'none' })

  // ── service request ──
  if (spec) {
    const label = SPECIALTIES.find((s) => s.id === spec)?.label || ''
    const intent = { specialtyId: spec, qty, priority: urgentHit ? 'urgent' : 'normal', problem: raw.slice(0, 300) }
    if (timeHit) intent.preferredTime = timePhrase(t, raw)
    const lead = `${urgentHit ? rep('urgent_ack') : ''}${rep('ask_time_service', { label })}`
    if (!draft.preferredTime && !timeHit && !urgentHit) return out(lead + rep('time_prompt'), { intent, action: 'collect', sources: ['knowledge'] })
    if (!draft.coords) return out(lead + rep('location_prompt'), { intent: { ...intent, preferredTime: intent.preferredTime || (urgentHit ? 'عاجل — الآن' : undefined) }, action: 'location', sources: ['knowledge'] })
    return out(lead + rep('ready'), { intent, action: 'ready_to_order' })
  }
  if (draft.specialtyId && draft.preferredTime && draft.coords) return out(rep('ready'), { action: 'ready_to_order' })
  if (urgentHit && !draft.specialtyId) return out(rep('urgent_ack') + rep('need_service'), { intent: { priority: 'urgent' }, action: 'collect' })

  // ── smalltalk ──
  if (/حر|حار|حرارة|الجو/.test(t)) return out(rep('weather'), { action: 'none' })
  if (is('offtopic') && !spec) return out(rep('offtopic'), { action: 'none', confidence: 0.8 })
  if (is('thanks')) return out(rep('thanks'), { confidence: 0.9 })
  if (is('bye')) return out(rep('bye'), { confidence: 0.9 })
  if (is('greet')) return out(draft.specialtyId ? rep('greet') : (D === 'eg' ? 'أهلاً بيك 👋 ' : 'هلا والله 👋 ') + rep('ask_need'), { confidence: 0.9 })
  if (is('smalltalk')) return out(rep('smalltalk'), { confidence: 0.8 })
  if (is('accept') && draft.specialtyId) return out(rep(!draft.preferredTime ? 'time_prompt' : !draft.coords ? 'location_prompt' : 'ready'), { action: !draft.preferredTime ? 'collect' : !draft.coords ? 'location' : 'ready_to_order' })
  if (is('urgent')) return out(rep('urgent_ack') + rep('need_service'), { intent: { priority: 'urgent' }, action: 'collect' })

  return out(rep('unknown'), { confidence: 0.3, understood: false })
}
