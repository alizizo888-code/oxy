import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigation, Phone } from 'lucide-react'
import FieldMapCanvas from './FieldMapCanvas'
import { maps } from '../lib/maps'
import { isTechAvailable } from '../assignment'
import { ACTIVE_STATUSES, specialtyLabel } from '../constants'
import { seenAgo } from '../lib/crm'

const km = (m) => (m < 1000 ? `${Math.round(m)} م` : `${(m / 1000).toFixed(1)} كم`)
const navUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

// Technician field map: my live position, the nearest colleague, the customer I'm heading to and the nearest open repair shops.
export default function TechMap({ myId, myProfile, profiles, orders, shops, upsertProfile }) {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const lastWrite = useRef(0)
  const profRef = useRef(myProfile)
  profRef.current = myProfile

  useEffect(() => {
    const w = maps.watchLocation((p) => {
      setMe({ lat: p.lat, lng: p.lng })
      const now = Date.now()
      // publish my position (at most every 30 s) so operations and colleagues see "last seen" and distance
      if (myId && profRef.current && now - lastWrite.current > 30000) {
        lastWrite.current = now
        upsertProfile({ ...profRef.current, userId: myId, lat: p.lat, lng: p.lng, lastSeenAt: new Date().toISOString() }).catch(() => {})
      }
    })
    maps.getCurrentLocation().then((p) => setMe({ lat: p.lat, lng: p.lng })).catch(() => setErr('فعّل خدمة الموقع ليظهر موقعك على الخريطة'))
    return () => w.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  const here = me || (myProfile?.lat != null ? { lat: myProfile.lat, lng: myProfile.lng } : myProfile?.homeLat != null ? { lat: myProfile.homeLat, lng: myProfile.homeLng } : null)
  const d = (a, b) => { try { return maps.distance(a.lat, a.lng, b.lat, b.lng) } catch { return Infinity } }

  const mine = useMemo(() => (orders || []).filter((o) => o.technicianId === myId && ACTIVE_STATUSES.includes(o.status) && o.lat != null), [orders, myId])
  const nearestTech = useMemo(() => {
    if (!here) return null
    let best = null
    for (const t of profiles || []) {
      if (t.userId === myId) continue
      const lat = t.lat ?? t.homeLat, lng = t.lng ?? t.homeLng
      if (lat == null) continue
      const dist = d(here, { lat, lng })
      if (!best || dist < best.dist) best = { t, lat, lng, dist }
    }
    return best
  }, [here, profiles, myId])
  const nearShops = useMemo(() => here ? (shops || []).filter((s) => s.lat != null && s.available !== false).map((s) => ({ s, dist: d(here, s) })).sort((a, b) => a.dist - b.dist).slice(0, 6) : [], [here, shops])

  const points = [
    ...mine.map((o) => ({ id: 'o' + o.id, lat: o.lat, lng: o.lng, emoji: '🏠', color: '#ef4444', label: `${o.clientName || 'عميل'} — وجهتي` })),
    ...(nearestTech ? [{ id: 'nt', lat: nearestTech.lat, lng: nearestTech.lng, emoji: '🧰', color: '#10b981', label: `${nearestTech.t.displayName || 'فني'} (الأقرب)` }] : []),
    ...nearShops.map(({ s }) => ({ id: 's' + s.id, lat: s.lat, lng: s.lng, emoji: '🏪', color: '#8b5cf6', label: s.name })),
  ]
  const lines = here ? mine.map((o) => ({ from: [here.lat, here.lng], to: [o.lat, o.lng], color: '#ef4444' })) : []

  return (
    <div className="grid gap-3">
      {err && <p className="text-xs text-amber-300 bg-amber-500/10 rounded-xl p-2">{err}</p>}
      <FieldMapCanvas points={points} lines={lines} me={here} height={330} />
      <div className="grid gap-2">
        {mine.map((o) => (
          <div key={o.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0"><p className="text-sm font-black text-white truncate">🏠 {o.clientName || 'عميل'} — {specialtyLabel(o.specialtyId)}</p><p className="text-[11px] text-slate-400 truncate">{o.address || ''}{here ? ` • يبعد ${km(d(here, o))}` : ''}</p></div>
            <a href={navUrl(o.lat, o.lng)} target="_blank" rel="noreferrer" className="shrink-0 bg-primary text-black rounded-xl px-3 py-2 text-xs font-black flex items-center gap-1"><Navigation size={14} />توجيه</a>
          </div>
        ))}
        {mine.length === 0 && <p className="text-xs text-slate-500">لا توجد مهمة نشطة — وجهة العميل تظهر هنا فور إسناد طلب لك.</p>}
        {nearestTech && <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2"><div className="flex-1"><p className="text-sm font-black text-white">🧰 أقرب فني: {nearestTech.t.displayName || 'فني'}</p><p className="text-[11px] text-slate-400">يبعد {km(nearestTech.dist)} • {isTechAvailable(nearestTech.t, orders || []) ? 'متاح' : 'مشغول'} • آخر ظهور {seenAgo(nearestTech.t.lastSeenAt || nearestTech.t.updatedAt)}</p></div>{nearestTech.t.phone && <a href={`tel:${nearestTech.t.phone}`} className="bg-emerald-600 rounded-xl p-2"><Phone size={15} /></a>}</div>}
        <p className="text-xs font-black text-slate-200 mt-1">🏪 محلات الصيانة المتاحة (الأقرب أولًا)</p>
        {nearShops.map(({ s, dist }) => <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2"><div className="flex-1 min-w-0"><p className="text-sm font-bold text-white truncate">{s.name}</p><p className="text-[11px] text-slate-400">يبعد {km(dist)} • آخر ظهور {seenAgo(s.lastSeenAt || s.updatedAt)}</p></div><a href={navUrl(s.lat, s.lng)} target="_blank" rel="noreferrer" className="bg-violet-600 rounded-xl p-2"><Navigation size={15} /></a>{s.phone && <a href={`tel:${s.phone}`} className="bg-emerald-600 rounded-xl p-2"><Phone size={15} /></a>}</div>)}
        {nearShops.length === 0 && <p className="text-xs text-slate-500">لم تُضف محلات قريبة بعد (تضيفها العمليات من الخريطة الميدانية).</p>}
      </div>
    </div>
  )
}
