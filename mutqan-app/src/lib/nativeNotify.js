// Native (Android app) local notifications: the Notification API does not exist inside the app shell, so alerts from the live inbox
// are shown through the Capacitor LocalNotifications plugin. Does nothing in a normal browser.
const native = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
const plugin = () => (native() ? window.Capacitor.registerPlugin('LocalNotifications') : null)
let asked = false
let n = Math.floor(Date.now() / 1000) % 1000000

export async function nativeAskPermission() {
  const p = plugin(); if (!p || asked) return
  asked = true
  try { const s = await p.checkPermissions(); if (s.display !== 'granted') await p.requestPermissions() } catch { /* ignore */ }
  try { await p.createChannel({ id: 'alerts', name: 'تنبيهات الطلبات', importance: 5, visibility: 1, vibration: true, sound: 'default' }) } catch { /* ignore */ }
}

export async function nativeNotify(m) {
  const p = plugin(); if (!p || !m || m.silent) return
  try {
    await p.schedule({ notifications: [{ id: ++n % 2147483000, title: String(m.title || 'تنبيه'), body: String(m.body || ''), channelId: 'alerts', schedule: { at: new Date(Date.now() + 300) }, extra: { url: m.url || '' } }] })
  } catch { /* ignore */ }
}
