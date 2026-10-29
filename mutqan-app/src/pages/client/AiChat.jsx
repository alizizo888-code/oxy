import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Send, Mic, Square, Volume2, Settings2, Headset, Loader2, X, ArrowLeft, Calculator, ClipboardList, UserCheck, MapPin, BellRing, ThumbsUp, ThumbsDown, Navigation, CreditCard } from 'lucide-react'
import { paymentMethods, startOrderPayment, orderAmount, paymentErrorText } from '../../payment'
import { maps } from '../../lib/maps'
import { followUpEvents, trackingFacts, escalationLabel, URGENT_REASONS } from '../../workflow'
import { db } from '../../lib/db'
import { auth } from '../../lib/auth'
import { team } from '../../lib/team'
import { push } from '../../lib/push'
import { audio } from '../../lib/audio'
import { useLiveShared } from '../../lib/useLive'
import { useSession } from '../../hooks/useSession'
import { detectDialect } from '../../botData'
import { setAcContext, runTurn, mergeDraft, summarizeForHandoff, DIALECTS, VOICES, SENSITIVE_ACTIONS } from '../../mutqanAi'
import { specialtyLabel, STATUS_META, ACTIVE_STATUSES } from '../../constants'
import { usePricing } from '../../hooks/usePricing'
import { acQuote, acQuoteFromAcq } from '../../acPricing'
import { useAcConfig } from '../../hooks/useAcConfig'
import { buildOrderMessage, openWhatsApp, waLink } from '../../lib/waOrder'
import { useAiSettings, logAi } from '../../hooks/useAiSettings'
import { computeQuote, nextNegotiationStep, PARTS_RULES } from '../../pricing'
import AiRegistration from '../../components/AiRegistration'
import { isRegistered } from '../../registration'
import AiOrderCard from '../../components/AiOrderCard'
import RegisterModal from '../../components/RegisterModal'
import WarrantyClaimForm from '../../components/WarrantyClaimForm'
import { useWarrantyPolicy } from '../../hooks/useWarranty'
import { ttsSpeak, sttStart, sttStop, can } from '../../aiAdapter'
import AiLogo from '../../components/AiLogo'
import MagicRobot from '../../components/MagicRobot'
import PermissionHelp from '../../components/PermissionHelp'
import { permissionState } from '../../hooks/useLocator'

const VOICE_CONSENT_KEY = 'mutqan_voice_consent'


const PREFS_KEY = 'mutqan_ai_prefs'
const DRAFT_KEY = 'mutqan_ai_draft'
const SINCE_KEY = 'mutqan_ai_since'
const AWAY_MS = 6 * 3600 * 1000
const TICKET_KEY = 'mutqan_handoff_ticket'

const CHIPS = ['محتاج فني تكييف يجيلي النهارده', 'عندي تسريب مياه في المطبخ', 'وين وصل طلبي؟', 'المشكلة رجعت بعد الصيانة — الضمان ساري؟', 'كم سعر غسل 3 مكيفات؟']

const readJson = (k, fb) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fb } catch { return fb }
}
const writeJson = (k, v) => {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch {}
}

export default function AiChat() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session, setSession } = useSession()
  const platformUser = auth.getCurrentUser()
  const ac = useAcConfig()
  useEffect(() => { setAcContext({ cfg: ac.cfg, offers: ac.offers }) }, [ac.cfg, ac.offers])

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState(params.get('q') || '')
  const [thinking, setThinking] = useState(false)
  const [returning, setReturning] = useState(false)
  const [panel, setPanel] = useState(null) // 'order' | 'register' | 'track' | 'calculator'
  const [draft, setDraftState] = useState(() => readJson(DRAFT_KEY, {}))
  const [userPrefs, setPrefsState] = useState(() => readJson(PREFS_KEY, {}))
  const { rules } = usePricing()
  const { settings: aiSettings } = useAiSettings()
  const { policy: warrantyPolicy } = useWarrantyPolicy()
  const prefs = {
    dialect: userPrefs.dialect || aiSettings.defaultDialect,
    voice: userPrefs.voice || aiSettings.defaultVoice,
    autoSpeak: userPrefs.autoSpeak ?? aiSettings.autoSpeakDefault,
  }
  const [showSettings, setShowSettings] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [handingOff, setHandingOff] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState(() => localStorage.getItem(TICKET_KEY) || '')
  const [pendingOrder, setPendingOrder] = useState(null) // order waiting for register / guest at confirm time

  const recorderRef = useRef(null)
  const recordStartRef = useRef(0)
  const endRef = useRef(null)

  const customer = useMemo(() => {
    const verified = isRegistered(session, platformUser)
    return {
      verified,
      name: session?.name || platformUser?.displayName || '',
      phone: session?.phone || '',
      signedIn: !!platformUser,
    }
  }, [session, platformUser])

  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 20 })
  const { data: handoffRows } = useLiveShared('handoffs', { filters: { ticket: ticket || '__none__' }, limit: 1 })
  const handoff = handoffRows?.[0] && handoffRows[0].status !== 'closed' ? handoffRows[0] : null
  const { data: pastHandoffs } = useLiveShared('handoffs', { order: '-createdAt', limit: 5 })
  const { data: coverageRows } = useLiveShared('coverage', { limit: 1 })
  const failuresRef = useRef(0)
  const [locating, setLocating] = useState(false)
  const [locDenied, setLocDenied] = useState(false)
  const [payInfo, setPayInfo] = useState(null)
  const [payingId, setPayingId] = useState(null)
  useEffect(() => { paymentMethods().then(setPayInfo) }, [])

  async function payOrder(o) {
    setPayingId(o.id)
    setError('')
    try { await startOrderPayment(o) } catch (e) { setError(paymentErrorText(e)) } finally { setPayingId(null) }
  }

  // Service area + approximate nearby technicians for a location (no names, no exact positions)
  const areaFor = (coords) => {
    if (!coords?.lat) return null
    const sa = aiSettings.serviceArea
    let inside = null
    if (sa.enabled && sa.lat != null) {
      try { inside = maps.distance(sa.lat, sa.lng, coords.lat, coords.lng) / 1000 <= Number(sa.radiusKm || 50) } catch {}
    }
    const cov = coverageRows?.[0]
    let nearby = null
    if (cov?.points && cov.updatedAt && Date.now() - new Date(cov.updatedAt).getTime() < 24 * 3600 * 1000) {
      nearby = cov.points.filter((p) => { try { return maps.distance(p.lat, p.lng, coords.lat, coords.lng) <= 15000 } catch { return false } }).length
    }
    return { inside, nearby }
  }
  const area = areaFor(draft.coords)

  // Official quote for the current draft — always from the pricing engine
  const quoteFor = (d) => {
    if (!d?.specialtyId || !rules[d.specialtyId]) return null
    let rule = rules[d.specialtyId]
    // AC: the owner's AC table is the single source of truth
    if (d.specialtyId === 'ac' && d.acq) {
      const aq = acQuoteFromAcq(ac.cfg, d.acq, ac.offers)
      if (aq.total > 0) rule = { ...rule, base: aq.total, min: Math.round(aq.total * (1 - ac.cfg.maxDiscountPct / 100)), max: aq.total, discountPct: ac.cfg.maxDiscountPct, extraUnitPct: 100, visitFee: 0 }
    }
    const q = computeQuote(rule, { qty: d.specialtyId === 'ac' && d.acq ? 1 : d.qty || 1, urgent: d.priority === 'urgent', globalMaxDiscountPct: aiSettings.globalPolicy.maxDiscountPct })
    const units = d.specialtyId === 'ac' && d.acq ? (Array.isArray(d.acq.items) ? d.acq.items.reduce((n, it) => n + (Number(it.qty) || 1), 0) : Number(d.acq.qty) || 1) : d.qty || 1
    return { ...q, units, maxAttempts: rule.maxAttempts, negotiable: rule.aiNegotiation !== false && can(aiSettings, 'NEGOTIATE_PRICE') && aiSettings.globalPolicy.negotiationAllowed !== false, partsLabel: PARTS_RULES.find((p) => p.id === rule.partsRule)?.label || '', agreed: d.agreedPrice || null }
  }
  const quote = quoteFor(draft)
  const finalPrice = quote ? draft.agreedPrice || quote.total : null

  const setDraft = (patch) =>
    setDraftState((d) => {
      const next = patch === null ? {} : { ...d, ...patch }
      writeJson(DRAFT_KEY, next)
      return next
    })
  const setPrefs = (patch) =>
    setPrefsState((p) => {
      const next = { ...prefs, ...p, ...patch }
      writeJson(PREFS_KEY, next)
      return next
    })

  useEffect(() => {
    db.select('ai_messages', {}, { order: 'createdAt' }).then((rows) => {
      let since = 0
      try { since = Number(localStorage.getItem(SINCE_KEY)) || 0 } catch {}
      const list = (rows || []).filter((r) => (r.createdAt || 0) >= since)
      setMessages(list)
      const last = list[list.length - 1]
      if (last && Date.now() - (last.createdAt || 0) > AWAY_MS) setReturning(true)
    }).catch(() => {})
  }, [])

  function continueChat() {
    setReturning(false)
    const parts = []
    if (draft.specialtyId) parts.push(specialtyLabel(draft.specialtyId) || '')
    if (draft.qty) parts.push(`العدد ${draft.qty}`)
    if (draft.agreedPrice) parts.push(`السعر المتفق ${draft.agreedPrice} ر.س`)
    addMessage({ role: 'assistant', content: parts.length ? `أهلاً بعودتك 👋 نكمل من حيث توقفنا: ${parts.filter(Boolean).join(' • ')}. تحب نكمل؟` : 'أهلاً بعودتك 👋 كيف أقدر أساعدك؟' })
  }
  function freshChat() {
    try { localStorage.setItem(SINCE_KEY, String(Date.now())) } catch {}
    setReturning(false)
    setMessages([])
    setDraft(null)
  }

  // Agent replies (human handoff) merged into the timeline
  const timeline = useMemo(() => {
    const base = messages.length
      ? messages
      : [{ id: 'greet', role: 'assistant', content: aiSettings.greeting?.trim() ? aiSettings.greeting.trim() : customer.verified ? `أهلاً ${customer.name || ''} 👋 أنا MUTQAN AI. كيف أقدر أساعدك اليوم؟` : 'مرحباً 👋 أنا MUTQAN AI، موظف خدمة العملاء الذكي. قل لي مشكلتك بالكتابة أو بالصوت وأنا أرتب لك الطلب.', createdAt: 0 }]
    const agent = (handoffRows?.[0]?.replies || [])
      .filter((r) => r.from === 'agent')
      .map((r, i) => ({ id: `agent-${i}-${r.at}`, role: 'agent', content: r.text, agentName: r.agentName, createdAt: new Date(r.at).getTime() }))
    // Follow-up engine: status updates of the customer's own orders appear in the chat
    const firstAt = messages[0]?.createdAt || Date.now()
    const followUps = aiSettings.followUp.statusMessages && customer.verified
      ? followUpEvents(orders).filter((e) => e.createdAt >= firstAt - 3600 * 1000)
      : []
    return [...base, ...agent, ...followUps].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  }, [messages, handoffRows, customer, aiSettings.greeting, aiSettings.followUp.statusMessages, orders])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length, thinking, panel])

  // Voice language follows the customer's dialect automatically (Saudi ar-SA / Egyptian ar-EG)
  function voiceLang() {
    if (prefs.dialect === 'egyptian') return 'ar-EG'
    if (prefs.dialect && prefs.dialect !== 'auto') return 'ar-SA'
    const mine = messages.filter((m) => m.role === 'user').slice(-4).map((m) => m.content)
    return detectDialect(...mine.reverse()) === 'eg' ? 'ar-EG' : 'ar-SA'
  }

  async function addMessage(msg) {
    const row = { ...msg, createdAt: Date.now() }
    setMessages((m) => [...m, row])
    // Data retention: conversation rows self-delete after the configured period
    const days = Math.max(1, Number(aiSettings.privacy.retentionDays) || 90)
    try { await db.insert('ai_messages', row, undefined, { expiresAt: new Date(Date.now() + days * 86400000).toISOString() }) } catch {}
    return row
  }

  async function speak(text, id, player) {
    const p = player || new Audio()
    setSpeakingId(id)
    try {
      if (aiSettings.globalPolicy.voiceEnabled === false) throw new Error('voice off')
      const { url, utterance } = await ttsSpeak(text, prefs.voice, aiSettings, voiceLang())
      if (utterance) {
        utterance.onend = () => setSpeakingId(null)
        utterance.onerror = () => setSpeakingId(null)
      } else {
        p.src = url
        p.onended = () => setSpeakingId(null)
        await p.play()
      }
    } catch {
      setSpeakingId(null)
    }
  }

  // Customer no-reply follow-up: a reminder push if the order card is left unconfirmed
  const NUDGE_KEY = 'mutqan_nudge_id'
  async function cancelNudge() {
    const id = localStorage.getItem(NUDGE_KEY)
    if (!id) return
    localStorage.removeItem(NUDGE_KEY)
    try { await push.cancelSchedule(id) } catch {}
  }
  async function scheduleNudge() {
    const fu = aiSettings.followUp
    if (!fu.remindCustomer || !customer.verified || !can(aiSettings, 'SEND_NOTIFICATION')) return
    await cancelNudge()
    try {
      const r = await push.scheduleIn(Math.max(5, Number(fu.customerNoReplyMin) || 30) * 60000, {
        title: 'طلبك بانتظار تأكيدك',
        body: 'MUTQAN AI: جهّزنا ملخص طلبك — أكّده لنرسل لك أقرب فني.',
        url: '#/ai',
      })
      if (r?.id) localStorage.setItem(NUDGE_KEY, r.id)
    } catch {}
  }
  useEffect(() => {
    if (panel === 'order') scheduleNudge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel])

  async function shareLocation() {
    setLocating(true)
    setError('')
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      setLocDenied(false)
      let address = ''
      try { address = (await maps.reverseGeocode(lat, lng))?.address || '' } catch {}
      const coords = { lat, lng, address }
      setDraft({ coords })
      const a = areaFor(coords)
      const parts = ['تم تحديد موقعك ✅']
      if (a?.inside === true) parts.push('أنت داخل نطاق خدمتنا.')
      if (a?.inside === false) parts.push(`موقعك خارج نطاق الخدمة المعتمد${aiSettings.serviceArea.name ? ` (${aiSettings.serviceArea.name})` : ''} — تقدر تتواصل مع موظف للتأكد.`)
      if (a?.nearby != null) parts.push(a.nearby > 0 ? `يوجد تقريبًا ${a.nearby} فني متاح بالقرب منك، وسيتم الإسناد للأنسب.` : 'لا يوجد فني متاح قريب الآن — سيتولى فريق العمليات الإسناد.')
      await addMessage({ role: 'assistant', content: parts.join(' ') })
      setPanel(draft.specialtyId && a?.inside !== false ? 'order' : null)
    } catch (e) {
      const st = await permissionState('geolocation')
      const denied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setLocDenied(denied)
      if (denied) setPanel('location')
      setError(denied ? 'صلاحية الموقع مقفولة — اضغط «تفعيل الأذونات» ثم أعد المحاولة' : 'تعذر تحديد موقعك الآن — تأكد من تشغيل الموقع أو اكتب الحي')
    } finally {
      setLocating(false)
    }
  }

  async function answerFeedback(orderId, ok) {
    try { await db.updateShared('orders', orderId, { serviceFeedback: ok ? 'ok' : 'not_ok', serviceFeedbackAt: new Date().toISOString() }) } catch {}
    if (ok) {
      await addMessage({ role: 'assistant', content: 'يسعدنا ذلك 🌟 قيّم الفني من صفحة الطلب لتساعدنا نحافظ على الجودة.' })
      navigate(`/order/${orderId}`)
    } else {
      await addMessage({ role: 'assistant', content: 'نعتذر عن ذلك 🙏 سأحوّلك الآن لموظف مختص لمعالجة الموضوع.' })
      startHandoff('complaint', orderId)
    }
  }

  async function send(prefill, opts = {}) {
    const text = (prefill ?? input).trim()
    if (!text || thinking) return
    const player = opts.player || (prefs.autoSpeak ? new Audio() : null)
    setInput('')
    setError('')
    cancelNudge()
    await addMessage({ role: 'user', content: text, audioUrl: opts.audioUrl || null })

    // While handed off to a human, messages go to the agent — not the AI
    if (handoff) {
      try {
        await db.updateShared('handoffs', handoff.id, {
          replies: [...(handoff.replies || []), { from: 'customer', text, at: new Date().toISOString() }],
          lastCustomerAt: new Date().toISOString(),
        })
      } catch {
        setError('تعذر إرسال رسالتك للموظف، حاول مرة أخرى')
      }
      return
    }

    if (!aiSettings.enabled) {
      await addMessage({ role: 'assistant', kind: 'system', content: 'المساعد الذكي متوقف مؤقتًا من الإدارة — اضغط «تحويل إلى موظف» أو اطلب الخدمة مباشرة.' })
      return
    }

    setThinking(true)
    try {
      const history = [...messages, { role: 'user', content: text }].filter((m) => m.role === 'user' || m.role === 'assistant')
      const nego = aiSettings.negotiation.enabled && quote?.negotiable ? nextNegotiationStep(draft.negotiation, quote, aiSettings.negotiation, quote.maxAttempts) : null
      const aiCustomer = can(aiSettings, 'READ_CUSTOMER') ? customer : { verified: customer.verified, name: '', phone: '' }
      const res = await runTurn({ history, customer: aiCustomer, orders, draft, dialect: prefs.dialect, rules, quote, nego, settings: aiSettings, pastHandoffs, area, payInfo, warrantyPolicy })
      failuresRef.current = 0
      // Confidence guard: low confidence on a sensitive decision → no workflow step, ask or offer a human
      const conf = aiSettings.confidence
      const lowConfidence = conf.guardSensitive && res.confidence < Number(conf.threshold ?? 0.6) && SENSITIVE_ACTIONS.includes(res.action)
      // Permission guard: an action the owner has not allowed never runs
      const blocked = (res.action === 'ready_to_order' && !can(aiSettings, 'CREATE_ORDER'))
        || (res.action === 'pay' && !can(aiSettings, 'CREATE_PAYMENT_LINK') && !payInfo?.details?.length)
        || (res.action === 'track' && !can(aiSettings, 'READ_ORDER'))
      const decidedAction = lowConfidence ? 'collect' : blocked ? 'handoff' : res.action
      let nextDraft = mergeDraft(draft, res.intent)
      let offerHandoff = false
      // Negotiation: advance the engine's ladder only when the AI used this turn to negotiate
      if (decidedAction === 'negotiate' && nego) {
        nextDraft = { ...nextDraft, negotiation: { i: nego.last ? nego.i : nego.i + 1, offer: nego.offer, stage: nego.stage } }
        offerHandoff = nego.handoff && aiSettings.handoff.enabled && aiSettings.handoff.offerAfterNegotiation
      }
      if (res.intent.counterPrice && nextDraft.negotiation && quote && res.intent.counterPrice >= quote.floor && res.intent.counterPrice <= quote.total) {
        nextDraft = { ...nextDraft, negotiation: { ...nextDraft.negotiation, offer: res.intent.counterPrice } }
      }
      if (res.intent.acceptedOffer && nextDraft.negotiation?.offer && nextDraft.specialtyId === draft.specialtyId) {
        nextDraft = { ...nextDraft, agreedPrice: nextDraft.negotiation.offer }
      }
      setDraft(nextDraft)
      const row = await addMessage({ role: 'assistant', content: res.reply, action: decidedAction, confidence: res.confidence, sources: res.sources, suggestions: res.suggestions || [] })
      if (lowConfidence) {
        await addMessage({ role: 'assistant', kind: 'system', content: 'لست متأكدًا تمامًا من طلبك — وضّح أكثر أو اضغط «تحويل إلى موظف».' })
      }
      if (aiSettings.logging.enabled) {
        logAi({
          action: decidedAction,
          proposedAction: res.action,
          confidence: Math.round(res.confidence * 100) / 100,
          lowConfidence,
          sources: res.sources,
          sensitive: SENSITIVE_ACTIONS.includes(res.action),
          escalation: res.escalation || null,
          specialtyId: nextDraft.specialtyId || null,
          stage: res.action === 'negotiate' ? nego?.stage || null : null,
          offer: res.action === 'negotiate' ? nego?.offer || null : null,
          listPrice: quote?.total || null,
          agreedPrice: nextDraft.agreedPrice || null,
          voice: !!opts.audioUrl,
          dialect: prefs.dialect,
          verified: customer.verified,
          customerName: customer.name || 'زائر',
          text: text.slice(0, 200),
        })
      }

      if (blocked && !lowConfidence) {
        await addMessage({ role: 'assistant', kind: 'system', content: 'هذا الإجراء غير مصرّح للمساعد الذكي — يمكنك التحويل لموظف أو طلب الخدمة مباشرة.' })
      }
      const escOn = res.escalation && aiSettings.handoff.enabled && aiSettings.escalation.reasons[res.escalation] && can(aiSettings, 'ESCALATE')
      if (escOn) {
        if (player) speak(res.reply, row.createdAt, player)
        await startHandoff(res.escalation)
        return
      }
      if (offerHandoff || (lowConfidence && aiSettings.handoff.enabled)) setPanel('handoff')
      else if (decidedAction === 'location') setPanel('location')
      else if (decidedAction === 'ready_to_order') {
        if (nextDraft.specialtyId) setPanel('order')
      } else if (decidedAction === 'register') {
        // Service already understood → review first; registration comes at the confirm button
        setPanel(nextDraft.specialtyId ? 'order' : customer.verified ? null : 'register')
      } else if (decidedAction === 'track') setPanel('track')
      else if (decidedAction === 'pay') setPanel('pay')
      else if (decidedAction === 'warranty') setPanel('warranty')
      else if (decidedAction === 'join_tech') setPanel('join_tech')
      else if (decidedAction === 'calculator') setPanel('calculator')
      else if (decidedAction === 'handoff' && aiSettings.handoff.enabled) setPanel('handoff')

      if (player) speak(res.reply, row.createdAt, player)
    } catch (e) {
      failuresRef.current += 1
      const limit = Math.max(1, Number(aiSettings.escalation.failureLimit) || 2)
      if (failuresRef.current >= limit && aiSettings.handoff.enabled && aiSettings.escalation.reasons.repeated_failure) {
        failuresRef.current = 0
        await addMessage({ role: 'assistant', kind: 'system', content: 'تعثّر المساعد أكثر من مرة — سيتم تحويلك لموظف.' })
        setThinking(false)
        await startHandoff('repeated_failure')
        return
      }
      // Failsafe: the AI provider is down — the core system keeps working without it
      await addMessage({ role: 'assistant', kind: 'system', content: 'المساعد الذكي غير متاح مؤقتًا. خدمات مُتقن تعمل كالمعتاد: تقدر تطلب الخدمة مباشرة أو تتحوّل لموظف.' })
      setPanel('fallback')
    } finally {
      setThinking(false)
    }
  }

  async function toggleRecord() {
    setError('')
    if (!recording) {
      if (aiSettings.privacy.voiceConsentRequired && !localStorage.getItem(VOICE_CONSENT_KEY)) {
        setPanel('voiceConsent')
        return
      }
      try {
        recorderRef.current = await sttStart(aiSettings, voiceLang())
        recordStartRef.current = Date.now()
        setRecording(true)
      } catch {
        setError('لم نتمكن من الوصول للميكروفون — فعّل الصلاحية من المتصفح')
      }
      return
    }
    const player = new Audio() // created inside the tap so voice replies can play on iOS
    setRecording(false)
    setTranscribing(true)
    try {
      const { text, url } = await sttStop(recorderRef.current, recordStartRef.current, aiSettings)
      recorderRef.current = null
      if (!text?.trim()) {
        setError('لم أسمع كلامًا واضحًا — حاول مرة أخرى')
        return
      }
      setTranscribing(false)
      await send(text, { audioUrl: url, player })
    } catch {
      recorderRef.current = null
      setError('خدمة تحويل الصوت غير متاحة الآن — اكتب رسالتك وسنرد عليك كالمعتاد')
    } finally {
      setTranscribing(false)
    }
  }

  function cancelRecord() {
    recorderRef.current?.cancel()
    recorderRef.current = null
    setRecording(false)
  }

  useEffect(() => () => recorderRef.current?.cancel(), [])

  async function onRegistered(s) {
    setSession(s)
    if (s.location?.lat && !draft.coords) setDraft({ coords: s.location })
    await addMessage({ role: 'assistant', content: `تم إنشاء حسابك بنجاح يا ${s.name} ✅ محادثتك محفوظة ومربوطة بحسابك، ولن نطلب بياناتك مرة أخرى.${draft.specialtyId ? ' راجع ملخص طلبك وأكّده.' : ' كيف أقدر أساعدك؟'}` })
    setPanel(draft.specialtyId ? 'order' : null)
  }

  // Confirm pressed: registered customers (or a returning guest with a mobile) go straight
  // through; otherwise ask now — register or continue as guest — then send the same order.
  function confirmOrder(d) {
    if (customer.verified) return createOrder(d, { type: 'verified', name: customer.name, phone: customer.phone })
    if (session?.type === 'guest' && session?.phone) return createOrder(d, session)
    // No sign-up step: the customer's WhatsApp message carries their number — send as an anonymous guest.
    // Name/phone only come along if the customer already mentioned them in the chat.
    const c = d.contact || {}
    return createOrder(d, { type: 'guest', name: c.name || '', phone: c.phone || '' })
  }

  async function onConfirmIdentity(s) {
    const d = pendingOrder
    setPendingOrder(null)
    setSession(s)
    if (!d) return
    const coords = d.coords || s.location
    await addMessage({ role: 'assistant', kind: 'system', content: s.type === 'verified' ? `تم تسجيلك يا ${s.name} ✅` : `تمام يا ${s.name} — نرسل طلبك كزائر.` })
    createOrder({ ...d, coords }, s)
  }

  async function createOrder(d, who = { type: 'verified', name: customer.name, phone: customer.phone }) {
    setCreating(true)
    setError('')
    try {
      const gid = await team.groupId()
      const convo = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }))
      const payload = {
        clientId: platformUser?.id || null,
        clientName: who.name || '',
        clientPhone: who.phone || '',
        clientType: who.type === 'guest' ? 'guest' : 'verified',
        specialtyId: d.specialtyId,
        description: d.problem || '',
        preferredTime: d.preferredTime || null,
        priority: d.priority === 'urgent' && aiSettings.orderConversion.allowUrgent ? 'urgent' : 'normal',
        ...(() => {
          const q = quoteFor(d)
          const p = q ? d.agreedPrice || q.total : null
          return {
            estimatedPrice: p ? { low: p, high: p } : null,
            priceQuote: q ? { total: q.total, service: q.service, visitFee: q.visitFee, emergency: q.emergency, qty: q.qty } : null,
            agreedPrice: d.agreedPrice || null,
            negotiated: !!d.agreedPrice && q && d.agreedPrice < q.total,
            qty: d.qty || 1,
            acQuote: d.specialtyId === 'ac' && d.acq && q ? (() => { const o = acQuoteFromAcq(ac.cfg, d.acq, ac.offers).offer; return { ...d.acq, total: q.total, offerKey: o ? (o.key || o.id) : null } })() : undefined,
          }
        })(),
        address: d.coords.address || d.locationText || '',
        lat: d.coords.lat,
        lng: d.coords.lng,
        status: 'new',
        statusHistory: [{ status: 'new', at: new Date().toISOString(), by: 'mutqan_ai' }],
        source: 'mutqan_ai',
        aiConversation: convo,
      }
      // High-value customer → the order goes in flagged for a human at operations
      const esc = aiSettings.escalation
      const pastCount = (orders || []).length
      const value = payload.agreedPrice || payload.priceQuote?.total || 0
      const highValue = esc.reasons.high_value && (value >= Number(esc.highValueAmount || 1e9) || pastCount >= Number(esc.highValueOrders || 1e9))
      const now = new Date().toISOString()
      payload.handler = 'operations'
      payload.paymentStatus = 'unpaid'
      payload.orderConsentAt = now
      payload.transferLog = [{ from: 'ai', to: 'operations', at: now, by: 'mutqan_ai', note: 'تحويل المحادثة إلى طلب بعد تأكيد العميل' }]
      if (area?.inside === false) payload.outsideServiceArea = true
      if (highValue) payload.escalation = { reason: 'high_value', level: 'operations', at: now, by: 'mutqan_ai', note: value >= Number(esc.highValueAmount) ? `قيمة الطلب ${value} ر.س` : `عميل لديه ${pastCount} طلبات سابقة` }
      const order = await db.insertShared('orders', payload, undefined, { groupId: gid, visibleTo: 'creator-and-admin' })
      cancelNudge()
      try {
        await push.sendToAdmins(gid, {
          title: highValue ? '⭐ طلب عميل عالي القيمة عبر MUTQAN AI' : 'طلب جديد عبر MUTQAN AI',
          body: `${specialtyLabel(d.specialtyId)} — ${who.name || ''}`,
          url: `#/staff/order/${order.id}`,
          sound: 'bell',
        })
      } catch {}
      const waText = buildOrderMessage({ draft: d, who: { ...who, name: who.name || d.contact?.name, phone: who.phone || d.contact?.phone }, price: d.agreedPrice || quoteFor(d)?.total, orderId: order.id })
      const waNumber = ac.cfg.waNumber || '966549423050'
      openWhatsApp(waNumber, waText)
      setDraft(null)
      setPanel(null)
      await addMessage({ role: 'assistant', kind: 'order_created', orderId: order.id, waText, waNumber, content: `تم إرسال طلبك #${String(order.id).slice(-5)} لغرفة العمليات ✅ سيتم إسناده لأقرب فني متاح، وتقدر تتابع حالته من هنا أو من «طلباتي».` })
    } catch {
      setError('تعذر إرسال الطلب، حاول مرة أخرى')
    } finally {
      setCreating(false)
    }
  }

  async function startHandoff(reasonArg, orderIdArg) {
    if (handoff || handingOff) return
    const reason = typeof reasonArg === 'string' ? reasonArg : 'human'
    setHandingOff(true)
    setError('')
    try {
      const gid = await team.groupId()
      const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
      const sum = await summarizeForHandoff({ history, draft, customer, settings: aiSettings })
      const t = crypto.randomUUID()
      const lastOrder = (orderIdArg && orders?.find((o) => o.id === orderIdArg)) || orders?.find((o) => ACTIVE_STATUSES.includes(o.status)) || null
      const row = await db.insertShared(
        'handoffs',
        {
          ticket: t,
          status: 'open',
          reason,
          priority: URGENT_REASONS.includes(reason) ? 'high' : 'normal',
          customerName: customer.name || 'زائر',
          customerPhone: customer.phone || null,
          customerVerified: customer.verified,
          orderId: lastOrder?.id || null,
          service: draft.specialtyId || lastOrder?.specialtyId || null,
          location: draft.coords || session?.location || null,
          locationText: draft.locationText || null,
          price: finalPrice ? { low: finalPrice, high: finalPrice, list: quote?.total, negotiationStage: draft.negotiation?.stage || null } : null,
          draft,
          summary: sum.summary,
          intent: sum.intent,
          mood: sum.mood,
          conversation: history.slice(-40).map((m) => ({ role: m.role, content: m.content, audioUrl: m.audioUrl || null, at: m.createdAt })),
          replies: [],
        },
        undefined,
        { groupId: gid, visibleTo: 'creator-and-admin' }
      )
      localStorage.setItem(TICKET_KEY, t)
      setTicket(t)
      setPanel(null)
      try {
        await push.sendToAdmins(gid, {
          title: reason === 'human' ? 'عميل يطلب موظفًا' : `تصعيد: ${escalationLabel(reason)}`,
          body: `${customer.name || 'زائر'} — ${sum.intent || ''}`,
          url: `#/staff/handoff/${row.id}`,
          sound: 'bell',
        })
      } catch {}
      await addMessage({ role: 'assistant', kind: 'system', content: `تم تحويلك إلى موظف خدمة العملاء 🎧${reason !== 'human' ? ` (${escalationLabel(reason)})` : ''} أرسلنا له ملخص المحادثة كاملًا، وسيرد عليك هنا قريبًا.` })
    } catch {
      setError('تعذر التحويل لموظف الآن، حاول مرة أخرى')
    } finally {
      setHandingOff(false)
    }
  }

  function endHandoff() {
    localStorage.removeItem(TICKET_KEY)
    setTicket('')
    addMessage({ role: 'assistant', kind: 'system', content: 'عدت للمحادثة مع MUTQAN AI 🤖' })
  }

  const activeOrders = (orders || []).filter((o) => ACTIVE_STATUSES.includes(o.status))

  return (
    <div className="h-full flex flex-col bg-[#eef4fb]" dir="rtl">
      <header className="shrink-0 bg-white/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-3 flex items-center gap-2.5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform shrink-0">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <AiLogo size={40} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base font-black text-slate-900 leading-tight">MUTQAN AI</h1>
            <p className={`text-[10px] font-bold flex items-center gap-1 ${handoff ? 'text-amber-600' : 'text-emerald-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${handoff ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {handoff ? (handoff.agentName ? `متصل بالموظف ${handoff.agentName}` : 'بانتظار موظف خدمة العملاء…') : customer.verified ? `عميل موثّق · ${customer.name}` : 'زائر · موظف خدمة ذكي'}
            </p>
          </div>
          {!aiSettings.handoff.enabled && !handoff ? null : handoff ? (
            <button onClick={endHandoff} className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-3 py-2">العودة للمساعد</button>
          ) : (
            <button
              onClick={() => startHandoff('human')}
              disabled={handingOff}
              className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-white bg-gradient-to-l from-amber-500 to-orange-500 rounded-full px-3 py-2 shadow-sm disabled:opacity-60 active:scale-95 transition-transform"
            >
              {handingOff ? <Loader2 size={12} className="animate-spin" /> : <Headset size={12} />}
              تحويل إلى موظف
            </button>
          )}
          <button
            onClick={() => {
              const lines = messages.filter((m) => m.role && m.content && m.kind !== 'system').slice(-8).map((m) => `${m.role === 'user' ? 'أنا' : 'المساعد'}: ${m.content}`).join('\n')
              const txt = `السلام عليكم، أبغى أكمل طلبي مع أكسجين.${customer?.name ? `\nالاسم: ${customer.name}` : ''}${draft?.description ? `\nالطلب: ${draft.description}` : ''}${finalPrice ? `\nالسعر المتفق: ${finalPrice} ر.س` : ''}${lines ? `\n\nآخر المحادثة:\n${lines}` : ''}`
              window.open(`https://wa.me/${ac.cfg.waNumber || '966549423050'}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener')
            }}
            aria-label="إرسال عبر واتساب"
            className="shrink-0 text-[10px] font-bold text-white bg-emerald-500 rounded-full px-3 py-2 shadow-sm active:scale-95"
          >
            واتساب
          </button>
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full bg-white border border-sky-100 flex items-center justify-center shrink-0 hover:bg-sky-50">
            <Settings2 size={16} className="text-slate-500" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex flex-col gap-2.5">
          {messages.length === 0 && !thinking && !handoff && (
            <div className="flex justify-center pt-2 pb-1"><MagicRobot mode="greet" size={168} /></div>
          )}
          {returning && !handoff && (
            <div className="rounded-2xl border border-primary/20 bg-white p-3 shadow-sm fade-up">
              <p className="text-sm font-bold text-slate-700 mb-2">غبت فترة 👋 تحب تكمل طلبك السابق أو تبدأ محادثة جديدة؟</p>
              <div className="flex gap-2">
                {(draft.specialtyId || draft.acq) && <button onClick={continueChat} className="flex-1 rounded-xl bg-primary text-white text-xs font-bold py-2">استكمال الطلب</button>}
                <button onClick={freshChat} className="flex-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold py-2">محادثة جديدة</button>
              </div>
            </div>
          )}
          {timeline.map((m) => (
            <Bubble
              key={m.id || m.createdAt}
              m={m}
              speaking={speakingId === m.createdAt}
              onSpeak={() => speak(m.content, m.createdAt)}
              onOpenOrder={(id) => navigate(`/order/${id}`)}
              onFeedback={answerFeedback}
            />
          ))}

          {thinking && (
            <div className="flex justify-center py-2"><MagicRobot mode="think" size={104} /></div>
          )}

          {!thinking && !handoff && (() => {
            const last = messages[messages.length - 1]
            const sg = last?.role === 'assistant' && Array.isArray(last.suggestions) ? last.suggestions : []
            return sg.length ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1">
                {sg.map((c) => (
                  <button key={c} onClick={() => send(c)} className="shrink-0 bg-white border border-sky-100 rounded-full px-3 py-1.5 text-[11px] font-bold text-sky-700 active:scale-95 transition-transform shadow-sm">{c}</button>
                ))}
              </div>
            ) : null
          })()}

          {messages.length === 0 && !thinking && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => send(c)} className="shrink-0 bg-white border border-sky-100 rounded-full px-3 py-1.5 text-[10px] font-bold text-sky-700 active:scale-95 transition-transform shadow-sm hover:bg-sky-50">
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Workflow panels driven by the AI's understood action */}
          {!handoff && panel === 'register' && !customer.verified && (
            <div>
              <PanelClose onClose={() => setPanel(null)} />
              <AiRegistration
                initialName={customer.name}
                onDone={onRegistered}
                onProgress={(stage, note) => note && addMessage({ role: 'assistant', kind: 'system', content: note })}
              />
            </div>
          )}
          {!handoff && panel === 'order' && (
            <div>
              <PanelClose onClose={() => setPanel(null)} />
              <AiOrderCard draft={draft} session={session} onChange={setDraft} onConfirm={confirmOrder} busy={creating} quote={quote} allowUrgent={aiSettings.orderConversion.allowUrgent} />
            </div>
          )}
          {!handoff && panel === 'location' && (
            <div className="bg-white border border-sky-100 rounded-2xl shadow-sm p-3 fade-up">
              <PanelClose onClose={() => setPanel(null)} inline />
              <p className="font-display font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5"><MapPin size={15} className="text-primary" /> مشاركة موقع الخدمة</p>
              <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">اضغط الزر ويُحدد موقعك مباشرة — نستخدمه لتحديد نطاق الخدمة وأقرب فني.</p>
              {locDenied && <div className="mb-2"><PermissionHelp kind="location" onRetry={shareLocation} /></div>}
              <button onClick={shareLocation} disabled={locating} className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-60">
                {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />} تحديد موقعي
              </button>
            </div>
          )}
          {!handoff && panel === 'track' && (
            <div className="bg-white border border-sky-100 rounded-2xl shadow-sm p-3 fade-up">
              <PanelClose onClose={() => setPanel(null)} inline />
              <p className="font-display font-black text-slate-900 text-sm mb-2 flex items-center gap-1.5"><ClipboardList size={15} className="text-primary" /> طلباتك النشطة</p>
              {activeOrders.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3">لا توجد طلبات نشطة حاليًا</p>
              ) : (
                activeOrders.slice(0, 4).map((o) => (
                  <button key={o.id} onClick={() => navigate(`/order/${o.id}`)} className="w-full flex items-center justify-between bg-sky-50 hover:bg-sky-100 rounded-xl px-3 py-2 mb-1.5 text-right">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{specialtyLabel(o.specialtyId)} · #{String(o.id).slice(-5)}</p>
                      <p className="text-[10px] text-slate-500">{STATUS_META[o.status]?.label}{o.technicianName ? ` · ${o.technicianName}` : ''}</p>
                      {['en_route', 'nearby'].includes(o.status) && (() => {
                        const t = trackingFacts(o, aiSettings.tracking.staleMinutes)
                        return (
                          <p className={`text-[10px] font-bold ${t.available && !t.stale ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {t.available ? `📍 ${t.km != null ? `${t.km} كم` : ''} · آخر تحديث قبل ${t.ageMin} د${t.stale ? ' (قديم)' : ''}` : 'لا توجد بيانات موقع حية حاليًا'}
                          </p>
                        )
                      })()}
                    </div>
                    <ArrowLeft size={14} className="text-sky-500 shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
          {!handoff && panel === 'pay' && (
            <div className="bg-white border border-sky-100 rounded-2xl shadow-sm p-3 fade-up">
              <PanelClose onClose={() => setPanel(null)} inline />
              <p className="font-display font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5"><CreditCard size={15} className="text-primary" /> الدفع</p>
              <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                الطرق المتاحة: {payInfo?.online ? 'دفع إلكتروني آمن، ' : ''}{(payInfo?.onSite || []).join('، ')}. لا يُعتبر الدفع مكتملًا إلا بعد تأكيد مزود الدفع.
              </p>
              {(() => {
                const unpaid = (orders || []).filter((o) => o.status !== 'cancelled' && o.paymentStatus !== 'paid' && orderAmount(o) > 0)
                if (!customer.verified || !unpaid.length) return <p className="text-[11px] text-slate-400 text-center py-2">لا توجد طلبات بانتظار الدفع</p>
                return unpaid.slice(0, 4).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 bg-sky-50 rounded-xl px-3 py-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{specialtyLabel(o.specialtyId)} · #{String(o.id).slice(-5)}</p>
                      <p className="text-[10px] text-slate-500">{orderAmount(o)} ر.س{o.onlinePayment?.status === 'created' ? ' · بانتظار تأكيد المزود' : o.onlinePayment?.status === 'failed' ? ' · لم يكتمل' : ''}</p>
                    </div>
                    {payInfo?.online && aiSettings.payment.aiPayButton && can(aiSettings, 'CREATE_PAYMENT_LINK') ? (
                      <button onClick={() => payOrder(o)} disabled={payingId === o.id} className="shrink-0 flex items-center gap-1 bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-60">
                        {payingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />} ادفع
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">الدفع عند الفني</span>
                    )}
                  </div>
                ))
              })()}
            </div>
          )}
          {!handoff && panel === 'join_tech' && (
            <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-4 fade-up">
              <PanelClose onClose={() => setPanel(null)} inline />
              <p className="font-display font-black text-slate-900 text-sm mb-1">👷 التسجيل كفني في مُتقن</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">دخول بضغطة (Google أو Apple)، ثم اسمك وجوالك وتخصصاتك وموقعك. يُفعّل حسابك بعد موافقة الإدارة.</p>
              <button onClick={() => navigate('/join-tech')} className="w-full bg-gradient-to-l from-amber-500 to-orange-500 text-white font-display font-black rounded-xl py-2.5 text-sm active:scale-[0.98] transition-transform">ابدأ طلب الانضمام</button>
            </div>
          )}
          {!handoff && panel === 'warranty' && (
            <div>
              <PanelClose onClose={() => setPanel(null)} />
              <WarrantyClaimForm
                orders={orders}
                policy={warrantyPolicy}
                customer={customer}
                source="mutqan_ai"
                onDone={async (row, w) => {
                  setPanel(null)
                  if (aiSettings.logging.enabled) logAi({ action: 'warranty_claim', sources: ['warranty'], verified: customer.verified, customerName: customer.name || 'زائر', text: 'warranty claim' })
                  await addMessage({ role: 'assistant', content: `فتحت لك ملف ضمان رقم #${String(row?.id || '').slice(-5)} ✅ ${w?.known ? (w.active ? `ضمانك ساري ومتبقي ${w.remainingDays} يوم.` : 'حسب السجل الضمان منتهي، وسيراجعه الفريق مع ذلك.') : 'سيفحص الفريق سجل الضمانات ويؤكد لك المدة.'} وصل الملف لفريق العمليات وتتابع النتيجة من «ضماناتي».` })
                }}
              />
            </div>
          )}
          {!handoff && panel === 'voiceConsent' && (
            <div className="bg-white border border-sky-100 rounded-2xl shadow-sm p-3 fade-up">
              <PanelClose onClose={() => setPanel(null)} inline />
              <p className="font-display font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5"><Mic size={15} className="text-primary" /> موافقة على الرسائل الصوتية</p>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                صوتك يُعامل كبيانات حساسة: يُحوّل إلى نص لفهم طلبك فقط، ويُحفظ مع محادثتك لمدة {aiSettings.privacy.retentionDays} يومًا ثم يُحذف تلقائيًا، ولا يُستخدم لأي غرض آخر. يمكنك حذف محادثاتك في أي وقت من صفحة الخصوصية.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const at = new Date().toISOString()
                    localStorage.setItem(VOICE_CONSENT_KEY, at)
                    try { await db.insert('consents', { type: 'voice', at, retentionDays: aiSettings.privacy.retentionDays }) } catch {}
                    setPanel(null)
                  }}
                  className="flex-1 bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-xl py-2.5 text-xs font-bold"
                >
                  أوافق
                </button>
                <button onClick={() => navigate('/privacy')} className="flex-1 bg-sky-50 text-sky-700 rounded-xl py-2.5 text-xs font-bold">سياسة الخصوصية</button>
              </div>
            </div>
          )}
          {!handoff && panel === 'fallback' && (
            <div className="flex flex-wrap justify-end gap-2 fade-up">
              <button onClick={() => navigate('/new')} className="flex items-center gap-2 bg-white border border-sky-200 rounded-full px-4 py-2 text-xs font-bold text-sky-700 shadow-sm">
                <ClipboardList size={14} /> اطلب الخدمة مباشرة
              </button>
              {aiSettings.handoff.enabled && (
                <button onClick={() => startHandoff('repeated_failure')} disabled={handingOff} className="flex items-center gap-2 bg-gradient-to-l from-amber-500 to-orange-500 text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-60">
                  <Headset size={14} /> تحويل إلى موظف
                </button>
              )}
            </div>
          )}
          {!handoff && panel === 'calculator' && (
            <button onClick={() => navigate('/calculator')} className="self-end flex items-center gap-2 bg-white border border-sky-100 rounded-full px-4 py-2 text-xs font-bold text-sky-700 shadow-sm fade-up">
              <Calculator size={14} /> افتح حاسب الأسعار التفصيلي
            </button>
          )}
          {!handoff && panel === 'handoff' && (
            <button onClick={() => startHandoff(draft.negotiation ? 'pricing' : 'human')} disabled={handingOff} className="self-end flex items-center gap-2 bg-gradient-to-l from-amber-500 to-orange-500 text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm fade-up disabled:opacity-60">
              <Headset size={14} /> نعم، حوّلني إلى موظف
            </button>
          )}
          {!handoff && !panel && draft.specialtyId && messages.length > 0 && (
            <button
              onClick={() => setPanel('order')}
              className="self-end flex items-center gap-2 bg-white border border-emerald-200 rounded-full px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm"
            >
              <UserCheck size={14} /> مراجعة الطلب وتأكيده
            </button>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <RegisterModal
        open={!!pendingOrder}
        onClose={() => setPendingOrder(null)}
        onDone={onConfirmIdentity}
        initial={{ name: customer.name, phone: customer.phone }}
      />

      <div className="shrink-0 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] bg-gradient-to-t from-[#eef4fb] to-[#eef4fb]/70">
        <div className="max-w-3xl mx-auto w-full">
          {error && <p className="text-rose-600 text-[11px] font-bold text-center mb-1.5">{error}</p>}
          {recording ? (
            <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-full pr-4 pl-1.5 py-1.5 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="flex-1 text-xs font-bold text-rose-600">جارِ التسجيل… تحدث الآن</span>
              <button onClick={cancelRecord} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={16} className="text-slate-500" /></button>
              <button onClick={toggleRecord} className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center"><Square size={14} fill="currentColor" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {audio.isSupported && aiSettings.globalPolicy.voiceEnabled !== false && (
                <button
                  onClick={toggleRecord}
                  disabled={transcribing || thinking}
                  className="w-11 h-11 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-sky-50 active:scale-95 transition-transform"
                  aria-label="رسالة صوتية"
                >
                  {transcribing ? <Loader2 size={17} className="animate-spin text-sky-500" /> : <Mic size={18} className="text-sky-600" />}
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={handoff ? 'اكتب رسالتك للموظف…' : 'اكتب أو تحدث مع MUTQAN AI…'}
                className="flex-1 min-w-0 bg-white border border-sky-100 shadow-sm rounded-full px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <button
                onClick={() => send()}
                disabled={thinking || !input.trim()}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-200 active:scale-95 transition-transform disabled:opacity-40 shrink-0"
              >
                <Send size={17} className="-scale-x-100" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showSettings && <SettingsSheet prefs={prefs} setPrefs={setPrefs} onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function Bubble({ m, speaking, onSpeak, onOpenOrder, onFeedback }) {
  if (m.role === 'followup') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
          <p className="text-[10px] font-black text-emerald-700 mb-0.5 flex items-center gap-1"><BellRing size={11} /> متابعة طلب #{String(m.orderId).slice(-5)}</p>
          <p className="text-[12px] font-bold text-slate-800">{m.content}</p>
          {m.awaitingFeedback ? (
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => onFeedback(m.orderId, true)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 text-white rounded-xl py-1.5 text-[11px] font-bold"><ThumbsUp size={12} /> نعم</button>
              <button onClick={() => onFeedback(m.orderId, false)} className="flex-1 flex items-center justify-center gap-1 bg-white border border-rose-200 text-rose-600 rounded-xl py-1.5 text-[11px] font-bold"><ThumbsDown size={12} /> لا</button>
            </div>
          ) : (
            <button onClick={() => onOpenOrder(m.orderId)} className="mt-1 text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">عرض الطلب <ArrowLeft size={10} /></button>
          )}
        </div>
      </div>
    )
  }
  if (m.kind === 'system') {
    return (
      <div className="self-center max-w-[90%] text-center bg-sky-100/70 text-sky-800 rounded-full px-3 py-1.5 text-[10px] font-bold">{m.content}</div>
    )
  }
  const isUser = m.role === 'user'
  const isAgent = m.role === 'agent'
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed font-medium whitespace-pre-wrap ${
          isUser
            ? 'bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-tr-sm shadow-md shadow-sky-200'
            : isAgent
              ? 'bg-amber-50 border border-amber-200 text-slate-800 rounded-tl-sm shadow-sm'
              : 'bg-white border border-sky-100 text-slate-700 rounded-tl-sm shadow-sm'
        }`}
      >
        {isAgent && <p className="text-[10px] font-black text-amber-700 mb-0.5">🎧 {m.agentName || 'موظف خدمة العملاء'}</p>}
        {m.audioUrl && <audio src={m.audioUrl} controls className="h-8 w-48 max-w-full mb-1" />}
        {m.content}
        {m.kind === 'order_created' && m.waText && (
          <a href={waLink(m.waNumber, m.waText)} target="_blank" rel="noopener noreferrer" className="mt-2 w-full flex items-center justify-center gap-1 bg-[#25D366] text-white rounded-xl py-2 text-[12px] font-black">
            إرسال الطلب على واتساب ✅
          </a>
        )}
        {m.kind === 'order_created' && m.orderId && (
          <button onClick={() => onOpenOrder(m.orderId)} className="mt-2 w-full flex items-center justify-center gap-1 bg-emerald-600 text-white rounded-xl py-1.5 text-[11px] font-bold">
            متابعة الطلب <ArrowLeft size={12} />
          </button>
        )}
        {m.role === 'assistant' && m.id !== 'greet' && (
          <button onClick={onSpeak} disabled={speaking} className="mt-1 flex items-center gap-1 text-[10px] font-bold text-sky-500 disabled:text-sky-300">
            {speaking ? <Loader2 size={11} className="animate-spin" /> : <Volume2 size={11} />} استماع
          </button>
        )}
      </div>
    </div>
  )
}

function PanelClose({ onClose, inline }) {
  return (
    <div className={`flex justify-start ${inline ? '-mt-1 mb-1' : 'mb-1'}`}>
      <button onClick={onClose} className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 hover:text-slate-600">
        <X size={11} /> إخفاء
      </button>
    </div>
  )
}

function SettingsSheet({ prefs, setPrefs, onClose }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] fade-up" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-black text-slate-900">إعدادات MUTQAN AI</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X size={15} /></button>
        </div>
        <p className="text-xs font-bold text-slate-500 mb-2">لهجة المحادثة</p>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {DIALECTS.map((d) => (
            <button key={d.id} onClick={() => setPrefs({ dialect: d.id })} className={`rounded-xl py-2 text-xs font-bold border ${prefs.dialect === d.id ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-slate-500 mb-2">صوت المساعد</p>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {VOICES.map((v) => (
            <button key={v.id} onClick={() => setPrefs({ voice: v.id })} className={`rounded-xl py-2 text-xs font-bold border ${prefs.voice === v.id ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={() => setPrefs({ autoSpeak: !prefs.autoSpeak })} className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <span className="text-xs font-bold text-slate-700">الرد الصوتي التلقائي على كل رسالة</span>
          <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${prefs.autoSpeak ? 'bg-primary' : 'bg-slate-300'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs.autoSpeak ? '-translate-x-4' : ''}`} />
          </span>
        </button>
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">الرسائل الصوتية يُرد عليها صوتيًا دائمًا. الرد الصوتي يستهلك من رصيد الذكاء الاصطناعي.</p>
      </div>
    </div>
  )
}
