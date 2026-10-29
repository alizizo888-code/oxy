import { useCallback, useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { mergeNotifySettings } from '../notify'

// One shared settings row for the notification system — only team admins can change it.
export function useNotifySettings() {
  const { data, loading } = useLiveShared('notify_settings', { limit: 1 })
  const settings = useMemo(() => mergeNotifySettings(data?.[0]), [data])

  const update = useCallback(async (patch) => {
    const gid = await team.groupId()
    const { id, _id, ...rest } = mergeNotifySettings(data?.[0])
    await db.upsertShared('notify_settings', { ...rest, ...patch, updatedAt: new Date().toISOString() }, 'default', {
      groupId: gid,
      writableBy: 'admins',
    })
  }, [data])

  return { settings, loading, update }
}
