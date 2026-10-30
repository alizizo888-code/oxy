import { db } from './db'
import { team } from './team'

// In-app hotline (free): WebRTC audio between a customer and operations. Signalling rides on the `calls` document (each side writes only its own field),
// the media goes peer-to-peer. STUN is free; an optional TURN server (owner setting `hotline.turn`) improves reach on strict mobile networks.
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
const POLL_MS = 800

export function iceServers(turn) {
  const t = turn && turn.url ? [{ urls: String(turn.url).split(',').map((x) => x.trim()).filter(Boolean), username: turn.user || '', credential: turn.pass || '' }] : []
  return [...STUN, ...t]
}

// role: 'caller' (customer) | 'callee' (operations)
export class CallSession {
  constructor({ id, role, turn, onState, onRemote }) {
    this.id = id; this.role = role; this.onState = onState || (() => {}); this.onRemote = onRemote || (() => {})
    this.pc = new RTCPeerConnection({ iceServers: iceServers(turn) })
    this.mine = role === 'caller' ? 'cSig' : 'sSig'
    this.theirs = role === 'caller' ? 'sSig' : 'cSig'
    this.cands = []; this.appliedRemote = 0; this.sentCands = 0; this.remoteSet = false; this.closed = false; this.timer = null
    this.pc.onicecandidate = (e) => { if (e.candidate) { this.cands.push(e.candidate.toJSON()); this.flushSoon() } }
    this.pc.ontrack = (e) => this.onRemote(e.streams[0])
    this.pc.onconnectionstatechange = () => { const st = this.pc.connectionState; this.onState(st); if (st === 'failed') this.onState('failed') }
  }
  async mic() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    this.stream.getTracks().forEach((t) => this.pc.addTrack(t, this.stream))
  }
  setMuted(m) { this.stream?.getAudioTracks().forEach((t) => { t.enabled = !m }) }
  flushSoon() { clearTimeout(this._f); this._f = setTimeout(() => this.flush(), 350) }
  async flush(extra = {}) {
    if (this.closed) return
    const sig = { ...(this.sig || {}), ...extra, c: this.cands.slice() }
    this.sig = sig
    try { await db.updateShared('calls', this.id, { [this.mine]: sig }) } catch { /* next flush retries */ }
  }
  async startCaller() {
    await this.mic()
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true })
    await this.pc.setLocalDescription(offer)
    await this.flush({ sdp: offer.sdp, type: offer.type })
    this.poll()
  }
  async startCallee(callDoc) {
    await this.mic()
    const off = callDoc.cSig
    await this.pc.setRemoteDescription({ type: 'offer', sdp: off.sdp }); this.remoteSet = true
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    await this.flush({ sdp: answer.sdp, type: answer.type })
    await this.applyRemote(callDoc)
    this.poll()
  }
  async applyRemote(doc) {
    const sig = doc?.[this.theirs]
    if (!sig) return
    if (!this.remoteSet && this.role === 'caller' && sig.sdp) { await this.pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp }); this.remoteSet = true }
    if (!this.remoteSet) return
    const list = sig.c || []
    for (; this.appliedRemote < list.length; this.appliedRemote++) { try { await this.pc.addIceCandidate(list[this.appliedRemote]) } catch { /* stale */ } }
  }
  poll() {
    const run = async () => {
      if (this.closed) return
      try {
        const rows = await db.selectShared('calls', { id: this.id }, { limit: 1 })
        const doc = (rows || [])[0]
        if (doc) {
          this.doc = doc
          await this.applyRemote(doc)
          if (['ended', 'declined', 'missed'].includes(doc.status)) { this.onState(doc.status); return this.close() }
        }
      } catch { /* retry */ }
      this.timer = setTimeout(run, POLL_MS)
    }
    run()
  }
  close() {
    this.closed = true; clearTimeout(this.timer); clearTimeout(this._f)
    try { this.stream?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
    try { this.pc.close() } catch { /* ignore */ }
  }
}

export const hotlineSupported = () => typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export async function createCall({ name, phone, userId }) {
  const gid = await team.groupId()
  const row = await db.insertShared('calls', {
    status: 'ringing', name: name || 'عميل', phone: phone || '', userId: userId || '', createdAt: new Date().toISOString(),
  }, undefined, { groupId: gid, visibleTo: 'creator-and-admin', writableBy: 'creator-and-admin', expiresAt: new Date(Date.now() + 86400000).toISOString() })
  return row?.id
}
export const setCallStatus = (id, status, extra = {}) => db.updateShared('calls', id, { status, ...extra, ...(status === 'ended' || status === 'missed' || status === 'declined' ? { endedAt: new Date().toISOString() } : {}) })
