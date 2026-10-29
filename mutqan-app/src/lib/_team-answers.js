// Maps server errors / input problems to the label keys used by TeamLogin.
export function teamFailureKey(e, step, pinMode) {
  switch (e && e.code) {
    case 'NETWORK': return 'offline'
    case 'bad_credentials': return pinMode ? 'wrongPin' : 'wrongPassword'
    case 'rate_limited': return 'tooManyTries'
    case 'pending': return 'pendingApproval'
    case 'handle_taken': return 'usernameTaken'
    case 'invalid_invite': return 'invalidInvite'
    case 'bad_username': return 'usernameLatinOnly'
    case 'weak_password': return pinMode ? 'pinSix' : 'passwordMin'
    case 'forbidden': return step === 'request' ? 'requestsClosed' : 'genericError'
    default: return 'genericError'
  }
}
export function usernameProblem(handle) {
  const h = String(handle || '').trim()
  if (h.length < 3) return 'usernameTooShort'
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(h)) return 'usernameLatinOnly'
  return null
}
export function secretProblem(pinMode, secret) {
  const s = String(secret || '')
  if (pinMode) return /^\d{6}$/.test(s) ? null : 'pinSix'
  return s.length >= 6 ? null : 'passwordMin'
}
