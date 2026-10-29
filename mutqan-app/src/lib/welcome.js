import { useCallback, useEffect, useState } from 'react'
import { post } from './_api'
import { getDeviceId } from './device'

export const WELCOME_PCT = 30
export const WELCOME_MAX = 20   // SAR cap, always shown next to the percentage
export const WELCOME_LABEL = `${WELCOME_PCT}% حتى ${WELCOME_MAX} ر.س`
// Real discount for a total: pct% but never above the advertised cap.
export const welcomeOff = (total, pct = WELCOME_PCT, max = WELCOME_MAX) => Math.round(Math.min((Number(total) || 0) * pct / 100, max) * 100) / 100
export const SITE_URL = 'https://oxygen11.com'
export const APP_SHARE_URL = 'https://mutqan.oxygen11.com/'

// state: loading | available | claimed | used | blocked
export function useWelcome() {
  const [st, setSt] = useState({ state: 'loading', pct: WELCOME_PCT })
  const call = useCallback(async (op) => {
    try {
      const r = await post('/promo', { op, deviceId: getDeviceId() })
      setSt({ state: r.state, pct: r.pct || WELCOME_PCT })
      return r
    } catch { setSt((s) => (s.state === 'loading' ? { state: 'blocked', pct: 0 } : s)); return null }
  }, [])
  useEffect(() => { call('status') }, [call])
  return { ...st, claim: () => call('claim'), refresh: () => call('status') }
}

export function shareText() {
  return `🎁 حمّل تطبيق أكسجين (متقن) واحصل على خصم ${WELCOME_LABEL} على أول طلب صيانة!\nالتطبيق: ${APP_SHARE_URL}\nالموقع: ${SITE_URL}`
}
