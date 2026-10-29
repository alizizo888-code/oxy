import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronRight, Power, Cpu, Mic, BookOpen, Tag, Handshake, UserPlus, ClipboardCheck, BellRing,
  Headset, MessageCircle, ShieldCheck, ScrollText, BarChart3, Plus, Trash2, Save, Loader2, RefreshCw, ArrowLeft,
  Siren, MapPinned, LocateFixed, CreditCard, Gauge, AudioLines, Speaker, BadgePercent, Lock, Crown, Wallet,
} from 'lucide-react'
import { AI_PROVIDERS, STT_PROVIDERS, TTS_PROVIDERS, AI_PERMISSIONS } from '../aiAdapter'
import { OWNER_ONLY_KEYS } from '../hooks/useAiSettings'
import { payments } from '../lib/payments'
import { triggers } from '../lib/triggers'
import { maps } from '../lib/maps'
import { ESCALATION_REASONS } from '../workflow'
import { useTeamRole } from '../hooks/useTeamRole'
import { useAiSettings } from '../hooks/useAiSettings'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { whatsapp } from '../lib/whatsapp'
import { DIALECTS, VOICES, KB_CATEGORIES, kbCategoryLabel } from '../mutqanAi'
import { NEGOTIATION_STAGES, NEGOTIATION_STYLES } from '../pricing'
import { specialtyLabel } from '../constants'

const SECTIONS = [
  { id: 'status', label: 'حالة الذكاء الاصطناعي', icon: Power },
  { id: 'providers', label: 'مزوّد AI والنماذج', icon: Cpu },
  { id: 'stt', label: 'تحويل الكلام إلى نص', icon: AudioLines },
  { id: 'voice', label: 'مزوّد الصوت والنطق', icon: Speaker },
  { id: 'kb', label: 'قاعدة المعرفة', icon: BookOpen },
  { id: 'pricing', label: 'التسعير', icon: Tag },
  { id: 'negotiation', label: 'التفاوض', icon: Handshake },
  { id: 'discounts', label: 'قواعد الخصم', icon: BadgePercent },
  { id: 'payment', label: 'الدفع', icon: CreditCard },
  { id: 'confidence', label: 'الثقة وسياسة الرد', icon: Gauge },
  { id: 'registration', label: 'تسجيل العملاء', icon: UserPlus },
  { id: 'conversion', label: 'تحويل المحادثة لطلب', icon: ClipboardCheck },
  { id: 'followup', label: 'المتابعة', icon: BellRing },
  { id: 'escalation', label: 'التصعيد', icon: Siren },
  { id: 'location', label: 'الموقع والتتبع', icon: MapPinned },
  { id: 'handoff', label: 'التحويل لموظف', icon: Headset },
  { id: 'whatsapp', label: 'واتساب', icon: MessageCircle },
  { id: 'permissions', label: 'الصلاحيات', icon: ShieldCheck },
  { id: 'privacy', label: 'الخصوصية والأمان', icon: Lock },
  { id: 'logs', label: 'السجلات', icon: ScrollText },
  { id: 'analytics', label: 'التحليلات', icon: BarChart3 },
]

const ACTION_LABELS = {
  none: 'سؤال عام', collect: 'جمع بيانات', ready_to_order: 'جاهز للطلب', register: 'تسجيل', track: 'تتبع طلب',
  handoff: 'طلب موظف', calculator: 'حاسبة', negotiate: 'تفاوض', location: 'طلب الموقع', pay: 'دفع',
}
export { ACTION_LABELS }

export default function AiSettings() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { settings, update } = useAiSettings()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => (SECTIONS.some((s) => s.id === params.get('tab')) ? params.get('tab') : 'status'))
  const [error, setError] = useState('')

  const allowed = isOwner || role === 'operations'
  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <Centered>هذه الصفحة للمالك ومشرف العمليات فقط</Centered>

  const save = async (patch) => {
    setError('')
    if (!isOwner && Object.keys(patch).some((k) => OWNER_ONLY_KEYS.includes(k))) {
      setError('هذا الإعداد من سياسات المالك — يعدّله المالك فقط')
      return
    }
    try { await update(patch) } catch { setError('تعذر حفظ الإعداد — تأكد من صلاحياتك') }
  }
  const S = settings

  return (
    <div className="h-full flex flex-col bg-[#090c14]" dir="rtl">
      <header className="shrink-0 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <div className="flex-1">
            <p className="text-[11px] text-primary font-bold tracking-widest">MUTQAN AI</p>
            <h1 className="font-display text-lg font-black text-white">إعدادات الذكاء الاصطناعي</h1>
          </div>
          {isOwner && (
            <button onClick={() => navigate('/staff/ai-owner')} className="shrink-0 flex items-center gap-1 bg-amber-500/15 border border-amber-400/40 rounded-xl px-2.5 py-1.5 text-[10px] font-black text-amber-300 hover:bg-amber-500/25">
              <Crown size={12} /> رقابة المالك
            </button>
          )}
          <button onClick={() => navigate('/staff/payment-methods')} className="shrink-0 hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/10">
            <Wallet size={12} /> طرق الدفع
          </button>
          <span className={`text-[10px] font-black rounded-full px-2.5 py-1 ${S.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
            {S.enabled ? 'يعمل' : 'متوقف'}
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row max-w-6xl mx-auto w-full">
        <nav className="shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:w-60 px-4 md:px-3 py-3 md:border-l border-white/10">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setTab(s.id)}
                className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tab === s.id ? 'bg-primary/15 text-white' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <Icon size={14} className={tab === s.id ? 'text-primary' : ''} />
                {s.label}
              </button>
            )
          })}
        </nav>

        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-24">
          {error && <p className="text-rose-400 text-xs font-bold mb-3">{error}</p>}

          {tab === 'status' && (
            <Card title="حالة المساعد">
              <Toggle label="تشغيل MUTQAN AI للعملاء" sub="عند الإيقاف يظهر للعميل خيار التحويل لموظف فقط" on={S.enabled} onChange={(v) => save({ enabled: v })} />
              <TextSetting label="رسالة الترحيب (اختيارية)" value={S.greeting} placeholder="اتركها فارغة لاستخدام الترحيب الافتراضي" onSave={(v) => save({ greeting: v })} />
            </Card>
          )}

          {tab === 'providers' && (
            <Card title="مزوّد الذكاء الاصطناعي والنماذج (AI Provider Adapter)">
              <OwnerNote isOwner={isOwner} />
              <p className="text-xs font-bold text-slate-300 mb-2">المزوّد النشط</p>
              <Choice options={Object.values(AI_PROVIDERS).map((p) => ({ id: p.id, label: p.label }))} value={S.providers.ai} onChange={(v) => save({ providers: { ...S.providers, ai: v } })} />
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">النموذج</p>
              <Choice options={(AI_PROVIDERS[S.providers.ai] || AI_PROVIDERS.platform).models} value={S.providers.aiModel} onChange={(v) => save({ providers: { ...S.providers, aiModel: v } })} />
              <Info label="المصادقة" value="من الخادم — لا يوجد أي مفتاح في التطبيق" />
              <Info label="عند تعطّل المزوّد" value="يستمر النظام: طلب مباشر + تحويل لموظف" />
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">كل استدعاءات الذكاء الاصطناعي تمر عبر طبقة محوّل واحدة، لذلك يمكن إضافة مزوّد جديد مستقبلًا دون تغيير باقي النظام. حاليًا المزوّد المتاح هو مزوّد المنصة المُدار.</p>
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">أسلوب الردود</p>
              <Choice options={[{ id: 'friendly', label: 'ودّي' }, { id: 'formal', label: 'رسمي' }, { id: 'energetic', label: 'حماسي' }]} value={S.tone} onChange={(v) => save({ tone: v })} />
            </Card>
          )}

          {tab === 'stt' && (
            <Card title="تحويل الكلام إلى نص (Speech Provider Adapter)">
              <OwnerNote isOwner={isOwner} />
              <p className="text-xs font-bold text-slate-300 mb-2">المزوّد</p>
              <Choice options={Object.values(STT_PROVIDERS).map((p) => ({ id: p.id, label: p.label }))} value={S.providers.stt} onChange={(v) => save({ providers: { ...S.providers, stt: v } })} />
              <Info label="اللغة" value="العربية بلهجاتها (تلقائي)" />
              <Toggle label="تشغيل الرسائل الصوتية والرد الصوتي" sub="سياسة عامة للمالك — عند الإيقاف يختفي زر الميكروفون والاستماع" on={S.globalPolicy.voiceEnabled !== false} onChange={(v) => save({ globalPolicy: { ...S.globalPolicy, voiceEnabled: v } })} />
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">إذا تعطّل تحويل الصوت يُطلب من العميل الكتابة، وتستمر المحادثة والطلبات بشكل طبيعي.</p>
            </Card>
          )}

          {tab === 'voice' && (
            <Card title="مزوّد الصوت — تحويل النص إلى كلام (TTS Provider Adapter)">
              <p className="text-xs font-bold text-slate-300 mb-2">المزوّد</p>
              <Choice options={Object.values(TTS_PROVIDERS).map((p) => ({ id: p.id, label: p.label }))} value={S.providers.tts} onChange={(v) => save({ providers: { ...S.providers, tts: v } })} />
              <p className="text-xs font-bold text-slate-400 mt-4 mb-2">الافتراضي لكل عميل جديد</p>
              <p className="text-xs font-bold text-slate-300 mb-2">اللهجة</p>
              <Choice options={DIALECTS} value={S.defaultDialect} onChange={(v) => save({ defaultDialect: v })} />
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">الصوت</p>
              <Choice options={VOICES} value={S.defaultVoice} onChange={(v) => save({ defaultVoice: v })} />
              <div className="mt-4">
                <Toggle label="الرد الصوتي التلقائي افتراضيًا" sub="يستطيع العميل تغييره من إعداداته" on={S.autoSpeakDefault} onChange={(v) => save({ autoSpeakDefault: v })} />
              </div>
            </Card>
          )}

          {tab === 'kb' && <KnowledgeBase faq={S.faq} onSave={(faq) => save({ faq })} />}

          {tab === 'pricing' && (
            <Card title="التسعير">
              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">المساعد لا يخترع السعر: كل رقم يذكره يأتي من محرك أسعار مُتقن حسب القواعد التي تحددها لكل خدمة.</p>
              <Toggle label="عرض تفصيل السعر للعميل" sub="الخدمة + الزيارة + العاجل + الإضافات" on={S.pricing.showBreakdown} onChange={(v) => save({ pricing: { ...S.pricing, showBreakdown: v } })} />
              <button onClick={() => navigate('/staff/pricing')} className="mt-3 w-full flex items-center justify-between bg-primary/15 border border-primary/40 rounded-xl px-4 py-3 text-sm font-bold text-white">
                فتح قواعد التسعير لكل خدمة <ArrowLeft size={16} className="text-primary" />
              </button>
            </Card>
          )}

          {tab === 'negotiation' && (
            <Card title="خطة التفاوض">
              <Toggle label="السماح للمساعد بالتفاوض" sub="لا ينزل أبدًا تحت الحد الأدنى المسموح لكل خدمة" on={S.negotiation.enabled} onChange={(v) => save({ negotiation: { ...S.negotiation, enabled: v } })} />
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">المراحل بالترتيب</p>
              <div className="flex flex-col gap-1.5">
                {NEGOTIATION_STAGES.map((st, i) => (
                  <Toggle
                    key={st.id}
                    label={`المرحلة ${i + 1}: ${st.label}`}
                    sub={st.hint}
                    on={S.negotiation.stages[st.id]}
                    onChange={(v) => save({ negotiation: { ...S.negotiation, stages: { ...S.negotiation.stages, [st.id]: v } } })}
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">أسلوب الحوار</p>
              <Choice options={NEGOTIATION_STYLES} value={S.negotiation.style || 'balanced'} onChange={(v) => save({ negotiation: { ...S.negotiation, style: v } })} />
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">عدد خطوات الخصم المحدود</p>
              <Choice options={[1, 2, 3, 4].map((x) => ({ id: x, label: String(x) }))} value={S.negotiation.discountSteps} onChange={(v) => save({ negotiation: { ...S.negotiation, discountSteps: v } })} />
              <p className="text-[11px] text-slate-500 mt-3">مثال لخدمة 500 ر.س وحدها الأدنى 450 مع خطوتين: 500 ← شرح الخدمة ← 490 ← 475 ← 450 ← موظف. عدد محاولات التفاوض والحد الأدنى يُضبطان لكل خدمة من «قواعد التسعير».</p>
            </Card>
          )}

          {tab === 'discounts' && (
            <Card title="قواعد الخصم">
              <OwnerNote isOwner={isOwner} />
              <NumSetting label="الحد الأقصى العام للخصم (%) — سياسة المالك" value={S.globalPolicy.maxDiscountPct} onSave={(v) => save({ globalPolicy: { ...S.globalPolicy, maxDiscountPct: Math.min(90, v) } })} />
              <div className="mt-3">
                <Toggle label="السماح بالتفاوض على مستوى النظام" sub="عند الإيقاف لا يقدّم المساعد أي خصم لأي خدمة" on={S.globalPolicy.negotiationAllowed !== false} onChange={(v) => save({ globalPolicy: { ...S.globalPolicy, negotiationAllowed: v } })} />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">أدنى سعر يصل إليه المساعد = الأعلى بين (الحد الأدنى للخدمة) و (السعر بعد الأقل بين حد خصم الخدمة والحد العام). المساعد لا يستطيع تجاوز هذه الحدود.</p>
              <button onClick={() => navigate('/staff/pricing')} className="mt-3 w-full flex items-center justify-between bg-primary/15 border border-primary/40 rounded-xl px-4 py-3 text-sm font-bold text-white">
                حد الخصم ومحاولات التفاوض لكل خدمة <ArrowLeft size={16} className="text-primary" />
              </button>
            </Card>
          )}

          {tab === 'payment' && <PaymentSettings S={S} save={save} />}

          {tab === 'confidence' && (
            <Card title="الثقة وسياسة الرد">
              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">كل رد يُسجَّل داخليًا مع درجة الثقة والإجراء المقترح ومصدر البيانات. القرارات الحساسة (إنشاء طلب، تفاوض، دفع، تتبع) لا تُنفَّذ عند انخفاض الثقة.</p>
              <Toggle label="حماية القرارات الحساسة" sub="عند الثقة المنخفضة يطلب المساعد توضيحًا أو يعرض التحويل لموظف" on={S.confidence.guardSensitive} onChange={(v) => save({ confidence: { ...S.confidence, guardSensitive: v } })} />
              <p className="text-xs font-bold text-slate-300 mt-3 mb-2">الحد الأدنى للثقة</p>
              <Choice options={[0.4, 0.5, 0.6, 0.7, 0.8].map((x) => ({ id: x, label: `${Math.round(x * 100)}%` }))} value={S.confidence.threshold} onChange={(v) => save({ confidence: { ...S.confidence, threshold: v } })} />
              <p className="text-xs font-bold text-slate-300 mt-4 mb-2">ممنوع على المساعد اختراع</p>
              <div className="flex flex-wrap gap-1.5">
                {['السعر', 'الخصم', 'مدة الوصول', 'حالة الفني', 'حالة الدفع', 'حالة الطلب', 'الضمان', 'المخزون'].map((t) => <Chip key={t} tone="text-rose-300">{t}</Chip>)}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">المصادر المسموحة: محرك الأسعار، طلبات العميل نفسه، بيانات التتبع، نظام الدفع، قاعدة المعرفة. لا توجد بيانات مخزون في النظام حاليًا، لذلك لا يؤكد المساعد توفر أي قطعة.</p>
            </Card>
          )}

          {tab === 'registration' && (
            <Card title="تسجيل العملاء">
              <Info label="طريقة التسجيل" value="دخول بضغطة (Google / Apple) ثم الاسم والجوال ثم الموقع تلقائيًا — المساعد لا يطلب البريد" />
              <Info label="تسجيل الفنيين" value="نفس الطريقة + التخصصات، ويُفعّل الحساب بعد موافقة الإدارة" />
              <Info label="موافقة العميل" value="إلزامية قبل إنشاء الحساب" />
              <Info label="صلاحية الموقع" value="تُطلب من العميل ولا تُفرض" />
              <div className="mt-3">
                <Toggle label="السماح بالدخول بالبصمة / Passkey" sub="يفعّله العميل من «حسابي» بعد التوثيق، على الأجهزة الداعمة" on={S.registration.passkeyEnabled} onChange={(v) => save({ registration: { ...S.registration, passkeyEnabled: v } })} />
              </div>
            </Card>
          )}

          {tab === 'conversion' && (
            <Card title="تحويل المحادثة إلى طلب">
              <Info label="بطاقة تأكيد الطلب" value="إلزامية — الطلب لا يُنشأ إلا بضغط العميل «تأكيد»" />
              <Toggle label="السماح بالطلب العاجل من المحادثة" sub="يضيف رسوم الطوارئ المحددة في التسعير" on={S.orderConversion.allowUrgent} onChange={(v) => save({ orderConversion: { ...S.orderConversion, allowUrgent: v } })} />
            </Card>
          )}

          {tab === 'followup' && (
            <div className="flex flex-col gap-4">
              <Card title="رسائل المتابعة حسب حالة الطلب">
                {['تم استلام طلبك.', 'تم قبول طلبك بواسطة الفني.', 'الفني في الطريق.', 'وصل الفني إلى موقعك.', 'هل تمت الخدمة بالشكل المطلوب؟', 'تم تسجيل الدفع.'].map((t) => (
                  <p key={t} className="text-[11px] text-slate-300 py-1 border-b border-white/5 last:border-0">• {t}</p>
                ))}
                <div className="mt-3">
                  <Toggle label="إظهار رسائل المتابعة داخل محادثة العميل" sub="مع سؤال «هل تمت الخدمة؟» — «لا» تحوّل العميل لموظف كشكوى" on={S.followUp.statusMessages} onChange={(v) => save({ followUp: { ...S.followUp, statusMessages: v } })} />
                  <Toggle label="متابعة الطلبات النشطة عند السؤال" sub="يعرض المساعد حالة الطلب واسم الفني" on={S.followUp.showActiveOnGreeting} onChange={(v) => save({ followUp: { ...S.followUp, showActiveOnGreeting: v } })} />
                </div>
              </Card>
              <ServerFollowUp enabled={S.followUp.serverPush} onChange={(v) => save({ followUp: { ...S.followUp, serverPush: v } })} />
              <Card title="الأتمتة حسب الوقت ورد العميل وحالة الفني">
                <Toggle label="تذكير العميل إذا لم يؤكد طلبه" sub="إشعار بعد المدة المحددة إذا ترك بطاقة الطلب دون تأكيد" on={S.followUp.remindCustomer} onChange={(v) => save({ followUp: { ...S.followUp, remindCustomer: v } })} />
                <NumSetting label="مهلة رد العميل (دقيقة)" value={S.followUp.customerNoReplyMin} onSave={(v) => save({ followUp: { ...S.followUp, customerNoReplyMin: v } })} />
                <div className="mt-3">
                  <Toggle label="تصعيد إذا لم يقبل الفني" sub="تنبيه غرفة العمليات بجرس ووضع الطلب في قائمة التصعيدات" on={S.followUp.escalateOnNoAccept} onChange={(v) => save({ followUp: { ...S.followUp, escalateOnNoAccept: v } })} />
                  <NumSetting label="مهلة قبول الفني (دقيقة)" value={S.followUp.techAcceptMin} onSave={(v) => save({ followUp: { ...S.followUp, techAcceptMin: v } })} />
                </div>
                <div className="mt-3">
                  <Toggle label="تنبيه العمليات عند تأخر الفني" sub="إذا بقي الطلب «مقبول» أو «في الطريق» أكثر من المدة المحددة" on={S.followUp.notifyOpsOnLate} onChange={(v) => save({ followUp: { ...S.followUp, notifyOpsOnLate: v } })} />
                  <NumSetting label="حد التأخير (دقيقة)" value={S.followUp.techLateMin} onSave={(v) => save({ followUp: { ...S.followUp, techLateMin: v } })} />
                </div>
                <p className="text-[11px] text-amber-400/80 mt-3 leading-relaxed">فحص مهلة القبول والتأخير يعمل أثناء فتح غرفة العمليات على أي جهاز للإدارة. تذكير العميل يُرسل من الخادم إذا فعّل الإشعارات.</p>
              </Card>
            </div>
          )}

          {tab === 'escalation' && (
            <Card title="متى يتوقف المساعد ويحوّل لموظف">
              {ESCALATION_REASONS.map((r) => (
                <Toggle
                  key={r.id}
                  label={r.label}
                  on={S.escalation.reasons[r.id]}
                  onChange={(v) => save({ escalation: { ...S.escalation, reasons: { ...S.escalation.reasons, [r.id]: v } } })}
                />
              ))}
              <NumSetting label="عميل عالي القيمة: قيمة الطلب من (ر.س)" value={S.escalation.highValueAmount} onSave={(v) => save({ escalation: { ...S.escalation, highValueAmount: v } })} />
              <NumSetting label="أو عدد طلباته السابقة من" value={S.escalation.highValueOrders} onSave={(v) => save({ escalation: { ...S.escalation, highValueOrders: v } })} />
              <NumSetting label="تعثّر متكرر: عدد المحاولات الفاشلة" value={S.escalation.failureLimit} onSave={(v) => save({ escalation: { ...S.escalation, failureLimit: v } })} />
              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">الشكاوى والاسترداد والمسائل القانونية ومشاكل الدفع والعمليات الحساسة تصل بأولوية عالية. العميل عالي القيمة يُنشأ طلبه مع علامة تصعيد لغرفة العمليات.</p>
            </Card>
          )}

          {tab === 'location' && <ServiceAreaSettings S={S} save={save} />}

          {tab === 'handoff' && (
            <Card title="التحويل إلى موظف">
              <Toggle label="إظهار زر «تحويل إلى موظف»" on={S.handoff.enabled} onChange={(v) => save({ handoff: { ...S.handoff, enabled: v } })} />
              <Toggle label="عرض التحويل تلقائيًا عند انتهاء التفاوض" sub="بعد الوصول للمرحلة الأخيرة من خطة التفاوض" on={S.handoff.offerAfterNegotiation} onChange={(v) => save({ handoff: { ...S.handoff, offerAfterNegotiation: v } })} />
              <p className="text-[11px] text-slate-500 mt-2">المحادثات المحوّلة تصل إلى غرفة العمليات مع ملخص الذكاء الاصطناعي والسعر والموقع والمحادثة كاملة.</p>
            </Card>
          )}

          {tab === 'whatsapp' && <WhatsAppStatus />}

          {tab === 'permissions' && (
            <div className="flex flex-col gap-4">
            <Card title="صلاحيات MUTQAN AI">
              <OwnerNote isOwner={isOwner} />
              {AI_PERMISSIONS.map((p) => p.locked ? (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-1.5">
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-white">{p.label}</span>
                    <span className="block text-[10px] text-slate-500 font-mono" dir="ltr">{p.id}</span>
                  </span>
                  <Lock size={14} className="text-rose-400 shrink-0" />
                </div>
              ) : (
                <Toggle key={p.id} label={p.label} sub={p.id} on={S.permissions[p.id] !== false} onChange={(v) => save({ permissions: { ...S.permissions, [p.id]: v } })} />
              ))}
            </Card>
            <Card title="ما لا يستطيع المساعد فعله أبدًا">
              {['تجاوز تسجيل الدخول بالحساب', 'تجاوز صلاحيات الموقع أو الحساب', 'إنشاء طلب دون تأكيد وموافقة العميل', 'اختراع سعر أو خصم خارج محرك الأسعار', 'النزول تحت الحد الأدنى للسعر', 'إعلان نجاح دفع قبل تأكيد مزود الدفع', 'تعديل أي مبلغ مدفوع', 'الرد التلقائي على واتساب', 'الوصول لبيانات عميل آخر', 'اختراع وقت وصول الفني', 'نقل الطلب لغير غرفة العمليات', 'إسناد فني دون قواعد التوزيع وموافقته'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-xs text-slate-300 py-1.5 border-b border-white/5 last:border-0">
                  <ShieldCheck size={13} className="text-rose-400 shrink-0" /> {t}
                </div>
              ))}
              <p className="text-[11px] text-slate-500 mt-3">حفظ الإعدادات محمي من الخادم للإدارة فقط، وكل تغيير يُسجّل في سجل التدقيق.</p>
            </Card>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="flex flex-col gap-4">
              <Card title="الخصوصية">
                <OwnerNote isOwner={isOwner} />
                <Toggle label="موافقة إلزامية قبل أول رسالة صوتية" sub="تُسجّل موافقة العميل ويستطيع سحبها من صفحة الخصوصية" on={S.privacy.voiceConsentRequired} onChange={(v) => save({ privacy: { ...S.privacy, voiceConsentRequired: v } })} />
                <NumSetting label="مدة الاحتفاظ بالمحادثات والسجلات (يوم)" value={S.privacy.retentionDays} onSave={(v) => save({ privacy: { ...S.privacy, retentionDays: Math.min(365, Math.max(1, v)) } })} />
                <PrivacyNotice value={S.privacy.notice} onSave={(v) => save({ privacy: { ...S.privacy, notice: v } })} />
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">الرسائل الجديدة تُحذف تلقائيًا بعد المدة المحددة. العميل يستطيع حذف محادثاته بنفسه من «المزيد ← الخصوصية».</p>
              </Card>
              <Card title="الأمان">
                <Info label="مفاتيح الذكاء الاصطناعي" value="من الخادم فقط — لا توجد في التطبيق" />
                <Info label="مفاتيح الدفع وواتساب" value="مخزّنة مشفّرة من الخادم" />
                <Info label="كلمات مرور الفريق" value="لا تُخزّن في الكود" />
                <Info label="البصمة / الوجه" value="لا تُخزّن — Passkeys فقط" />
                <Info label="سجل التدقيق" value="كل تغيير في الإعدادات مسجّل" />
              </Card>
            </div>
          )}

          {tab === 'logs' && <Logs enabled={S.logging.enabled} onToggle={(v) => save({ logging: { ...S.logging, enabled: v } })} />}
          {tab === 'analytics' && <Analytics />}
        </main>
      </div>
    </div>
  )
}

const FOLLOWUP_TRIGGERS = [
  { when: { status: 'accepted' }, title: 'MUTQAN · تم قبول طلبك', body: 'تم قبول طلبك بواسطة الفني {{technicianName}}.' },
  { when: { status: 'en_route' }, title: 'MUTQAN · الفني في الطريق', body: 'الفني في الطريق.' },
  { when: { status: 'arrived' }, title: 'MUTQAN · وصل الفني', body: 'وصل الفني إلى موقعك.' },
  { when: { status: 'completed' }, title: 'MUTQAN · اكتملت الخدمة', body: 'هل تمت الخدمة بالشكل المطلوب؟' },
  { when: { paymentStatus: 'paid' }, title: 'MUTQAN · تم تسجيل الدفع', body: 'تم تسجيل الدفع.' },
]

// Server-side follow-up pushes (fire even when nobody has the app open). Owner-only.
function ServerFollowUp({ enabled, onChange }) {
  const { isOwner } = useTeamRole()
  const [mine, setMine] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function refresh() {
    try {
      const list = await triggers.list()
      setMine((list || []).filter((t) => String(t.config?.title || '').startsWith('MUTQAN ·')))
    } catch { setMine([]) }
  }
  useEffect(() => { if (isOwner) refresh() }, [isOwner])
  async function turnOn() {
    setBusy(true); setErr('')
    try {
      const existing = new Set((mine || []).map((t) => t.config?.title))
      for (const t of FOLLOWUP_TRIGGERS) {
        if (existing.has(t.title)) continue
        await triggers.create({ collection: 'orders', on: ['update'], when: t.when, action: 'push', title: t.title, body: t.body, url: '#/orders', target: { rowOwner: true } })
      }
      await onChange(true)
      await refresh()
    } catch (e) {
      setErr(e?.code === 'TRIGGER_LIMIT' ? 'وصلت للحد الأقصى من المشغّلات التلقائية' : 'تعذر التفعيل — يجب أن تكون مسجّلًا كمالك')
    } finally { setBusy(false) }
  }
  async function turnOff() {
    setBusy(true); setErr('')
    try {
      for (const t of mine || []) await triggers.remove(t.id)
      await onChange(false)
      await refresh()
    } catch { setErr('تعذر الإيقاف') } finally { setBusy(false) }
  }
  return (
    <Card title="إشعارات المتابعة من الخادم">
      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">تصل للعميل فور تغيّر حالة طلبه حتى لو كان التطبيق مغلقًا (لمن فعّل الإشعارات على التطبيق المنشور).</p>
      <Info label="الحالة" value={enabled ? `مفعّلة${mine ? ` (${mine.length}/5)` : ''}` : 'غير مفعّلة'} />
      {isOwner ? (
        <button onClick={enabled ? turnOff : turnOn} disabled={busy} className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black disabled:opacity-50 ${enabled ? 'bg-white/5 border border-white/10 text-slate-300' : 'bg-primary text-black'}`}>
          {busy && <Loader2 size={15} className="animate-spin" />} {enabled ? 'إيقاف إشعارات الخادم' : 'تفعيل إشعارات الخادم'}
        </button>
      ) : (
        <p className="text-[11px] text-slate-500 mt-2">التفعيل متاح للمالك فقط.</p>
      )}
      {err && <p className="text-rose-400 text-xs font-bold mt-2">{err}</p>}
    </Card>
  )
}

function ServiceAreaSettings({ S, save }) {
  const sa = S.serviceArea
  const [locating, setLocating] = useState(false)
  async function setCenter() {
    setLocating(true)
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      await save({ serviceArea: { ...sa, lat, lng, enabled: true } })
    } catch { alert('تعذر الوصول للموقع') } finally { setLocating(false) }
  }
  return (
    <div className="flex flex-col gap-4">
      <Card title="نطاق الخدمة">
        <Toggle label="التحقق من نطاق الخدمة" sub="يخبر المساعد العميل إذا كان موقعه خارج النطاق ويُعلّم الطلب للعمليات" on={sa.enabled} onChange={(v) => save({ serviceArea: { ...sa, enabled: v } })} />
        <TextSetting label="اسم المنطقة (مثل: الرياض)" value={sa.name} onSave={(v) => save({ serviceArea: { ...sa, name: v } })} />
        <NumSetting label="نصف القطر (كم)" value={sa.radiusKm} onSave={(v) => save({ serviceArea: { ...sa, radiusKm: v } })} />
        <button onClick={setCenter} disabled={locating} className="mt-3 w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-3 text-sm font-bold text-slate-200 disabled:opacity-50">
          {locating ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />} {sa.lat != null ? 'تحديث مركز النطاق من موقعي' : 'تحديد مركز النطاق من موقعي'}
        </button>
        {sa.lat != null && <p className="text-[11px] text-emerald-400 mt-1.5">✓ تم تحديد مركز النطاق</p>}
      </Card>
      <Card title="التتبع">
        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">المساعد يقرأ آخر موقع فعلي أرسله جهاز الفني (المسافة ووقت التحديث) ولا يقدّر وقت الوصول أبدًا.</p>
        <NumSetting label="اعتبار الموقع قديمًا بعد (دقيقة)" value={S.tracking.staleMinutes} onSave={(v) => save({ tracking: { ...S.tracking, staleMinutes: v } })} />
      </Card>
    </div>
  )
}

function OwnerNote({ isOwner }) {
  if (isOwner) return null
  return <p className="text-[11px] font-bold text-amber-400/90 bg-amber-500/10 rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5"><Crown size={12} /> سياسة يحددها المالك — للعرض فقط</p>
}

function PrivacyNotice({ value, onSave }) {
  const [v, setV] = useState(value || '')
  useEffect(() => setV(value || ''), [value])
  return (
    <div className="mt-3">
      <label className="block text-[11px] font-bold text-slate-400 mb-1">إشعار الخصوصية الظاهر للعملاء</label>
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={4} className={`${inputCls} resize-none`} placeholder="اكتب سياسة الخصوصية الخاصة بمنشأتك" />
      <button onClick={() => onSave(v)} className="mt-1.5 w-full rounded-xl bg-primary text-black text-xs font-black py-2">حفظ الإشعار</button>
    </div>
  )
}

function NumSetting({ label, value, onSave }) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  return (
    <div className="mt-2">
      <label className="block text-[11px] font-bold text-slate-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="number" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} className={`${inputCls} flex-1`} dir="ltr" />
        <button onClick={() => onSave(Math.max(0, Number(v) || 0))} className="px-3 rounded-xl bg-primary text-black text-xs font-black shrink-0">حفظ</button>
      </div>
    </div>
  )
}

function KnowledgeBase({ faq, onSave }) {
  const [items, setItems] = useState(faq)
  const [saving, setSaving] = useState(false)
  const [cat, setCat] = useState('all')
  useEffect(() => setItems(faq), [faq])
  const setItem = (i, k, v) => setItems((list) => list.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const counts = items.reduce((m, f) => ({ ...m, [f.cat || 'faq']: (m[f.cat || 'faq'] || 0) + 1 }), {})
  return (
    <Card title="MUTQAN AI Knowledge Base — قاعدة المعرفة">
      <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">معلومات معتمدة يجيب منها المساعد بدل الاختراع. الخدمات وأسعارها تُقرأ تلقائيًا من «قواعد التسعير»، وهنا تضيف الشرح والسياسات. حتى 80 معلومة.</p>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1">
        <button onClick={() => setCat('all')} className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${cat === 'all' ? 'bg-primary/20 text-white' : 'bg-white/5 text-slate-400'}`}>الكل ({items.length})</button>
        {KB_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${cat === c.id ? 'bg-primary/20 text-white' : 'bg-white/5 text-slate-400'}`}>{c.label} ({counts[c.id] || 0})</button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((f, i) => (cat !== 'all' && (f.cat || 'faq') !== cat) ? null : (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col gap-1.5">
            <select value={f.cat || 'faq'} onChange={(e) => setItem(i, 'cat', e.target.value)} className={`${inputCls} py-1.5 text-xs`}>
              {KB_CATEGORIES.map((c) => <option key={c.id} value={c.id} className="bg-slate-900">{c.label}</option>)}
            </select>
            <div className="flex gap-2">
              <input value={f.q} onChange={(e) => setItem(i, 'q', e.target.value)} placeholder="السؤال" className={`${inputCls} flex-1`} />
              <button onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0"><Trash2 size={14} /></button>
            </div>
            <textarea value={f.a} onChange={(e) => setItem(i, 'a', e.target.value)} rows={2} placeholder="الإجابة المعتمدة" className={`${inputCls} resize-none`} />
          </div>
        ))}
      </div>
      {items.length < 80 && (
        <button onClick={() => setItems((l) => [...l, { q: '', a: '', cat: cat === 'all' ? 'faq' : cat }])} className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-white/20 rounded-xl py-2.5 text-xs font-bold text-slate-400 hover:bg-white/5">
          <Plus size={14} /> إضافة معلومة{cat !== 'all' ? ` — ${kbCategoryLabel(cat)}` : ''}
        </button>
      )}
      <button
        onClick={async () => { setSaving(true); try { await onSave(items.filter((x) => x.q.trim() && x.a.trim())) } finally { setSaving(false) } }}
        disabled={saving}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-black font-black rounded-xl py-3 disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} حفظ قاعدة المعرفة
      </button>
    </Card>
  )
}

export function WhatsAppStatus() {
  const [connected, setConnected] = useState(null)
  useEffect(() => { whatsapp.isConnected().then(setConnected).catch(() => setConnected(false)) }, [])
  return (
    <Card title="واتساب">
      <Info label="حالة ربط رقم الأعمال" value={connected === null ? 'جارِ الفحص…' : connected ? 'متصل' : 'SETUP REQUIRED — غير متصل'} />
      <Info label="رد المساعد التلقائي على واتساب" value="غير متاح" />
      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
        حاليًا يستطيع العميل فتح محادثة واتساب مع المنشأة برسالة جاهزة. ربط المساعد نفسه بواتساب (استقبال الرسائل والرد عليها تلقائيًا) غير متاح في هذه المرحلة.
      </p>
    </Card>
  )
}

function PaymentSettings({ S, save }) {
  const [st, setSt] = useState(null)
  useEffect(() => { payments.status().then(setSt).catch(() => setSt({ available: false, connections: [] })) }, [])
  const active = (st?.connections || []).filter((c) => c.status === 'active')
  return (
    <Card title="الدفع وروابط الدفع">
      <Info label="الدفع الإلكتروني" value={st === null ? 'جارِ الفحص…' : st.available ? 'مفعّل — حساب الدفع متصل' : 'SETUP REQUIRED — أكمل بطاقة ربط حساب الدفع'} />
      <Info label="طرق الدفع المعروضة" value="تُدار من صفحة «طرق الدفع»" />
      {active.some((c) => c.mode === 'test') && <Info label="الوضع" value="تجريبي — لا تتحرك أموال حقيقية" />}

      <div className="mt-3">
        <Toggle label="زر «ادفع» داخل محادثة المساعد" sub="عند سؤال العميل «أدفع إزاي؟» يعرض المساعد طلباته غير المدفوعة مع رابط دفع" on={S.payment.aiPayButton} onChange={(v) => save({ payment: { ...S.payment, aiPayButton: v } })} />
      </div>
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">المبالغ تصل مباشرة لحساب الدفع الخاص بك. الطلب لا يُعلَم «مدفوع» إلا بعد تأكيد مزود الدفع، والمساعد لا يعلن نجاح الدفع قبل ذلك. العملة: ريال سعودي.</p>
    </Card>
  )
}

function Logs({ enabled, onToggle }) {
  const { data: logs, loading } = useLiveShared('ai_logs', { order: '-at', limit: 60 })
  return (
    <Card title="سجل نشاط المساعد">
      <Toggle label="تسجيل نشاط المحادثات" sub="نوع الطلب والمرحلة والسعر — مرئي للإدارة فقط" on={enabled} onChange={onToggle} />
      <div className="mt-3 flex flex-col gap-1.5">
        {loading ? (
          <p className="text-slate-500 text-xs text-center py-4">جارِ التحميل…</p>
        ) : logs.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-4">لا يوجد نشاط مسجّل بعد</p>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-white truncate">{l.customerName} {l.voice ? '🎙️' : ''}</p>
                <span className="text-[10px] text-slate-500 shrink-0" dir="ltr">{l.at ? new Date(l.at).toLocaleString('ar') : ''}</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{l.text}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <Chip>{ACTION_LABELS[l.action] || l.action}</Chip>
                {l.specialtyId && <Chip>{specialtyLabel(l.specialtyId)}</Chip>}
                {l.stage && <Chip tone="text-amber-400">{NEGOTIATION_STAGES.find((s) => s.id === l.stage)?.label}: {l.offer} ر.س</Chip>}
                {l.agreedPrice && <Chip tone="text-emerald-400">متفق: {l.agreedPrice} ر.س</Chip>}
                {l.confidence != null && <Chip tone={l.lowConfidence ? 'text-rose-400' : 'text-sky-300'}>ثقة {Math.round(l.confidence * 100)}%{l.lowConfidence ? ' — أُوقف الإجراء' : ''}</Chip>}
                {l.escalation && <Chip tone="text-orange-400">تصعيد</Chip>}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

function Analytics() {
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    setBusy(true)
    try {
      const [turns, voice, negotiations, aiOrders, handoffs, byAction] = await Promise.all([
        db.countShared('ai_logs'),
        db.countShared('ai_logs', { voice: true }),
        db.countShared('ai_logs', { action: 'negotiate' }),
        db.countShared('orders', { source: 'mutqan_ai' }),
        db.countShared('handoffs'),
        db.groupByShared('ai_logs', 'action', { limit: 10 }),
      ])
      setStats({ turns, voice, negotiations, aiOrders, handoffs, byAction: byAction || [] })
    } catch {
      setStats({ error: true })
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => { load() }, [])
  return (
    <Card title="التحليلات">
      <button onClick={load} disabled={busy} className="mb-3 flex items-center gap-1.5 text-xs font-bold text-primary">
        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> تحديث
      </button>
      {!stats ? (
        <p className="text-slate-500 text-xs text-center py-4">جارِ الحساب…</p>
      ) : stats.error ? (
        <p className="text-rose-400 text-xs text-center py-4">تعذر تحميل التحليلات</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <Stat label="رسائل مع المساعد" value={stats.turns} />
            <Stat label="رسائل صوتية" value={stats.voice} />
            <Stat label="جولات تفاوض" value={stats.negotiations} />
            <Stat label="طلبات من المساعد" value={stats.aiOrders} tone="text-emerald-400" />
            <Stat label="تحويلات لموظف" value={stats.handoffs} tone="text-amber-400" />
          </div>
          <p className="text-xs font-bold text-slate-300 mt-4 mb-2">توزيع نوايا العملاء</p>
          <div className="flex flex-col gap-1">
            {stats.byAction.map((b) => (
              <div key={b.key} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-slate-300">{ACTION_LABELS[b.key] || b.key}</span>
                <span className="text-white font-black">{b.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary'

function Card({ title, children }) {
  return (
    <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 fade-up">
      <h2 className="text-white font-bold text-sm mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Toggle({ label, sub, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-right hover:bg-white/[0.07] mb-1.5">
      <span className="min-w-0">
        <span className="block text-xs font-bold text-white">{label}</span>
        {sub && <span className="block text-[10px] text-slate-500 mt-0.5 leading-relaxed">{sub}</span>}
      </span>
      <span className={`w-10 h-6 rounded-full p-0.5 shrink-0 transition-colors ${on ? 'bg-primary' : 'bg-slate-600'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? '-translate-x-4' : ''}`} />
      </span>
    </button>
  )
}

function Choice({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={`rounded-xl px-3 py-2 text-xs font-bold border ${value === o.id ? 'bg-primary/15 border-primary text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-bold text-white text-left">{value}</span>
    </div>
  )
}

function TextSetting({ label, value, placeholder, onSave }) {
  const [v, setV] = useState(value || '')
  useEffect(() => setV(value || ''), [value])
  return (
    <div className="mt-3">
      <label className="block text-[11px] font-bold text-slate-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={`${inputCls} flex-1`} />
        <button onClick={() => onSave(v)} className="px-3 rounded-xl bg-primary text-black text-xs font-black shrink-0">حفظ</button>
      </div>
    </div>
  )
}

function Chip({ children, tone = 'text-slate-300' }) {
  return <span className={`text-[10px] font-bold bg-white/5 rounded-md px-1.5 py-0.5 ${tone}`}>{children}</span>
}

function Stat({ label, value, tone = 'text-white' }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl py-2.5 text-center">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`font-display font-black text-xl ${tone}`}>{value ?? 0}</p>
    </div>
  )
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
