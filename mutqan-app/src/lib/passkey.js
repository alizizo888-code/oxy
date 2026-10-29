import { post, setSession } from './_api'

// Owner biometric sign-in (WebAuthn): fingerprint / face / device PIN. Free, no third party.
const FLAG = 'mq_pk'
const op = (name, body) => post('/team', { op: name, ...(body || {}) })
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0)).buffer

const lsGet = () => { try { return localStorage.getItem(FLAG) } catch { return null } }
const lsSet = (v) => { try { v ? localStorage.setItem(FLAG, v) : localStorage.removeItem(FLAG) } catch { /* private mode */ } }

export const passkey = {
  hasDeviceKey: () => lsGet() === '1',
  async supported() {
    try {
      if (!window.PublicKeyCredential || !navigator.credentials) return false
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch { return false }
  },
  // Owner, already signed in with username + password: bind this device's biometrics.
  async register(name) {
    const { publicKey } = await op('pkRegOptions')
    const pk = {
      ...publicKey,
      challenge: unb64u(publicKey.challenge),
      user: { ...publicKey.user, id: unb64u(publicKey.user.id) },
      excludeCredentials: (publicKey.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })),
    }
    const cred = await navigator.credentials.create({ publicKey: pk })
    await op('pkRegVerify', {
      id: b64u(cred.rawId),
      clientDataJSON: b64u(cred.response.clientDataJSON),
      attestationObject: b64u(cred.response.attestationObject),
      name: name || (/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone / iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'هذا الجهاز'),
    })
    lsSet('1')
    return true
  },
  // Sign in with biometrics only. Resolves the user, throws on cancel/failure.
  async login() {
    const { publicKey } = await op('pkLoginOptions')
    const cred = await navigator.credentials.get({
      publicKey: {
        ...publicKey,
        challenge: unb64u(publicKey.challenge),
        allowCredentials: (publicKey.allowCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })),
      },
    })
    const r = await op('pkLoginVerify', {
      id: b64u(cred.rawId),
      clientDataJSON: b64u(cred.response.clientDataJSON),
      authenticatorData: b64u(cred.response.authenticatorData),
      signature: b64u(cred.response.signature),
    })
    setSession(r.token, r.user)
    lsSet('1')
    return r.user
  },
  list: () => op('pkList').then((r) => r.keys || []),
  remove: (id) => op('pkRemove', { id }),
  forgetDevice: () => lsSet(null),
}
