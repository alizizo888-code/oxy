import { useCallback } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'

// Loads the technician profiles + the operations-room assignment settings
// (mode: manual/auto, strategy: nearest/capacity). Profiles and settings live in
// the team's own group so the operations supervisor and every technician read them.
export function useTechProfiles() {
  const { data: profiles, loading } = useLiveShared('tech_profiles', { order: 'displayName', limit: 300 })
  const { data: settingsRows } = useLiveShared('assignment_settings', { limit: 5 })
  const settings = settingsRows?.[0] || null

  // Each technician's profile is keyed by their own user id (idempotent upsert).
  const upsertProfile = useCallback(async (profile) => {
    const gid = await team.groupId()
    await db.upsertShared('tech_profiles', profile, profile.userId, {
      groupId: gid,
      visibleTo: 'group',
      writableBy: 'creator-and-admin',
    })
  }, [])

  const updateSettings = useCallback(async (patch) => {
    const gid = await team.groupId()
    const next = { mode: settings?.mode || 'manual', strategy: settings?.strategy || 'smart', ...patch }
    await db.upsertShared('assignment_settings', next, 'default', {
      groupId: gid,
      visibleTo: 'group',
      writableBy: 'admins',
    })
  }, [settings])

  return { profiles, settings, loading, upsertProfile, updateSettings }
}
