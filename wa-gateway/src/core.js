// Pure helpers (unit-tested without WhatsApp).
import crypto from 'node:crypto'

export const sign = (secret, body) => crypto.createHmac('sha256', secret).update(body).digest('hex')

export function safeEq(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export const cleanId = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
export const digits = (s) => String(s || '').replace(/\D/g, '')
export const jidToPhone = (jid) => digits(String(jid || '').split('@')[0].split(':')[0])
export const phoneToJid = (p) => `${digits(p)}@s.whatsapp.net`
export const isUserJid = (jid) => /@(s\.whatsapp\.net|lid)$/.test(String(jid || ''))

// Text + media kind out of a Baileys message object.
export function extract(msg) {
  let m = msg || {}
  if (m.ephemeralMessage) m = m.ephemeralMessage.message || {}
  if (m.viewOnceMessage) m = m.viewOnceMessage.message || {}
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message || {}
  if (m.conversation) return { text: m.conversation, kind: 'text' }
  if (m.extendedTextMessage) return { text: m.extendedTextMessage.text || '', kind: 'text' }
  if (m.imageMessage) return { text: m.imageMessage.caption || '', kind: 'image' }
  if (m.videoMessage) return { text: m.videoMessage.caption || '', kind: 'video' }
  if (m.audioMessage) return { text: '', kind: m.audioMessage.ptt ? 'voice' : 'audio' }
  if (m.documentMessage) return { text: m.documentMessage.fileName || m.documentMessage.caption || '', kind: 'document' }
  if (m.stickerMessage) return { text: '', kind: 'sticker' }
  if (m.locationMessage) {
    const l = m.locationMessage
    return { text: `https://maps.google.com/?q=${l.degreesLatitude},${l.degreesLongitude}`, kind: 'location' }
  }
  if (m.contactMessage) return { text: m.contactMessage.displayName || '', kind: 'contact' }
  if (m.reactionMessage) return { text: '', kind: 'reaction' }
  return { text: '', kind: 'other' }
}

// Anti-ban pacing: random delay between sends + a daily cap per account.
export class Pacer {
  constructor({ minMs = 1500, maxMs = 5000, dailyCap = 200, now = () => Date.now(), rand = Math.random } = {}) {
    Object.assign(this, { minMs, maxMs, dailyCap, now, rand })
    this.day = ''; this.count = 0
  }
  _roll() {
    const d = new Date(this.now()).toISOString().slice(0, 10)
    if (d !== this.day) { this.day = d; this.count = 0 }
  }
  canSend() { this._roll(); return this.count < this.dailyCap }
  used() { this._roll(); return this.count }
  mark() { this._roll(); this.count++ }
  delay() { return Math.round(this.minMs + this.rand() * (this.maxMs - this.minMs)) }
}
