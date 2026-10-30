import { useEffect, useState, useCallback, useRef } from 'react'
import { auth } from '../lib/auth'
import { getToken, currentUser } from '../lib/_api'
import { social } from '../lib/social'
import { team } from '../lib/team'

// Resolves: the fixed team group id, the current caller's role in it, and whether they are the app owner. Used to gate every staff screen.
// The owner is recognised instantly from the signed-in account (no network), so moving between screens never flashes "no permission";
// roles of other staff are cached per user and a transient network failure never wipes a known role.
let cache = { uid: null, gid: null, role: null }
// Once an account has been confirmed as owner it stays owner on this device until sign-out — a transient/partial user object must never demote it.
const OWN_KEY = 'mq_owner_uid'
const ownerSeen = (uid) => { try { return !!uid && localStorage.getItem(OWN_KEY) === String(uid) } catch { return false } }
const markOwner = (uid) => { try { if (uid) localStorage.setItem(OWN_KEY, String(uid)) } catch { /* ignore */ } }
const isOwnerNow = (u) => auth.isAppOwner() || ownerSeen(u?.id)

function initial() {
  const u = currentUser()
  if (isOwnerNow(u)) return { loading: false, gid: cache.uid === u?.id ? cache.gid : null, role: 'owner', isOwner: true, signedIn: true }
  if (u && cache.uid === u.id && cache.role) return { loading: false, gid: cache.gid, role: cache.role, isOwner: false, signedIn: true }
  // A token exists but the account is still being restored → stay "loading" instead of denying.
  return { loading: !!getToken() || !u, gid: null, role: null, isOwner: false, signedIn: false }
}

export function useTeamRole() {
  const [state, setState] = useState(initial)
  const alive = useRef(true)

  const load = useCallback(async (attempt = 0) => {
    const u = currentUser()
    const owner = isOwnerNow(u)
    if (auth.isAppOwner()) markOwner(u?.id)
    if (!u && getToken()) return                       // session still restoring; onAuthChange will call us again
    try {
      const gid = await team.groupId()
      if (owner) {
        try { await social.claimGroupOwnership(gid) } catch { /* already claimed */ }
        try { await social.setAdminRoles(gid, ['operations', 'supervisor', 'technician']) } catch { /* ignore */ }
        cache = { uid: u.id, gid, role: 'owner' }
        if (alive.current) setState({ loading: false, gid, role: 'owner', isOwner: true, signedIn: true })
        return
      }
      const role = u ? await social.getMyRole(gid) : null
      if (u) cache = { uid: u.id, gid, role }
      if (alive.current) setState({ loading: false, gid, role, isOwner: false, signedIn: !!role })
    } catch {
      if (attempt < 2) { setTimeout(() => alive.current && load(attempt + 1), 1500 * (attempt + 1)); return }
      // Keep whatever we already knew (owner stays owner); only a never-resolved visitor ends up signed out.
      if (alive.current) setState((s) => (s.loading ? { loading: false, gid: null, role: owner ? 'owner' : null, isOwner: owner, signedIn: owner } : s))
    }
  }, [])

  useEffect(() => {
    alive.current = true
    load()
    const unsub = auth.onAuthChange(() => { setState(initial()); load() })
    return () => { alive.current = false; unsub && unsub() }
  }, [load])

  return { ...state, refresh: load }
}
