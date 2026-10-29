// Device biometric quick-login via WebAuthn / Passkeys.
// The fingerprint / face check happens entirely on the device (OS). MUTQAN never
// sees or stores any biometric data — only the credential id the device returns,
// kept on THIS device next to the verified customer's session.
const KEY = 'metqan_passkey'

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

export function getPasskey() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function removePasskey() {
  try { localStorage.removeItem(KEY) } catch {}
}

export async function passkeySupported() {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// Verified customer → register a device credential that requires biometric/device unlock.
export async function enrollPasskey(session) {
  const { at, ...profile } = session || {}
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'مُتقن MUTQAN' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: profile.phone || profile.name || 'mutqan-customer',
        displayName: profile.name || 'عميل مُتقن',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  })
  if (!cred) throw new Error('cancelled')
  const record = { credentialId: b64url(cred.rawId), profile, createdAt: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify(record))
  return record
}

// Ask the device to verify the user (fingerprint / face / device PIN).
// Resolves with the stored customer profile only when the device confirms user verification.
export async function unlockWithPasskey() {
  const rec = getPasskey()
  if (!rec?.credentialId) throw new Error('not_enrolled')
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: fromB64url(rec.credentialId), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  if (!assertion || b64url(assertion.rawId) !== rec.credentialId) throw new Error('mismatch')
  const flags = new Uint8Array(assertion.response.authenticatorData)[32]
  if (!(flags & 0x04)) throw new Error('not_verified') // UV bit — device confirmed the person
  return rec.profile
}

export function passkeyErrorMessage(e) {
  if (e?.name === 'NotAllowedError') return 'تم إلغاء التحقق أو انتهت المهلة'
  if (e?.name === 'SecurityError') return 'البصمة تعمل على التطبيق المنشور فقط وليس في المعاينة'
  if (e?.message === 'not_enrolled') return 'البصمة غير مفعّلة على هذا الجهاز — سجّل الدخول بحساب Google أو Apple'
  return 'تعذر التحقق بالبصمة — سجّل الدخول بحساب Google أو Apple بدلًا منها'
}
