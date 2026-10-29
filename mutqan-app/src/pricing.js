// MUTQAN Pricing Engine + Negotiation Engine.
// The price ALWAYS comes from here (rules set by operations/owner). The AI only
// reads, explains and presents the offer this engine allows — it never invents one.
import { SPECIALTIES, PRICE_BASE } from './constants'

export const ADDONS = [
  { id: 'parts', label: 'قطع غيار أصلية', price: 80 },
  { id: 'deep', label: 'تنظيف عميق وتعقيم', price: 60 },
  { id: 'evening', label: 'زيارة مسائية', price: 40 },
  { id: 'warranty', label: 'ضمان ممدد 60 يوم', price: 50 },
]

export const PARTS_RULES = [
  { id: 'separate', label: 'قطع الغيار تُحسب منفصلة بعد موافقة العميل' },
  { id: 'included', label: 'قطع الغيار البسيطة مشمولة في السعر' },
  { id: 'customer', label: 'العميل يوفّر قطع الغيار' },
]

export function defaultRule(serviceId) {
  const base = PRICE_BASE[serviceId] || 100
  return {
    serviceId,
    base,
    min: Math.round(base * 0.9),
    max: Math.round(base * 1.3),
    discountPct: 10,
    visitFee: 0,
    emergencyPct: 25,
    partsRule: 'separate',
    extraUnitPct: 80,
    extraNote: '',
    aiNegotiation: true,
    maxAttempts: 4,
  }
}

export function defaultInternal(serviceId) {
  return { serviceId, commissionPct: 60, marginPct: 40 }
}

const num = (v, fb) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : fb)

export function normalizeRule(serviceId, row) {
  const d = defaultRule(serviceId)
  const r = { ...d, ...(row || {}) }
  r.base = Math.max(0, num(r.base, d.base))
  r.min = Math.max(0, Math.min(num(r.min, d.min), r.base))
  r.max = Math.max(r.base, num(r.max, d.max))
  r.discountPct = Math.min(90, Math.max(0, num(r.discountPct, d.discountPct)))
  r.visitFee = Math.max(0, num(r.visitFee, 0))
  r.emergencyPct = Math.max(0, num(r.emergencyPct, 25))
  r.extraUnitPct = Math.min(100, Math.max(0, num(r.extraUnitPct, 80)))
  r.aiNegotiation = r.aiNegotiation !== false
  r.maxAttempts = Math.min(8, Math.max(1, Math.round(num(r.maxAttempts, 4))))
  return r
}

const round5 = (v) => Math.round(v / 5) * 5

// Full quote for one service. `floor` = the lowest total negotiation may reach.
// globalMaxDiscountPct = the owner's global cap: no service may go lower than this.
export function computeQuote(rule, { qty = 1, urgent = false, addons = [], globalMaxDiscountPct = null } = {}) {
  const q = Math.max(1, Math.min(50, Number(qty) || 1))
  const unitsFactor = 1 + (q - 1) * (rule.extraUnitPct / 100)
  const service = rule.base * unitsFactor
  const pct = globalMaxDiscountPct == null ? rule.discountPct : Math.min(rule.discountPct, Math.max(0, Number(globalMaxDiscountPct) || 0))
  const serviceFloor = Math.max(rule.min * unitsFactor, service * (1 - pct / 100))
  const addonsTotal = ADDONS.filter((a) => addons.includes(a.id)).reduce((s, a) => s + a.price, 0)
  const emergency = urgent ? service * (rule.emergencyPct / 100) : 0
  const fixed = rule.visitFee + addonsTotal + emergency
  const total = Math.round(service + fixed)
  const floor = Math.min(total, Math.round(serviceFloor + fixed))
  return {
    qty: q,
    service: Math.round(service),
    visitFee: rule.visitFee,
    emergency: Math.round(emergency),
    addonsTotal,
    total,
    floor,
    ceiling: Math.round(rule.max * unitsFactor + fixed),
  }
}

// ── Negotiation ────────────────────────────────────────────────────────────
export const NEGOTIATION_STAGES = [
  { id: 'base', label: 'عرض السعر الأساسي', hint: 'اعرض السعر الأساسي بثقة واذكر ما يشمله.' },
  { id: 'value', label: 'شرح قيمة الخدمة', hint: 'لا تخفض السعر. اشرح قيمة الخدمة: الضمان الذهبي 30 يومًا، فنيون معتمدون، التتبع الحي.' },
  { id: 'alternative', label: 'عرض بديل', hint: 'لا تخفض السعر. اقترح بديلًا أوفر (نطاق أصغر، عدد وحدات أقل، أو إلغاء إضافة).' },
  { id: 'discount', label: 'خصم محدود', hint: 'قدّم الخصم المحدود المسموح فقط.' },
  { id: 'floor', label: 'الوصول للسعر الأدنى', hint: 'هذا أقل سعر ممكن نهائيًا. وضّح ذلك بلطف.' },
  { id: 'handoff', label: 'تحويل لموظف', hint: 'لا يمكنك النزول أكثر. اعرض تحويل العميل لموظف بشري.' },
]

export const DEFAULT_NEGOTIATION = {
  enabled: true,
  stages: { base: true, value: true, alternative: true, discount: true, floor: true, handoff: true },
  discountSteps: 2,
  unitStep: 10, // per-unit SAR drop per bargaining round (0 = use the percentage ladder)
  style: 'balanced',
}

export const NEGOTIATION_STYLES = [
  { id: 'soft', label: 'ليّن ومرن', hint: 'كن متفهمًا جدًا ولطيفًا في التفاوض.' },
  { id: 'balanced', label: 'متوازن', hint: 'كن ودودًا وواضحًا في التفاوض.' },
  { id: 'firm', label: 'حازم', hint: 'كن مهذبًا لكن حازمًا، وركّز على القيمة قبل أي خصم.' },
]

// Expand the operations supervisor's policy into an ordered ladder of steps.
// maxAttempts = per-service negotiation attempts; after them the customer goes to a human.
export function buildLadder(policy, maxAttempts, quote) {
  const p = { ...DEFAULT_NEGOTIATION, ...(policy || {}), stages: { ...DEFAULT_NEGOTIATION.stages, ...(policy?.stages || {}) } }
  const steps = []
  // Stepped per-unit bargaining: 100 -> 90 -> 80 (never below the floor), then apologise + support handoff
  const units = Math.max(1, Number(quote?.units) || 1)
  const stepSar = Number(p.unitStep) || 0
  if (stepSar > 0 && quote && quote.units != null && quote.total > quote.floor) {
    const L = quote.total / units, F = quote.floor / units
    const step = Math.max(stepSar, Math.ceil((L - F) / 6))
    for (let u = Math.floor(L / 5) * 5 - (L % 5 === 0 ? step : 0); u > F; u -= step) steps.push({ stage: 'discount', offer: Math.round(u * units) })
    steps.push({ stage: 'floor' })
    if (p.stages.handoff) steps.push({ stage: 'handoff' })
    return steps
  }
  if (p.stages.base) steps.push({ stage: 'base' })
  if (p.stages.value) steps.push({ stage: 'value' })
  if (p.stages.alternative) steps.push({ stage: 'alternative' })
  if (p.stages.discount) {
    const n = Math.max(1, Math.min(4, Number(p.discountSteps) || 2))
    const fracs = n === 1 ? [0.4] : n === 2 ? [0.2, 0.5] : n === 3 ? [0.15, 0.35, 0.6] : [0.1, 0.25, 0.45, 0.7]
    fracs.forEach((f) => steps.push({ stage: 'discount', frac: f }))
  }
  if (p.stages.floor) steps.push({ stage: 'floor' })
  const cap = Number(maxAttempts) > 0 ? Number(maxAttempts) : null
  const bounded = cap && steps.length > cap ? [...steps.slice(0, cap - 1), steps.find((s) => s.stage === 'floor') || steps[cap - 1]] : steps
  if (p.stages.handoff) bounded.push({ stage: 'handoff' })
  return bounded
}

// The offer the engine allows for a given ladder step. Never below the floor.
export function offerFor(step, quote) {
  if (!step) return quote.total
  if (step.stage === 'discount' && step.offer != null) return Math.max(quote.floor, Math.min(quote.total, step.offer))
  const gap = quote.total - quote.floor
  let v = quote.total
  if (step.stage === 'discount') v = quote.total - gap * step.frac
  if (step.stage === 'floor' || step.stage === 'handoff') v = quote.floor
  v = round5(v)
  return Math.max(quote.floor, Math.min(quote.total, v))
}

// What happens if the customer pushes for a discount on THIS turn.
export function nextNegotiationStep(state, quote, policy, maxAttempts) {
  const ladder = buildLadder(policy, maxAttempts, quote)
  const i = Math.min(state?.i ?? 0, ladder.length - 1)
  const step = ladder[i]
  if (!step) return null
  const meta = NEGOTIATION_STAGES.find((s) => s.id === step.stage)
  return {
    i,
    stage: step.stage,
    label: meta?.label,
    hint: meta?.hint,
    offer: offerFor(step, quote),
    handoff: step.stage === 'handoff',
    last: i >= ladder.length - 1,
  }
}

export function pricesForPrompt(rulesMap) {
  return SPECIALTIES.map((s) => {
    const r = rulesMap[s.id] || defaultRule(s.id)
    return `${s.id} = ${s.label} (${s.desc}) — السعر الأساسي ${r.base} ر.س${r.visitFee ? ` + رسوم زيارة ${r.visitFee}` : ''}`
  }).join('\n')
}
