import { useEffect, useState, useCallback } from 'react'
import { auth } from '../lib/auth'
import { social } from '../lib/social'
import { team } from '../lib/team'

// Resolves: the fixed team group id, the current caller's role in it, and
// whether they are the app owner. Used to gate every staff screen.
export function useTeamRole() {
  const [state, setState] = useState({ loading: true, gid: null, role: null, isOwner: false, signedIn: false })

  const load = useCallback(async () => {
    try {
      const gid = await team.groupId()
      const isOwner = auth.isAppOwner()
      if (isOwner) {
        try { await social.claimGroupOwnership(gid) } catch {}
        try { await social.setAdminRoles(gid, ['operations', 'supervisor', 'technician']) } catch {}
        setState({ loading: false, gid, role: 'owner', isOwner: true, signedIn: true })
        return
      }
      const role = await social.getMyRole(gid)
      setState({ loading: false, gid, role, isOwner: false, signedIn: !!role })
    } catch (e) {
      setState({ loading: false, gid: null, role: null, isOwner: false, signedIn: false })
    }
  }, [])

  useEffect(() => {
    load()
    const unsub = auth.onAuthChange(() => load())
    return () => unsub && unsub()
  }, [load])

  return { ...state, refresh: load }
}
