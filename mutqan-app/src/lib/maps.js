import { get } from './_api'

const R = 6371000
const rad = (d) => (d * Math.PI) / 180

export const maps = {
  // metres between two points (haversine)
  distance(lat1, lng1, lat2, lng2) {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
  },
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('الموقع غير مدعوم في هذا المتصفح')); return }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => reject(Object.assign(new Error(e.message || 'تعذر تحديد الموقع'), { code: e.code === 1 ? 'PERMISSION_DENIED' : 'LOCATION_UNAVAILABLE' })),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      )
    })
  },
  async reverseGeocode(lat, lng) {
    const r = await get(`/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
    return { address: r.address || '' }
  },
  // callback({lat,lng,accuracy}); returns { stop() }
  watchLocation(cb) {
    if (!navigator.geolocation) return { stop() {} }
    const id = navigator.geolocation.watchPosition(
      (p) => { try { cb({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }) } catch { /* callback errors are the caller's */ } },
      () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return { stop: () => navigator.geolocation.clearWatch(id) }
  },
}
