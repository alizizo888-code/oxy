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
  // ── تفاصيل الخدمات (وصف عام بلا أسعار)
  { cat: 'services', q: 'ماذا تشمل خدمة الكهرباء؟', a: 'تمديدات، إصلاح أعطال القواطع والأفياش والإنارة، فحص اللوحات الكهربائية، وتركيب نقاط جديدة. الفني يفحص أولًا ثم يؤكد السعر.' },
  { cat: 'services', q: 'ماذا تشمل خدمة السباكة؟', a: 'كشف وإصلاح التسربات، تمديد وتركيب الأدوات الصحية والخلاطات، وفتح الانسدادات، وإصلاح السخانات وخزانات الطرد.' },
  { cat: 'services', q: 'هل تركّبون وتصلحون الأقفال الذكية؟', a: 'نعم، تركيب وصيانة الأقفال الذكية وضبطها. اذكر نوع القفل وموديله إن عرفته ليتجهز الفني.' },
  { cat: 'services', q: 'ما الأجهزة المنزلية التي تصلحونها؟', a: 'الغسالات، الأفران، السخانات وغيرها من الأجهزة المنزلية. اذكر نوع الجهاز والعطل الظاهر.' },
  { cat: 'services', q: 'هل تركّبون ساتلايت ودش؟', a: 'نعم، تركيب الأطباق وضبط القنوات وإصلاح ضعف الإشارة.' },
  { cat: 'services', q: 'هل تقدمون خدمات الدهان والديكور؟', a: 'نعم: دهانات، ورق جدران، وأعمال ديكور. يُحدَّد السعر بعد معرفة المساحة والتفاصيل.' },
  { cat: 'services', q: 'ماذا تشمل خدمة التبليط والترميم؟', a: 'تبليط، ترميم، وأعمال عزل. غالبًا يلزم فحص الموقع أو صور لتقدير العمل.' },
  { cat: 'services', q: 'هل توجد كاميرات مراقبة؟', a: 'نعم، تركيب وصيانة كاميرات المراقبة وأنظمة الأمن مع ضبط التسجيل والمشاهدة عن بُعد.' },
  { cat: 'services', q: 'هل تصلحون الثلاجات والمبردات؟', a: 'نعم، الثلاجات والمبردات والفريزرات: أعطال التبريد، الكمبروسر، والتسرب.' },
  { cat: 'services', q: 'ما خدمات التنظيف والتعقيم؟', a: 'تنظيف عميق وتعقيم للمنازل والمنشآت. حدّد نوع المكان وعدد الغرف أو المساحة.' },
  { cat: 'services', q: 'هل تقدمون مكافحة الحشرات؟', a: 'نعم، رش ومكافحة بحسب نوع الحشرة والمكان. أخبرني بالنوع وهل توجد أطفال أو حيوانات أليفة.' },
  { cat: 'services', q: 'هل تنظّفون خزانات المياه؟', a: 'نعم: تنظيف وعزل وتعقيم الخزانات الأرضية والعلوية.' },
  { cat: 'services', q: 'هل تقدمون نقل الأثاث؟', a: 'نعم: فك ونقل وتركيب الأثاث. حدّد موقع التحميل والتنزيل وعدد القطع التقريبي.' },
  { cat: 'services', q: 'هل تتعاملون مع الطاقة الشمسية؟', a: 'نعم، تركيب وصيانة الأنظمة الشمسية. اذكر نوع المبنى والحاجة (تركيب جديد أم صيانة).' },
  { cat: 'services', q: 'هل لديكم خدمات للشركات؟', a: 'نعم، عقود وصيانة المنشآت. اطلب موظف مبيعات الشركات ليرتّب معك التفاصيل.' },
  { cat: 'services', q: 'هل تنفذون مقاولات عامة؟', a: 'نعم، إشراف هندسي وعمالة للمشاريع. تفاصيل المشروع تُناقَش مع الموظف المختص.' },
  // ── نصائح أولية آمنة
  { cat: 'instructions', q: 'المكيف لا يبرّد، ماذا أفعل قبل وصول الفني؟', a: 'تأكد من إعداد التبريد ودرجة الحرارة، نظّف الفلتر إن كان متسخًا، وتأكد أن الوحدة الخارجية تعمل. إن استمر العطل أو سمعت صوتًا غريبًا فأطفئه واطلب الفني.' },
  { cat: 'instructions', q: 'المكيف يقطّر ماء من الداخل، ما السبب؟', a: 'غالبًا انسداد في مصرف التكثيف أو اتساخ الفلتر. أطفئ المكيف حتى لا يتضرر الجدار واطلب الصيانة.' },
  { cat: 'instructions', q: 'يوجد تسريب مياه، ماذا أفعل أولًا؟', a: 'أغلق المحبس الرئيسي للمياه أو محبس الجهاز المتسرب، وأبعد الأجهزة الكهربائية عن الماء، ثم اطلب السباك.' },
  { cat: 'instructions', q: 'القاطع الكهربائي ينزل باستمرار، ماذا أفعل؟', a: 'افصل الأجهزة عن الأفياش وأعد القاطع، فإن نزل ثانية فلا تكرر المحاولة واطلب الكهربائي، لأن السبب قد يكون ماسًا أو حملًا زائدًا.' },
  { cat: 'instructions', q: 'رائحة غاز في البيت، ماذا أفعل؟', a: 'لا تشغّل أي مفتاح كهرباء ولا تشعل نارًا، افتح النوافذ، أغلق محبس الغاز، واخرج من المكان ثم اتصل بالدفاع المدني 998.' },
  { cat: 'instructions', q: 'السخان لا يسخّن أو يقطر ماء، ماذا أفعل؟', a: 'افصل الكهرباء عن السخان وأغلق محبس الماء عنه، ثم اطلب سباكًا أو فني سخانات. لا تفتح الجهاز بنفسك.' },
  { cat: 'instructions', q: 'الثلاجة توقفت عن التبريد، ماذا أفعل؟', a: 'تأكد من التوصيل وأن الباب مغلق جيدًا، ولا تفتحها كثيرًا للحفاظ على البرودة، وانقل الأطعمة الحساسة مؤقتًا واطلب فني التبريد.' },
  // ── سياسات وإجراءات
  { cat: 'policies', q: 'هل تتواصلون قبل الوصول؟', a: 'نعم، يتواصل الفني أو الفريق معك قبل الوصول، وتتابع حالة الفني من صفحة الطلب.' },
  { cat: 'policies', q: 'ماذا لو لم أكن موجودًا وقت وصول الفني؟', a: 'أبلغنا مسبقًا لنعيد الجدولة. وجود شخص مخوّل في الموقع أو فتح الموقع للفني يختصر الوقت.' },
  { cat: 'policies', q: 'هل يمكن اختيار الفني؟', a: 'التوزيع يتم تلقائيًا حسب القرب والتفرغ والجودة. إن كانت لديك ملاحظة على فني معين فاكتبها وسأرفعها للإدارة.' },
  { cat: 'policies', q: 'هل بياناتي آمنة؟', a: 'نستخدم بياناتك لخدمة طلباتك فقط ولا تُعرض لعملاء آخرين. لا ترسل كلمات المرور أو بيانات البطاقة داخل المحادثة.' },
  { cat: 'policies', q: 'هل يطلب الفنيون مبالغ خارج التطبيق؟', a: 'لا تدفع أي مبلغ غير معتمد في الطلب. السعر والدفع يتمان عبر الطلب أو رابط الدفع الرسمي، وأي طلب مخالف أبلغ عنه فورًا.' },
  { cat: 'policies', q: 'ماذا لو لم أكن راضيًا عن الخدمة؟', a: 'أخبرني بما حدث وسأحوّلك للموظف المختص مع تفاصيل الطلب لمعالجته وفق سياسة الضمان.' },
  // ── الحساب والتطبيق
  { cat: 'procedures', q: 'كيف أسجّل في التطبيق؟', a: 'برقم الجوال وكلمة مرور، وتبقى جلستك محفوظة على جهازك. يمكنك أيضًا تثبيت التطبيق على الشاشة الرئيسية.' },
  { cat: 'procedures', q: 'نسيت كلمة المرور، ماذا أفعل؟', a: 'اطلب مساعدة الموظف وسيرتّب معك إعادة التعيين بعد التحقق من هويتك. لا تكتب كلمة المرور في المحادثة.' },
  { cat: 'procedures', q: 'كيف أثبّت التطبيق على جوالي؟', a: 'من المتصفح اختر «إضافة إلى الشاشة الرئيسية» أو زر «تحميل التطبيق» في الصفحة الرئيسية.' },
  { cat: 'procedures', q: 'كيف أنضم كفني؟', a: 'من صفحة «انضم كفني» في التطبيق أرسل بياناتك وتخصصك، وتراجعها الإدارة وتتواصل معك.' },
  { cat: 'procedures', q: 'كيف أرسل صورًا للمشكلة؟', a: 'أرفق صورة أو فيديو قصيرًا عند تفاصيل الطلب أو أرسلها للموظف على واتساب، فهذا يساعد في تقدير العمل بدقة.' },
  { cat: 'procedures', q: 'كيف أطلب خدمة عاجلة؟', a: 'اذكر أن الحالة عاجلة عند الطلب أو اضغط «طلب خدمة فورية». الأولوية والرسوم الإضافية إن وُجدت تظهر لك في السعر قبل التأكيد.' },
  { cat: 'procedures', q: 'هل أستطيع الطلب لشخص آخر أو لموقع آخر؟', a: 'نعم، اكتب عنوان الموقع واسم وجوال المسؤول عن الاستقبال في الطلب.' },
  // ── الدفع والفواتير
  { cat: 'payment', q: 'هل يمكن الدفع بعد التنفيذ؟', a: 'طرق وتوقيت الدفع تظهر في الطلب. إن لم تظهر لك طريقة مناسبة فسأحوّلك للموظف.' },
  { cat: 'payment', q: 'هل تقبلون الدفع بالتحويل أو الرابط؟', a: 'قد يرسل لك الفريق رابط دفع رسمي أو تفاصيل التحويل المعتمدة داخل الطلب. لا تحوّل لأي حساب لم يصلك من القنوات الرسمية.' },
  { cat: 'payment', q: 'أحتاج فاتورة باسم شركة، هل يمكن؟', a: 'نعم، أرسل اسم المنشأة والرقم الضريبي للموظف قبل إصدار الفاتورة.' },
  { cat: 'payment', q: 'هل يوجد استرداد للمبلغ؟', a: 'قرارات الاسترداد يعتمدها الموظف المختص بحسب الحالة وسياسة الضمان، وسأحوّل طلبك له.' },
  // ── ساعات العمل والتواصل
  { cat: 'hours', q: 'متى تعملون؟', a: 'أوقات العمل والخدمة العاجلة يؤكدها لك الموظف أو تظهر في المواعيد المتاحة أثناء الطلب. لا أعطي موعدًا غير مؤكد.' },
  { cat: 'hours', q: 'كيف أتواصل مع موظف؟', a: 'اطلب «موظف» هنا وسأحوّل المحادثة، أو استخدم أزرار واتساب والاتصال المتاحة في الموقع.' },
  { cat: 'areas', q: 'هل تغطون أحياء جدة ومكة كلها؟', a: 'نغطي أغلب الأحياء في المدينتين. اكتب اسم حيّك وسأتأكد من التغطية مع الإدارة إن لم تكن واضحة.' },
  { cat: 'areas', q: 'هل تخدمون خارج مكة وجدة؟', a: 'حاليًا نخدم مكة المكرمة وجدة. للمناطق الأخرى اطلب موظفًا لدراسة الإمكانية.' },
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
