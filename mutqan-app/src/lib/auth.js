import { post, setSession, currentUser, onUser, getToken, getAnonId, restoreSession } from './_api'
import { showAuthModal } from './auth-modal'

let refreshed = false
async function refresh() {
  if (!getToken()) return
  try {
    let r = await post('/auth', { op: 'me' })
    // A single empty answer (cache hiccup, cold server) must not log the owner out: confirm once.
    if (!(r && r.user)) { await new Promise((ok) => setTimeout(ok, 1500)); r = await post('/auth', { op: 'me' }) }
    if (r && r.user) setSession(getToken(), r.user)
    else setSession('', null)
  } catch (e) { /* offline: keep cached user */ }
}
if (typeof window !== 'undefined' && !refreshed) { refreshed = true; restoreSession().finally(() => refresh()) }

export const auth = {
  getCurrentUser: () => currentUser(),
  isAuthenticated: () => !!currentUser() && !!getToken(),
  // The owner is the single account with role "owner" (created in WordPress admin).
  isAppOwner: () => currentUser()?.role === 'owner',
  onAuthChange(cb) { return onUser(cb) },
  refresh,
  // Customer sign-in / sign-up (phone + password) in a small modal. Resolves the user or null.
  signIn: (opts) => showAuthModal(opts),
  async login({ phone, password }) {
    const r = await post('/auth', { op: 'login', phone, password })
    setSession(r.token, r.user); return r.user
  },
  async signUp({ name, phone, password }) {
    const r = await post('/auth', { op: 'signup', name, phone, password })
    setSession(r.token, r.user); return r.user
  },
  async updateProfile(patch) {
    const r = await post('/auth', { op: 'profile', ...patch })
    if (r.user) setSession(getToken(), r.user)
    return r.user
  },
  changePassword: (current, next) => post('/auth', { op: 'password', current, next }),
  async signOut() {
    try { await post('/auth', { op: 'logout' }) } catch { /* token is dropped locally anyway */ }
    setSession('', null)
  },
  anonymousId: getAnonId,
}

export const adoptSession = (r) => { if (r && r.token) setSession(r.token, r.user) }
