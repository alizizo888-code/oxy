// MUTQAN AI — the central assistant brain. One structured AI call per turn:
// it replies naturally AND returns the understood intent + the next workflow action.
import { aiRun, can } from './aiAdapter'
import { SPECIALTIES, STATUS_META, specialtyLabel } from './constants'
import { localTurn } from './localBot'
import { pricesForPrompt, NEGOTIATION_STYLES } from './pricing'
import { ESCALATION_REASONS, trackingText } from './workflow'
import { policyForPrompt, orderWarranty, warrantyText } from './warranty'

export const DIALECTS = [
  { id: 'auto', label: 'تلقائي', hint: 'بلهجة العميل نفسها' },
  { id: 'saudi', label: 'سعودي', hint: 'باللهجة السعودية البيضاء' },
  { id: 'egyptian', label: 'مصري', hint: 'باللهجة المصرية' },
  { id: 'gulf', label: 'خليجي', hint: 'باللهجة الخليجية' },
  { id: 'msa', label: 'فصحى', hint: 'بالعربية الفصحى المبسطة' },
]

export const VOICES = [
  { id: 'ghizlane', label: 'صوت نسائي' },
  { id: 'hamida', label: 'صوت رجالي' },
]

export const ACTIONS = ['none', 'collect', 'ready_to_order', 'register', 'track', 'handoff', 'calculator', 'negotiate', 'location', 'pay', 'warranty', 'join_tech']

// Actions whose outcome touches money, orders or operational facts — guarded by confidence.
export const SENSITIVE_ACTIONS = ['ready_to_order', 'negotiate', 'pay', 'track']
export const SOURCES = { warranty: 'سجل الضمان', pricing: 'محرك الأسعار', orders: 'طلبات العميل', knowledge: 'قاعدة المعرفة', tracking: 'بيانات التتبع', payment: 'نظام الدفع', conversation: 'المحادثة', none: 'بدون مصدر' }

export const KB_CATEGORIES = [
  { id: 'services', label: 'الخدمات' },
  { id: 'prices', label: 'ملاحظات الأسعار' },
  { id: 'policies', label: 'السياسات' },
  { id: 'faq', label: 'أسئلة شائعة' },
  { id: 'procedures', label: 'إجراءات الصيانة' },
  { id: 'instructions', label: 'تعليمات للعميل' },
  { id: 'warranty', label: 'قواعد الضمان' },
  { id: 'payment', label: 'قواعد الدفع' },
  { id: 'hours', label: 'ساعات العمل' },
  { id: 'areas', label: 'مناطق الخدمة' },
]
export const kbCategoryLabel = (id) => KB_CATEGORIES.find((c) => c.id === id)?.label || 'أسئلة شائعة'

const TONES = { friendly: 'بودّ واختصار', formal: 'برسمية واحترام واختصار', energetic: 'بحماس وطاقة إيجابية واختصار' }

function pricingBlock(quote, nego, settings) {
  if (!can(settings, 'READ_PRICE')) return 'صلاحية قراءة الأسعار متوقفة من الإدارة: لا تذكر أي سعر، وقل إن السعر يحدده فريق العمليات.'
  if (!quote) return 'لم تُحدد الخدمة بعد — اعرض السعر الأساسي من القائمة فقط.'
  const lines = [
    `عرض السعر الرسمي من محرك أسعار مُتقن للمسودة الحالية (${quote.qty} وحدة): الإجمالي ${quote.total} ر.س` +
      (settings?.pricing?.showBreakdown ? ` (الخدمة ${quote.service}${quote.visitFee ? ` + زيارة ${quote.visitFee}` : ''}${quote.emergency ? ` + عاجل ${quote.emergency}` : ''}${quote.addonsTotal ? ` + إضافات ${quote.addonsTotal}` : ''})` : ''),
    `قاعدة قطع الغيار: ${quote.partsLabel}.`,
  ]
  if (quote.agreed) lines.push(`السعر المتفق عليه حاليًا مع العميل: ${quote.agreed} ر.س — التزم به.`)
  if (!settings?.negotiation?.enabled || quote.negotiable === false || !can(settings, 'NEGOTIATE_PRICE') || settings?.globalPolicy?.negotiationAllowed === false) {
    lines.push('التفاوض على السعر غير مفعّل: لا تقدم أي خصم، واعرض التحويل لموظف إن أصر العميل.')
  } else if (nego) {
    const style = NEGOTIATION_STYLES.find((s) => s.id === settings?.negotiation?.style) || NEGOTIATION_STYLES[1]
    lines.push('أسلوب الحوار في التفاوض: ' + style.hint)
    lines.push(
      `محرك التفاوض: إذا طلب العميل خصمًا أو سعرًا أقل في رسالته الأخيرة، فأنت الآن في مرحلة "${nego.label}". ${nego.hint} السعر الوحيد المسموح ذكره هو ${nego.offer} ر.س. ممنوع ذكر أي رقم أقل منه أو اختراع خصم آخر. وأعد action = negotiate.` +
        (nego.handoff ? ' وهذه المرحلة الأخيرة — اعرض التحويل لموظف.' : '')
    )
  }
  return lines.join('\n')
}

function faqBlock(settings) {
  const faq = (settings?.faq || []).filter((f) => f?.q && f?.a).slice(0, 80)
  if (!faq.length) return '\nقاعدة المعرفة: فارغة حاليًا — أي سؤال عن سياسة أو مواعيد عمل أو مناطق غير مغطى هنا: قل إنك ستتأكد واعرض التحويل لموظف.\n'
  const groups = {}
  for (const f of faq) (groups[f.cat || 'faq'] ||= []).push(f)
  const body = KB_CATEGORIES.filter((c) => groups[c.id])
    .map((c) => `[${c.label}]\n${groups[c.id].map((f) => `س: ${f.q}\nج: ${f.a}`).join('\n')}`)
    .join('\n')
  return `\nقاعدة معرفة MUTQAN AI المعتمدة (أجب منها حرفيًا، وما ليس هنا لا تخترعه):\n${body}\n`
}

function paymentBlock(payInfo, settings) {
  if (!payInfo) return 'طرق الدفع: غير معروفة حاليًا — لا تفترض شيئًا.'
  const online = payInfo.online && can(settings, 'CREATE_PAYMENT_LINK')
  const items = (payInfo.details || payInfo.onSite || []).map((d) => '- ' + d)
  if (online) items.unshift('- دفع إلكتروني برابط دفع آمن (النظام ينشئ الرابط عند ضغط العميل زر الدفع)')
  if (!items.length) items.push('- لا توجد طرق مفعّلة حاليًا — اعرض التحويل لموظف')
  return `طرق الدفع المتاحة فعليًا من نظام مُتقن (يضبطها المالك ومشرف العمليات):
${items.join('\n')}
إذا سأل العميل كيف يدفع: اشرح هذه الطرق فقط بتفاصيلها كما هي${online ? ' وأعد action = pay ليظهر له زر الدفع' : ''}. لا تعلن أبدًا نجاح دفع إلا إذا كانت حالة الدفع في بيانات الطلب أدناه "مدفوع".`
}

const RESPONSE_POLICY = `سياسة الرد الإلزامية: ممنوع اختراع أي من: السعر، الخصم، مدة الوصول، حالة الفني، حالة الدفع، حالة الطلب، الضمان، المخزون. كل معلومة تشغيلية تأتي فقط من البيانات المرفقة في هذه التعليمات (محرك الأسعار، طلبات العميل، التتبع، نظام الدفع، قاعدة المعرفة). لا توجد بيانات مخزون متاحة لك: لا تؤكد توفر أي قطعة أو منتج. إذا لم تجد المعلومة قل ذلك بوضوح واعرض التحويل لموظف بدل التخمين.`

const PAY = { paid: 'مدفوع', unpaid: 'غير مدفوع بعد' }

// Customer context: ONLY this customer's own orders (the data layer already scopes them).
function ordersBlock(orders, staleMinutes, settings, warrantyPolicy) {
  if (!can(settings, 'READ_ORDER')) return 'صلاحية قراءة الطلبات متوقفة من الإدارة — لا تذكر أي حالة طلب واعرض التحويل لموظف.'
  const payOk = can(settings, 'READ_PAYMENT_STATUS')
  const trackOk = can(settings, 'READ_TRACKING')
  if (!orders?.length) return 'لا توجد طلبات سابقة.'
  return orders
    .slice(0, 8)
    .map((o) => {
      const parts = [
        `- طلب #${String(o.id).slice(-5)}: ${specialtyLabel(o.specialtyId)}`,
        `الحالة: ${STATUS_META[o.status]?.label || o.status}`,
        o.technicianName ? `الفني: ${o.technicianName}` : null,
        o.preferredTime ? `الموعد المفضل: ${o.preferredTime}` : null,
        o.price || o.agreedPrice || o.priceQuote?.total ? `السعر: ${o.price || o.agreedPrice || o.priceQuote?.total} ر.س` : null,
        payOk && ['completed', 'closed'].includes(o.status) ? `الدفع: ${PAY[o.paymentStatus] || PAY.unpaid}` : null,
        o.createdAt ? `بتاريخ ${String(o.createdAt).slice(0, 10)}` : null,
      ].filter(Boolean)
      let line = parts.join(' — ')
      if (['completed', 'closed'].includes(o.status)) line += `\n  الضمان (من سجل مُتقن): ${warrantyText(orderWarranty(o, warrantyPolicy))}`
      if (trackOk && ['en_route', 'nearby'].includes(o.status)) line += `\n  التتبع: ${trackingText(o, staleMinutes)}`
      return line
    })
    .join('\n')
}

function pastConversationsBlock(pastHandoffs) {
  const list = (pastHandoffs || []).filter((h) => h.summary).slice(0, 3)
  if (!list.length) return ''
  return `\nمحادثات سابقة مع الموظفين (ملخص):\n${list.map((h) => `- ${h.summary}`).join('\n')}\n`
}

function locationBlock(draft, area) {
  if (draft?.coords) {
    const inside = area?.inside
    return `موقع العميل: محدد${draft.coords.address ? ` (${draft.coords.address})` : ''}.${inside === false ? ' خارج نطاق الخدمة المعتمد — وضّح ذلك بلطف واعرض التحويل لموظف.' : inside ? ' داخل نطاق الخدمة.' : ''}${area?.nearby != null ? ` عدد الفنيين المتاحين تقريبًا ضمن 15 كم: ${area.nearby}.` : ''}`
  }
  return 'موقع العميل: غير محدد بعد. اطلبه عند الحاجة بـ action = location (العميل يوافق من جهازه — لا تفترض موقعًا).'
}

let AC_CTX = null
export function setAcContext(ctx) { AC_CTX = ctx }
function acBlock() {
  if (!AC_CTX?.cfg) return ''
  const c = AC_CTX.cfg
  const offers = (AC_CTX.offers || []).filter((o) => o.active !== false)
  return `
جدول أسعار المكيفات الرسمي (ر.س) — مصدر الأرقام الوحيد لخدمات المكيفات:
- غسيل سبليت (داخلي وخارجي): وحدة ${c.split1}، وحدتان ${c.split2}، ثلاث ${c.split3}، وما زاد يُحسب بثلث سعر الثلاث لكل وحدة. داخلي فقط أرخص بـ ${c.innerOff1}/${c.innerOff2}/${c.innerOff3}.
- غسيل شباك: ${c.win1} / ${c.win2} / ${c.win3} (+${c.winExtra} لكل وحدة بعد الثالثة). باقي الأنواع (باكيدج، كونسيلد، داكت، مركزي، دولابي): ${c.other1} للوحدة.
- ضمان إضافي للوحدة: شهر +${c.w1}، شهرين +${c.w2}، 3 شهور +${c.w3} (ضمان 15 يوم مجاني). ضريبة القيمة المضافة ${c.vatPct}% عند الطلب.
- التركيب والصيانة: يُسعَّران بعد المعاينة/الفحص. الكشفية مجانية لفحص حتى مكيفين؛ وإن زاد العدد عن مكيفين ولم يتم العمل أو الاتفاق تُحتسب كشفية الزيارة ${c.visitFee} ر.س.
- أقصى خصم تفاوض مسموح: ${c.maxDiscountPct}% — لا تنزل عنه أبدًا. ابدأ بعرض مزايا (ضمان/سرعة/جودة) قبل أي خصم.
${offers.length ? 'العروض الحالية:\n' + offers.map((o) => `- ${o.title}: ${o.price} ر.س${o.badge ? ` (${o.badge})` : ''}${o.warranty ? ` — ضمان ${o.warranty}` : ''}`).join('\n') : ''}`
}

export function buildPrompt({ history, customer, orders, draft, dialect, rules, quote, nego, settings, pastHandoffs, area, payInfo, warrantyPolicy }) {
  const d = DIALECTS.find((x) => x.id === dialect) || DIALECTS[0]
  const tone = TONES[settings?.tone] || TONES.friendly
  const convo = history
    .slice(-24)
    .map((m) => `${m.role === 'user' ? 'العميل' : 'MUTQAN AI'}: ${m.content}`)
    .join('\n')

  return `## 1) الدور والأسلوب
أنت "MUTQAN AI"، موظف خدمة العملاء الذكي لمنصة مُتقن (أكسجين) للصيانة والمقاولات. تتكلم ${d.hint}، ${tone} (جملتان إلى ثلاث)، وتطرح سؤالًا واحدًا فقط في كل رد.
هدفك: تفهم حاجة العميل بسرعة، تعطيه السعر الرسمي، تتفق معه على الموعد والموقع، ثم تجهّز الطلب كاملًا ليُرسل على واتساب الإدارة بضغطة. كن دافئًا ومباشرًا وبدون حشو، ولا تكرر ما قاله العميل.

## 2) المعرفة المعتمدة (مصدرك الوحيد للأرقام والسياسات)
### الخدمات وأسعارها الرسمية (المعرّف = الاسم — السعر):
${pricesForPrompt(rules || {})}${acBlock()}
### الضمان:
${policyForPrompt(warrantyPolicy)}
مدة ضمان كل طلب مكتمل وحالته (ساري/منتهي والأيام المتبقية) مكتوبة بجانب الطلب في القسم 3 — اقرأها حرفيًا ولا تحسبها بنفسك. إذا ذكر العميل مشكلة في خدمة سابقة أو سأل عن ضمانه: افحص الضمان من البيانات وأخبره بالنتيجة ثم أعد action = warranty ليفتح ملف ضمان (وصف + صور/فاتورة) لفريق الفحص. لا تعد أبدًا بقبول الضمان — القرار لفريق العمليات. الضمان المسجل خارج التطبيق لا تملك سجله: اطلب فتح ملف ضمان بالرقم أو الجوال.
### التسعير والتفاوض:
أنت لا تخترع الأسعار أبدًا؛ كل رقم يأتي من محرك الأسعار أدناه فقط. تشرح مكونات السعر وتقارن الخدمات وتقترح البدائل الأوفر.
${pricingBlock(quote, nego, settings)}
### أسئلة شائعة ومعلومات الدفع:
${faqBlock(settings)}
${paymentBlock(payInfo, settings)}

## 3) حالة هذا العميل
${customer?.verified ? `عميل مسجّل — الاسم: ${customer.name || 'غير معروف'}${customer.phone ? `، الجوال: ${customer.phone}` : ''}. لا تطلب بياناته الأساسية مجددًا.` : 'زائر بدون تسجيل. لا تطلب منه اسمًا أو رقم جوال أو تسجيلًا أو بريدًا أو رمز تحقق — رقمه يصلنا من واتساب عند إرسال الطلب. ركّز على الخدمة والتفاصيل والسعر والموعد والموقع (action = location عند الحاجة). إذا ذكر اسمه أو رقمه من تلقاء نفسه فسجّله ولا تلحّ.'}
### طلباته ومواعيده وحالة الدفع والتتبع:
${ordersBlock(orders, settings?.tracking?.staleMinutes, settings, warrantyPolicy)}
${pastConversationsBlock(pastHandoffs)}
### الموقع:
${locationBlock(draft, area)}
### مسودة الطلب المفهومة حتى الآن:
${JSON.stringify(draft || {})}

## 4) القواعد الصارمة
- الخصوصية: استخدم فقط بيانات هذا العميل. لا تذكر أرقام الفنيين أو مواقعهم الدقيقة أو العمولات أو بيانات عميل آخر.
- التتبع: عند "الفني فين؟" اقرأ سطر التتبع حرفيًا. ممنوع تقدير وقت الوصول أو اختراع دقائق. إن لم تتوفر بيانات قل ذلك واعرض التحويل لموظف.
- لا تختلق أرقام هواتف أو أسماء فنيين أو حالات طلبات. لا تدّعِ أنك أنشأت طلبًا أو أتممت دفعًا — النظام ينشئ الطلب عند ضغط زر التأكيد، ورابط الدفع عند ضغط زر الدفع.
- متى تحوّل لموظف (escalation): ${ESCALATION_REASONS.map((r) => `${r.id} = ${r.label}`).join('، ')}. إذا انطبقت إحداها على آخر رسالة ضع معرّفها في escalation وaction = handoff، ورد بتعاطف أنك ستحوّله لموظف مختص دون محاولة حل المشكلة (لا استرداد ولا تعويض ولا رأي قانوني). خلاف ذلك escalation = null.
- الثقة: قيّم ثقتك في فهمك وفي صحة ردك من 0 إلى 1. إذا كانت أقل من ${Number(settings?.confidence?.threshold ?? 0.6)} فلا تخمّن: اسأل سؤال توضيح واحدًا أو اعرض التحويل لموظف. لا يمكنك تجاوز التحقق أو الصلاحيات.
- السلامة أولًا: عند ذكر ماس كهربائي أو شرارة أو تسريب غاز أو انفجار ماسورة، ابدأ بخطوة الأمان (فصل القاطع/إغلاق المحبس/الابتعاد) ثم اعرض فنيًا عاجلًا.
- أسلوب الحوار: افهم اللهجة والأخطاء الإملائية، تذكّر ما قيل سابقًا ولا تسأل عنه مرتين، واربط كل رد بالخطوة التالية في الطلب (الخدمة ← العدد/التفاصيل ← الموعد ← الموقع ← التأكيد).

## 5) المحادثة
${convo}

## 6) صيغة الإخراج
أعد JSON فقط بهذا الشكل:
{
 "reply": "ردك للعميل",
 "intent": {
   "specialtyId": "أحد المعرفات أعلاه أو null",
   "problem": "وصف مختصر للمشكلة أو null",
   "priority": "normal أو urgent",
   "preferredTime": "الوقت المفضل بالنص مثل اليوم مساءً أو null",
   "locationText": "الحي/العنوان إن ذُكر أو null",
   "qty": "عدد الوحدات كرقم أو null",
   "acceptedOffer": "true إذا وافق العميل صراحةً على آخر سعر معروض، وإلا false"
 },
 "escalation": "أحد معرفات التصعيد أعلاه أو null",
 "action": "واحد من: none | collect | ready_to_order | register | track | handoff | calculator | negotiate | location | pay | warranty | join_tech",
 "confidence": "رقم من 0 إلى 1",
 "sources": ["مصادر المعلومات التي استخدمتها من: pricing | orders | warranty | knowledge | tracking | payment | conversation | none"]
}
قواعد action: collect = ما زلت تجمع بيانات. ready_to_order = عرفت الخدمة والمشكلة وجاهز لعرض بطاقة تأكيد الطلب. register = الزائر يطلب التسجيل صراحةً فقط (لطلب خدمة استخدم ready_to_order؛ لا يوجد تسجيل إجباري). track = يسأل عن حالة طلب. handoff = يطلب موظفًا بشريًا أو المشكلة خارج قدرتك. calculator = يريد حسابًا تفصيليًا للأسعار. negotiate = يطلب خصمًا أو يساوم على السعر. location = تحتاج موقع العميل وهو غير محدد. pay = يسأل كيف يدفع أو يريد الدفع. warranty = مشكلة في خدمة سابقة أو سؤال عن الضمان (يفتح ملف ضمان؛ استخدم escalation فقط إذا طلب استردادًا أو كان غاضبًا جدًا). join_tech = شخص يريد العمل أو التسجيل كفني في مُتقن (أخبره أن التسجيل بضغطة ثم الاسم والجوال والتخصصات والموقع، ويُفعّل حسابه بعد موافقة الإدارة — لا تعده بالقبول). none = سؤال عام.`
}

export async function runTurn(ctx) {
  // Local engine: owner-selected (zero cost) or automatic fallback when no AI key/provider is available
  let out
  const useLocal = ctx.settings?.providers?.ai !== 'platform'
  if (!useLocal) {
    try {
      const { json, text } = await aiRun(buildPrompt(ctx), { json: true }, { feature: 'chat' }, ctx.settings)
      out = json && typeof json === 'object' ? json : { reply: text || '', intent: {}, action: 'none' }
    } catch (e) { out = null }
  }
  if (!out || !out.reply) out = localTurn({ ...ctx, ac: AC_CTX })
  const intent = out.intent || {}
  if (intent.specialtyId && !SPECIALTIES.some((s) => s.id === intent.specialtyId)) intent.specialtyId = null
  if (intent.priority !== 'urgent') intent.priority = 'normal'
  const q = parseInt(intent.qty, 10)
  intent.qty = Number.isFinite(q) && q > 0 && q <= 50 ? q : null
  { const cp = Number(intent.counterPrice); intent.counterPrice = Number.isFinite(cp) && cp > 0 ? cp : null }
  intent.acceptedOffer = intent.acceptedOffer === true || intent.acceptedOffer === 'true'
  const escalation = ESCALATION_REASONS.some((r) => r.id === out.escalation) ? out.escalation : null
  let confidence = parseFloat(out.confidence)
  if (!Number.isFinite(confidence)) confidence = out.reply ? 0.7 : 0
  confidence = Math.max(0, Math.min(1, confidence))
  const sources = (Array.isArray(out.sources) ? out.sources : []).filter((s) => SOURCES[s]).slice(0, 5)
  return {
    confidence,
    sources,
    reply: String(out.reply || 'عذرًا، لم أفهم تمامًا — هل توضح أكثر؟'),
    intent,
    escalation,
    understood: !!out.reply,
    action: ACTIONS.includes(out.action) ? out.action : 'none',
  }
}

export function mergeDraft(prev, intent) {
  const next = { ...(prev || {}) }
  if (intent?.specialtyId && prev?.specialtyId && intent.specialtyId !== prev.specialtyId) {
    delete next.negotiation
    delete next.agreedPrice
  }
  for (const k of ['specialtyId', 'problem', 'priority', 'preferredTime', 'locationText', 'qty', 'acq', 'contact']) {
    const v = intent?.[k]
    if (v !== null && v !== undefined && v !== '' && v !== 'null') next[k] = v
  }
  return next
}

export async function summarizeForHandoff({ history, draft, customer, settings }) {
  const convo = history.slice(-30).map((m) => `${m.role === 'user' ? 'العميل' : 'AI'}: ${m.content}`).join('\n')
  try {
    const { json } = await aiRun(
      `لخّص هذه المحادثة لموظف خدمة العملاء البشري الذي سيستلمها. العميل: ${customer?.name || 'زائر'}. المسودة: ${JSON.stringify(draft || {})}
${convo}
أعد JSON: {"summary": "ملخص 2-3 جمل بالعربية", "intent": "نية العميل في جملة قصيرة", "mood": "هادئ أو منزعج أو مستعجل"}`,
      { json: true },
      { feature: 'handoff_summary' },
      settings
    )
    if (json?.summary) return json
  } catch {}
  return { summary: 'طلب العميل التحويل إلى موظف.', intent: draft?.problem || 'غير محدد', mood: 'غير محدد' }
}
