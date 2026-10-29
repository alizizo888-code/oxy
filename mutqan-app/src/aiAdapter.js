// MUTQAN AI Provider Adapter layer.
// Every AI / Speech-to-Text / Text-to-Speech call in the app goes through here —
// never straight to a provider — so the provider can be swapped in ONE place,
// usage/cost is recorded, and a provider failure never breaks the core system.
// No API key, secret or token lives in this file (or anywhere in the frontend):
// the platform provider is authenticated server-side.
import { ai } from './lib/ai'
import { audio } from './lib/audio'
import { db } from './lib/db'
import { team } from './lib/team'
import { auth } from './lib/auth'

// ── Provider registries ─────────────────────────────────────────────────────
// To add a provider later: add an entry with the same shape (run / start+stop / speak).
export const AI_PROVIDERS = {
  local: {
    id: 'local',
    label: 'المساعد المحلي المجاني (بدون مفاتيح ولا تكلفة)',
    models: [{ id: 'rules', label: 'قواعد ذكية + جداول أسعارك' }],
    run: () => { throw new Error('local') },
  },
  platform: {
    id: 'platform',
    label: 'مزوّد المنصة المُدار (من الخادم)',
    models: [{ id: 'auto', label: 'تلقائي — نموذج لغوي متعدد اللغات' }],
    run: (prompt, opts) => ai.run(prompt, opts),
  },
}
export const STT_PROVIDERS = {
  platform: {
    id: 'platform',
    label: 'تحويل الكلام إلى نص — مزوّد المنصة',
    start: (lang) => audio.record({ lang: lang || 'ar-SA' }),
    stop: (rec) => rec.stop({ save: true }),
  },
}
export const TTS_PROVIDERS = {
  platform: {
    id: 'platform',
    label: 'تحويل النص إلى كلام — مزوّد المنصة',
    speak: (text, { voice, lang }) => audio.speak(text, { voice, lang }),
  },
}

const pick = (reg, id) => reg[id] || reg.platform

// ── AI permissions (what the assistant is allowed to do) ────────────────────
export const AI_PERMISSIONS = [
  { id: 'READ_CUSTOMER', label: 'قراءة بيانات العميل نفسه', locked: false },
  { id: 'READ_ORDER', label: 'قراءة طلبات العميل', locked: false },
  { id: 'CREATE_ORDER', label: 'إنشاء طلب (بعد تأكيد العميل)', locked: false },
  { id: 'READ_PRICE', label: 'قراءة الأسعار من محرك التسعير', locked: false },
  { id: 'NEGOTIATE_PRICE', label: 'التفاوض ضمن الحدود', locked: false },
  { id: 'SEND_NOTIFICATION', label: 'إرسال إشعارات المتابعة المصرّح بها', locked: false },
  { id: 'CREATE_PAYMENT_LINK', label: 'إنشاء رابط دفع', locked: false },
  { id: 'READ_PAYMENT_STATUS', label: 'قراءة حالة الدفع', locked: false },
  { id: 'READ_TRACKING', label: 'قراءة بيانات التتبع', locked: false },
  { id: 'ESCALATE', label: 'التحويل التلقائي لموظف', locked: false },
  { id: 'NO_WALLET_MODIFICATION', label: 'ممنوع تعديل أي رصيد', locked: true },
  { id: 'NO_PERMISSION_MODIFICATION', label: 'ممنوع تعديل الصلاحيات', locked: true },
  { id: 'NO_SECRET_ACCESS', label: 'ممنوع الوصول لأي مفتاح أو سر', locked: true },
]
export const DEFAULT_PERMISSIONS = Object.fromEntries(AI_PERMISSIONS.map((p) => [p.id, true]))
export const can = (settings, perm) => settings?.permissions?.[perm] !== false

// ── Usage + cost monitoring ─────────────────────────────────────────────────
let gidPromise = null
const groupId = () => (gidPromise ||= team.groupId().catch(() => { gidPromise = null; return null }))

export function conversationId() {
  try {
    let id = localStorage.getItem('mutqan_conv_id')
    if (!id) { id = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; localStorage.setItem('mutqan_conv_id', id) }
    return id
  } catch { return 'conv-unknown' }
}

const estTokens = (s) => Math.ceil(String(s || '').length / 4)

// Owner-entered unit rates (the platform bill stays the source of truth).
export function estimateCost(row, costs) {
  const c = costs || {}
  const tokens = (row.tokensIn || 0) + (row.tokensOut || 0)
  const v = (tokens / 1000) * (Number(c.per1kTokens) || 0)
    + ((row.voiceSeconds || 0) / 60) * (Number(c.perVoiceMinute) || 0)
    + ((row.ttsChars || 0) / 1000) * (Number(c.perTtsKChars) || 0)
  return Math.round(v * 10000) / 10000
}
export const costsConfigured = (costs) => !!(Number(costs?.per1kTokens) || Number(costs?.perVoiceMinute) || Number(costs?.perTtsKChars))

async function recordUsage(settings, row) {
  if (settings?.logging?.enabled === false) return
  try {
    const gid = await groupId()
    const days = Math.max(1, Number(settings?.privacy?.retentionDays) || 90)
    const user = auth.getCurrentUser()
    const full = {
      ...row,
      user: user?.displayName || user?.email || 'زائر',
      conversation: conversationId(),
      date: new Date().toISOString().slice(0, 10),
      at: new Date().toISOString(),
    }
    full.estimatedCost = estimateCost(full, settings?.costs)
    await db.insertShared('_ai_usage', full, undefined, {
      groupId: gid || undefined,
      visibleTo: 'creator-and-admin',
      expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
    })
  } catch {}
}

export class ProviderError extends Error {
  constructor(kind, cause) { super(`${kind} provider unavailable`); this.kind = kind; this.cause = cause; this.code = 'PROVIDER_DOWN' }
}

// ── Adapter calls ───────────────────────────────────────────────────────────
export async function aiRun(prompt, opts = {}, meta = {}, settings) {
  const p = pick(AI_PROVIDERS, settings?.providers?.ai)
  const model = settings?.providers?.aiModel || p.models[0].id
  try {
    const res = await p.run(prompt, opts)
    recordUsage(settings, { kind: 'ai', provider: p.id, model, feature: meta.feature || 'chat', requests: 1, tokensIn: estTokens(prompt), tokensOut: estTokens(res?.text || JSON.stringify(res?.json || '')) })
    return res
  } catch (e) {
    recordUsage(settings, { kind: 'ai', provider: p.id, model, feature: meta.feature || 'chat', requests: 1, error: true, errorCode: String(e?.code || e?.message || 'error').slice(0, 60) })
    throw new ProviderError('ai', e)
  }
}

export async function sttStart(settings, lang) {
  return pick(STT_PROVIDERS, settings?.providers?.stt).start(lang)
}

export async function sttStop(recorder, startedAt, settings) {
  const p = pick(STT_PROVIDERS, settings?.providers?.stt)
  const voiceSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0
  try {
    const res = await p.stop(recorder)
    recordUsage(settings, { kind: 'stt', provider: p.id, model: 'auto', feature: 'voice_message', requests: 1, voiceSeconds })
    return res
  } catch (e) {
    recordUsage(settings, { kind: 'stt', provider: p.id, model: 'auto', feature: 'voice_message', requests: 1, voiceSeconds, error: true, errorCode: String(e?.code || 'error').slice(0, 60) })
    throw new ProviderError('stt', e)
  }
}

export async function ttsSpeak(text, voice, settings, lang) {
  const p = pick(TTS_PROVIDERS, settings?.providers?.tts)
  try {
    const res = await p.speak(text, { voice, lang })
    recordUsage(settings, { kind: 'tts', provider: p.id, model: voice || 'default', feature: 'voice_reply', requests: 1, ttsChars: String(text || '').length })
    return res
  } catch (e) {
    recordUsage(settings, { kind: 'tts', provider: p.id, model: voice || 'default', feature: 'voice_reply', requests: 1, error: true, errorCode: String(e?.code || 'error').slice(0, 60) })
    throw new ProviderError('tts', e)
  }
}
