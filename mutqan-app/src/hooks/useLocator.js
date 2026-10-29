import { useCallback, useState } from 'react'
import { maps } from '../lib/maps'

// Reads a browser permission WITHOUT prompting ('granted' | 'denied' | 'prompt' | 'unknown').
export async function permissionState(name) {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    const r = await navigator.permissions.query({ name })
    return r.state
  } catch {
    return 'unknown'
  }
}

export function notificationState() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

// Location is ONLY requested when the user taps "تحديد الموقع" — never on screen open.
// If the permission was blocked earlier, `denied` becomes true so the screen can show
// the "تفعيل الأذونات" button that guides the user back into the device settings.
export function useLocator() {
  const [locating, setLocating] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')

  const locate = useCallback(async () => {
    setLocating(true)
    setError('')
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      let address = ''
      try { address = (await maps.reverseGeocode(lat, lng))?.address || '' } catch {}
      setDenied(false)
      return { lat, lng, address }
    } catch (e) {
      const st = await permissionState('geolocation')
      const isDenied = st === 'denied' || /denied|permission/i.test(String(e?.message || ''))
      setDenied(isDenied)
      setError(isDenied ? 'صلاحية الموقع مقفولة على هذا الجهاز — فعّلها ثم أعد المحاولة' : 'تعذر تحديد موقعك الآن — تأكد من تشغيل الموقع (GPS) وحاول مرة أخرى، أو حدده على الخريطة')
      return null
    } finally {
      setLocating(false)
    }
  }, [])

  return { locate, locating, denied, error, clearError: () => setError('') }
}
