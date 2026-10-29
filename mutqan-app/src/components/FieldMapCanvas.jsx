import { useEffect, useRef, useState } from 'react'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
function ensureCss() {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET_CSS; document.head.appendChild(l)
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Field map: coloured emoji pins + route lines. points: [{id,lat,lng,emoji,color,label,pulse}], lines: [{from:[lat,lng],to:[lat,lng],color}]
export default function FieldMapCanvas({ points = [], lines = [], me = null, onSelect, onReady, className = '', height = 360 }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const fitted = useRef(false)
  const [L, setL] = useState(null)

  useEffect(() => { ensureCss(); import('leaflet').then((m) => setL(m.default || m)) }, [])
  useEffect(() => {
    if (!L || !el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([21.4225, 39.8262], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m)
    L.control.zoom({ position: 'bottomleft' }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    onReady?.(m)
    setTimeout(() => m.invalidateSize(), 200)
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L])

  useEffect(() => {
    if (!L || !map.current) return
    const g = layer.current; g.clearLayers()
    const all = []
    for (const ln of lines) L.polyline([ln.from, ln.to], { color: ln.color || '#38bdf8', weight: 3, dashArray: '6 6' }).addTo(g)
    for (const p of points) {
      if (p.lat == null || p.lng == null) continue
      const icon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: `<div style="width:34px;height:34px;border-radius:50%;background:${esc(p.color || '#38bdf8')};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:17px;${p.pulse ? 'animation:mqpulse 1.4s infinite;' : ''}">${esc(p.emoji || '📍')}</div>` })
      const mk = L.marker([p.lat, p.lng], { icon }).addTo(g)
      if (p.label) mk.bindTooltip(esc(p.label), { direction: 'top', offset: [0, -14] })
      mk.on('click', () => onSelect?.(p))
      all.push([p.lat, p.lng])
    }
    if (me?.lat != null) {
      L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: '<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:4px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>' }) }).addTo(g)
      all.push([me.lat, me.lng])
    }
    if (all.length && !fitted.current) { map.current.fitBounds(all, { padding: [30, 30], maxZoom: 14 }); fitted.current = true }
  }, [L, points, lines, me, onSelect])

  return (
    <>
      <style>{'@keyframes mqpulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}100%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}'}</style>
      <div ref={el} className={className} style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', background: '#0b1220' }} />
    </>
  )
}
