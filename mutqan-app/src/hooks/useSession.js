import { useCallback, useEffect, useState } from 'react'

// Local visitor session: { type: 'guest' | 'verified', email?, name?, phone?, at }
// Stored per device so a returning visitor keeps their identity and profile.
const KEY = 'metqan_session'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useSession() {
  const [session, setSessionState] = useState(read)

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setSessionState(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setSession = useCallback((s) => {
    setSessionState(s)
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s))
      else localStorage.removeItem(KEY)
    } catch {}
  }, [])

  return { session, setSession }
}
