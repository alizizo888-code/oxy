import { useCallback, useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { DEFAULT_NEGOTIATION } from '../pricing'
import { DEFAULT_PERMISSIONS } from '../aiAdapter'

// Central MUTQAN AI settings — one shared row the whole app reads; only team
// admins (owner + operations supervisor) can change it.
export const DEFAULT_AI_SETTINGS = {
  enabled: true,
  tone: 'friendly',
  defaultDialect: 'auto',
  defaultVoice: 'ghizlane',
  autoSpeakDefault: false,
  greeting: '',
  faq: [],
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
  privacy: { voiceConsentRequired: true, retentionDays: 90, notice: '' },
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
  out.faq = Array.isArray(r.faq) ? r.faq : []
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
