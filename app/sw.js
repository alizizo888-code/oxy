/* Mutqan service worker: app shell works offline; API and WordPress are never cached. */
const V = 'mutqan-__BUILD__'
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k)
    await self.clients.claim()
  })())
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data && e.notification.data.url ? String(e.notification.data.url).replace(/^#/, '') : ''
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const w = all[0]
    if (w) { await w.focus(); if (url) w.postMessage({ type: 'goto', url }); return }
    await clients.openWindow(self.registration.scope + (url ? '#' + url : ''))
  })())
})
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin || u.pathname.includes('/wp-json/') || u.pathname.includes('/wp-admin') || u.pathname.includes('/wp-login')) return
  if (r.mode === 'navigate') {   // always try the network first so updates show up; fall back to the cached shell offline
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((ca) => ca.put('shell', c)); return res }).catch(async () => (await caches.match('shell')) || new Response('<meta charset="utf-8"><body dir="rtl" style="font-family:Tahoma;padding:2rem">لا يوجد اتصال بالإنترنت حاليًا.</body>', { headers: { 'content-type': 'text/html; charset=utf-8' } })))
    return
  }
  if (/\/assets\/|\.(png|svg|webp|woff2?)$/i.test(u.pathname)) {   // hashed build files: cache-first
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((ca) => ca.put(r, c)) } return res })))
  }
})
