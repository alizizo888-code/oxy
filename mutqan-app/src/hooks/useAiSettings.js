import { useCallback, useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { DEFAULT_NEGOTIATION } from '../pricing'
import { DEFAULT_PERMISSIONS } from '../aiAdapter'

// Central MUTQAN AI settings — one shared row the whole app reads; only team
// admins (owner + operations supervisor) can change it.
// Ready-made knowledge base (used while the owner has not saved their own). No prices/warranty days here on purpose:
// those come only from the pricing engine and the warranty policy, so the bot can never contradict them.
export const DEFAULT_KB = [
  { cat: 'services', q: 'ما الخدمات المتوفرة؟', a: 'صيانة وتكييف، كهرباء، سباكة، أقفال ذكية، أجهزة منزلية، ساتلايت ودش، دهان وديكور، تبليط وترميم، كاميرات ومراقبة، تبريد (ثلاجات ومبردات)، تنظيف وتعقيم، مكافحة حشرات، خزانات مياه، نقل أثاث، طاقة شمسية، خدمات شركات، صيانة عامة ومقاولات.' },
  { cat: 'services', q: 'ماذا تشمل صيانة التكييف؟', a: 'غسيل المكيف، فك وتركيب، تعبئة وشحن الفريون، وإصلاح أعطال التبريد والتسريب. يحدد الفني السعر النهائي بعد الفحص إن اختلفت الحالة عن الوصف.' },
  { cat: 'areas', q: 'في أي مدن تعملون؟', a: 'نخدم مكة المكرمة وجدة. إن كان حيّك خارج التغطية المعروضة فسنؤكد لك عبر الموظف قبل اعتماد الطلب.' },
  { cat: 'procedures', q: 'كيف أطلب خدمة؟', a: 'اكتب لي الخدمة والمشكلة وموقعك والوقت المناسب، وأجهّز لك الطلب لتؤكده بضغطة زر، ثم تتابع حالته من التطبيق.' },
  { cat: 'procedures', q: 'كيف أتابع طلبي؟', a: 'من صفحة «طلباتي» في التطبيق تظهر حالة الطلب ووصول الفني. لا أقدّر وقت الوصول من عندي؛ أقرأ لك ما يظهره التتبع فقط.' },
  { cat: 'procedures', q: 'هل يمكن إلغاء الطلب أو تغيير الموعد؟', a: 'نعم قبل وصول الفني. اكتب لي طلب التعديل وأرفعه للموظف إن احتاج موافقة.' },
  { cat: 'prices', q: 'كم السعر؟', a: 'السعر يأتي من محرك الأسعار الرسمي حسب الخدمة والكمية. إن كانت الحالة تحتاج فحصًا فالفني يؤكد السعر النهائي قبل التنفيذ ولا يُنفَّذ شيء دون موافقتك.' },
  { cat: 'payment', q: 'كيف أدفع؟', a: 'الطرق المتاحة تظهر لك في الطلب وفي رابط الدفع الذي يرسله الفريق. لا ترسل بيانات بطاقتك داخل المحادثة.' },
  { cat: 'payment', q: 'هل أحصل على فاتورة؟', a: 'نعم، تصدر فاتورة ضريبية مبسّطة برمز QR بعد التنفيذ وتبقى متاحة في صفحة الطلب.' },
  { cat: 'warranty', q: 'هل توجد ضمانات؟', a: 'نعم وفق سياسة الضمان المعتمدة لكل خدمة. أقرأ لك مدة الضمان وحالته من سجل طلبك فقط، وإن لم يظهر لك فسأحوّلك للموظف للتحقق.' },
  { cat: 'policies', q: 'كيف أقدّم شكوى أو مشكلة بعد التنفيذ؟', a: 'اكتبها هنا وسأحوّلها للموظف المختص مع رقم الطلب ليتواصل معك. المشكلات المتعلقة بالضمان والاسترداد يقررها الموظف.' },
  { cat: 'instructions', q: 'ماذا أفعل عند ماس كهربائي أو تسريب غاز أو انفجار ماسورة؟', a: 'سلامتك أولًا: افصل القاطع الرئيسي في حالة الكهرباء، أغلق المحبس في حالة الماء أو الغاز، وابتعد عن المكان، ثم اطلب الخدمة العاجلة. في الخطر الشديد اتصل بالدفاع المدني 998.' },
  { cat: 'instructions', q: 'ماذا أجهّز قبل وصول الفني؟', a: 'تأكد أن الموقع مفتوح ومتاح، وأبعد الأغراض حول الجهاز، وكن متاحًا على رقمك للتواصل عند الوصول.' },
  { cat: 'faq', q: 'هل أستطيع التحدث مع موظف؟', a: 'بالتأكيد. اطلب موظفًا وسأحوّل المحادثة له مع ملخص حتى لا تعيد كلامك.' },
]
export const DEFAULT_PRIVACY_NOTICE = 'نستخدم محادثتك وبيانات طلباتك لخدمتك فقط، ولا نشاركها مع عملاء آخرين. المحادثات الصوتية تُعالَج بموافقتك، وتُحذف السجلات بعد مدة الاحتفاظ المحددة.'

export const DEFAULT_AI_SETTINGS = {
  enabled: true,
  tone: 'friendly',
  defaultDialect: 'auto',
  defaultVoice: 'ghizlane',
  autoSpeakDefault: false,
  greeting: '',
  faq: DEFAULT_KB,
  pricing: { showBreakdown: true },
  negotiation: DEFAULT_NEGOTIATION,
  registration: { passkeyEnabled: true },
  orderConversion: { allowUrgent: true, askPreferredTime: true },
  followUp: {
    showActiveOnGreeting: true,
    statusMessages: true,
    serverPush: false,
    customerNoReplyMin: 30,
    remindCustomer: true,
    techAcceptMin: 15,
    escalateOnNoAccept: true,
    techLateMin: 60,
    notifyOpsOnLate: true,
  },
  escalation: {
    reasons: {
      pricing: true, complaint: true, refund: true, legal: true, payment: true,
      repeated_failure: true, human: true, high_value: true, sensitive: true,
    },
    highValueAmount: 1000,
    highValueOrders: 5,
    failureLimit: 2,
  },
  serviceArea: { enabled: false, name: '', lat: null, lng: null, radiusKm: 50 },
  tracking: { staleMinutes: 10 },
  handoff: { enabled: true, offerAfterNegotiation: true },
  logging: { enabled: true },
  confidence: { threshold: 0.6, guardSensitive: true },
  payment: { aiPayButton: true },
  providers: { ai: 'local', aiModel: 'auto', stt: 'platform', tts: 'platform', sttLanguage: 'ar' },
  permissions: DEFAULT_PERMISSIONS,
  // Owner-only global policy: caps every service regardless of per-service rules
  globalPolicy: { maxDiscountPct: 20, voiceEnabled: true, negotiationAllowed: true },
  privacy: { voiceConsentRequired: true, retentionDays: 90, notice: DEFAULT_PRIVACY_NOTICE },
  costs: { currency: 'USD', per1kTokens: 0, perVoiceMinute: 0, perTtsKChars: 0 },
}

// Sections only the OWNER may change (operations supervisor sees them read-only).
export const OWNER_ONLY_KEYS = ['globalPolicy', 'permissions', 'providers', 'costs', 'privacy']

export function mergeAiSettings(row) {
  const r = row || {}
  const out = { ...DEFAULT_AI_SETTINGS, ...r }
  for (const k of ['pricing', 'registration', 'orderConversion', 'followUp', 'handoff', 'logging', 'escalation', 'serviceArea', 'tracking', 'confidence', 'payment', 'providers', 'permissions', 'globalPolicy', 'privacy', 'costs']) {
    out[k] = { ...DEFAULT_AI_SETTINGS[k], ...(r[k] || {}) }
  }
  out.escalation.reasons = { ...DEFAULT_AI_SETTINGS.escalation.reasons, ...(r.escalation?.reasons || {}) }
  out.negotiation = {
    ...DEFAULT_NEGOTIATION,
    ...(r.negotiation || {}),
    stages: { ...DEFAULT_NEGOTIATION.stages, ...(r.negotiation?.stages || {}) },
  }
  out.faq = Array.isArray(r.faq) && r.faq.length ? r.faq : DEFAULT_KB
  if (!out.privacy.notice) out.privacy.notice = DEFAULT_PRIVACY_NOTICE
  return out
}

export function useAiSettings() {
  const { data, loading } = useLiveShared('ai_settings', { limit: 1 })
  const settings = useMemo(() => mergeAiSettings(data?.[0]), [data])

  // Nested sections are passed whole (shallow merge on the server).
  const update = useCallback(async (patch) => {
    const gid = await team.groupId()
    const current = mergeAiSettings(data?.[0])
    const { id, _id, ...rest } = current
    await db.upsertShared('ai_settings', { ...rest, ...patch, updatedAt: new Date().toISOString() }, 'default', {
      groupId: gid,
      writableBy: 'admins',
    })
    // Audit trail: who changed which section, when (admins only can read)
    try {
      const actor = await team.currentMember().catch(() => null)
      await db.insertShared('_ai_audit', {
        sections: Object.keys(patch),
        by: actor?.name || actor?.displayName || 'الإدارة',
        role: actor?.role || null,
        at: new Date().toISOString(),
      }, undefined, { groupId: gid, visibleTo: 'creator-and-admin' })
    } catch {}
  }, [data])

  return { settings, loading, update }
}

// Staff-only AI activity log: customers write, only admins read.
export async function logAi(entry) {
  try {
    const gid = await team.groupId()
    await db.insertShared('ai_logs', { ...entry, at: new Date().toISOString() }, undefined, {
      groupId: gid,
      visibleTo: 'creator-and-admin',
    })
  } catch {}
}
