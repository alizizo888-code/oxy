import { useMemo, useRef, useState } from 'react'
import { Phone, X } from 'lucide-react'
import FieldMapCanvas from '../FieldMapCanvas'
import { specialtyLabel } from '../../constants'
import { buildCustomers, seenAgo } from '../../lib/crm'
import { isTechAvailable } from '../../assignment'
import { DONE, RUNNING, isToday, isUnassigned, techPos, rankTechs, kmText, ageText } from './helpers'

const LAYERS = [
  { id: 'wait', label: 'بانتظار الإسناد', emoji: '🔔', color: '#ef4444' },
  { id: 'run', label: 'جارية', emoji: '🛠️', color: '#f59e0b' },
  { id: 'assigned', label: 'مُسندة', emoji: '📌', color: '#3b82f6' },
  { id: 'done', label: 'تمت اليوم', emoji: '✅', color: '#10b981' },
  { id: 'failed', label: 'لم تتم', emoji: '⚠️', color: '#be123c' },
  { id: 'tech', label: 'الفنيون', emoji: '🧰', color: '#22c55e' },
  { id: 'old', label: 'عملاء قدامى', emoji: '👤', color: '#6366f1' },
  { id: 'new', label: 'عملاء جدد', emoji: '🆕', color: '#14b8a6' },
]

// Internal field map: every order by state, technicians (live GPS), old / new customers, and a line from each technician to the job he carries.
export default function OpsMap({ orders, profiles, crm, onAssign, onAuto, onOpenOrder }) {
  const [on, setOn] = useState(() => Object.fromEntries(LAYERS.map((l) => [l.id, l.id !== 'old' && l.id !== 'new'])))
  const [sel, setSel] = useState(null)
  const mapRef = useRef(null)
  const customers = useMemo(() => buildCustomers(orders || [], crm || []), [orders, crm])

  const { points, lines, counts } = useMemo(() => {
    const pts = [], ln = [], c = {}
    const bump = (k) => { c[k] = (c[k] || 0) + 1 }
    const techById = Object.fromEntries((profiles || []).map((t) => [t.userId, t]))
    for (const o of orders || []) {
      if (o.lat == null || o.lng == null) continue
      let g = null
      if (isUnassigned(o)) g = 'wait'
      else if (RUNNING.includes(o.status)) g = 'run'
      else if (['assigned', 'forced'].includes(o.status) || o.inhouse && !DONE.includes(o.status) && o.status !== 'cancelled') g = 'assigned'
      else if (DONE.includes(o.status) && isToday(o.completedAt || o.updatedAt)) g = 'done'
      else if ((o.status === 'cancelled' && isToday(o.updatedAt)) || (o.escalation && !DONE.includes(o.status) && o.status !== 'cancelled')) g = 'failed'
      if (!g) continue
      bump(g)
      if (!on[g]) continue
      const L = LAYERS.find((x) => x.id === g)
      pts.push({ id: 'o' + o.id, kind: 'order', data: o, lat: o.lat, lng: o.lng, emoji: L.emoji, color: L.color, pulse: g === 'wait', label: `${specialtyLabel(o.specialtyId)} · ${o.clientName || ''}` })
      const t = o.technicianId && techById[o.technicianId]
      const p = t && techPos(t)
      if (p && ['assigned', ...RUNNING].includes(o.status) && on.tech) ln.push({ from: [p.lat, p.lng], to: [o.lat, o.lng], color: g === 'run' ? '#f59e0b' : '#60a5fa' })
    }
    for (const t of profiles || []) {
      const p = techPos(t); if (!p) continue
      const av = isTechAvailable(t, orders || [])
      bump('tech')
      if (!on.tech) continue
      pts.push({ id: 't' + t.userId, kind: 'tech', data: t, lat: p.lat, lng: p.lng, emoji: '🧰', color: t.active === false ? '#64748b' : av ? '#22c55e' : '#f97316', label: `${t.displayName || 'فني'} · ${t.active === false ? 'مغلق' : av ? 'متاح' : 'مشغول'}${p.live ? ' · مباشر' : ''}` })
    }
    for (const cu of customers) {
      const g = cu.status === 'new' ? 'new' : 'old'
      bump(g)
      if (!on[g]) continue
      const L = LAYERS.find((x) => x.id === g)
      pts.push({ id: 'c' + cu.key, kind: 'customer', data: cu, lat: cu.lat, lng: cu.lng, emoji: L.emoji, color: L.color, label: cu.name || cu.phone || 'عميل' })
    }
    return { points: pts, lines: ln, counts: c }
  }, [orders, profiles, customers, on])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LAYERS.map((l) => (
          <button key={l.id} onClick={() => setOn((p) => ({ ...p, [l.id]: !p[l.id] }))} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${on[l.id] ? 'text-white' : 'opacity-40 text-slate-300'}`} style={{ borderColor: l.color, background: on[l.id] ? l.color + '33' : 'transparent' }}>
            {l.emoji} {l.label}{counts[l.id] ? ` (${counts[l.id]})` : ''}
          </button>
        ))}
      </div>
      <div className="relative">
        <FieldMapCanvas points={points} lines={lines} height={440} onSelect={setSel} onReady={(m) => { mapRef.current = m }} />
        {sel && (
          <div className="absolute inset-x-2 bottom-2 z-[500] max-h-[62%] overflow-y-auto bg-[#0d1220]/95 backdrop-blur border border-white/15 rounded-2xl p-3">
            <button onClick={() => setSel(null)} className="absolute left-2 top-2 text-slate-400"><X size={16} /></button>
            {sel.kind === 'order' && <OrderPanel o={sel.data} profiles={profiles} orders={orders} onAssign={onAssign} onAuto={onAuto} onOpen={onOpenOrder} />}
            {sel.kind === 'tech' && <TechPanel t={sel.data} orders={orders} onOpen={onOpenOrder} />}
            {sel.kind === 'customer' && <CustomerPanel c={sel.data} />}
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500">الفنيون «مباشر» عندما يكون تطبيقهم مفتوحًا ويرسل موقعه (آخر 10 دقائق)، وإلا يظهر آخر موقع معروف أو موقع السكن.</p>
    </div>
  )
}

const Row = ({ k, v }) => (v ? <p className="text-xs text-slate-300"><span className="text-slate-500">{k}: </span>{v}</p> : null)

function OrderPanel({ o, profiles, orders, onAssign, onAuto, onOpen }) {
  const top = isUnassigned(o) ? rankTechs(o, profiles, orders).filter((r) => r.ok).slice(0, 3) : []
  return (
    <div className="grid gap-1.5 pr-1">
      <p className="font-black text-white text-sm">{specialtyLabel(o.specialtyId)} · {o.clientName || 'عميل'}</p>
      <Row k="الحالة" v={`${o.status}${o.technicianName ? ` — ${o.technicianName}` : ''}`} />
      <Row k="العنوان" v={o.address} /><Row k="الجوال" v={o.clientPhone} /><Row k="منذ" v={ageText(o.createdAt)} />
      <Row k="السعر" v={o.agreedPrice || o.price || o.priceQuote?.total ? `${o.agreedPrice || o.price || o.priceQuote?.total} ر.س` : ''} />
      {top.length > 0 && <p className="text-[11px] text-emerald-300">الأقرب: {top.map((r) => `${r.t.displayName || 'فني'} (${kmText(r.dist)})`).join(' • ')}</p>}
      <div className="flex gap-2 mt-1 flex-wrap">
        {isUnassigned(o) && <button onClick={() => onAssign(o)} className="flex-1 bg-primary text-black font-black rounded-xl py-2 text-xs">إسناد يدوي</button>}
        {isUnassigned(o) && <button onClick={() => onAuto(o)} className="flex-1 bg-emerald-500 text-black font-black rounded-xl py-2 text-xs">إسناد آلي لأنسب فني</button>}
        {!isUnassigned(o) && ['assigned', 'forced'].includes(o.status) && <button onClick={() => onAssign(o)} className="flex-1 bg-white/10 rounded-xl py-2 text-xs font-bold">إعادة إسناد</button>}
        <button onClick={() => onOpen(o)} className="flex-1 bg-white/10 rounded-xl py-2 text-xs font-bold">فتح الطلب</button>
        {o.clientPhone && <a href={`tel:${o.clientPhone}`} className="bg-emerald-600 rounded-xl px-3 flex items-center"><Phone size={14} /></a>}
      </div>
    </div>
  )
}

function TechPanel({ t, orders, onOpen }) {
  const mine = (orders || []).filter((o) => o.technicianId === t.userId && !DONE.includes(o.status) && o.status !== 'cancelled')
  const doneToday = (orders || []).filter((o) => o.technicianId === t.userId && DONE.includes(o.status) && isToday(o.completedAt || o.updatedAt)).length
  const p = techPos(t)
  return (
    <div className="grid gap-1.5 pr-1">
      <p className="font-black text-white text-sm">🧰 {t.displayName || 'فني'}</p>
      <Row k="الحالة" v={t.active === false ? 'مغلق' : isTechAvailable(t, orders) ? 'متاح' : 'مشغول / اكتملت السعة'} />
      {t.battery != null && <Row k="البطارية" v={`${t.battery}%${t.charging ? ' (تشحن)' : ''}${t.net ? ` · ${t.net}` : ''}`} />}
      <Row k="الموقع" v={p?.live ? 'مباشر الآن' : `آخر ظهور ${seenAgo(t.lastSeenAt || t.updatedAt)}`} />
      <Row k="اليوم" v={`${mine.length} مهمة جارية · ${doneToday} مكتملة`} />
      {mine.map((o) => <button key={o.id} onClick={() => onOpen(o)} className="text-right bg-white/5 rounded-lg px-2 py-1.5 text-[11px] text-slate-200">{specialtyLabel(o.specialtyId)} · {o.clientName || ''} — {o.status}</button>)}
      {t.phone && <a href={`tel:${t.phone}`} className="mt-1 flex items-center justify-center gap-2 bg-emerald-600 rounded-xl py-2 text-xs font-bold"><Phone size={14} />اتصال</a>}
    </div>
  )
}

function CustomerPanel({ c }) {
  const done = c.orders.filter((o) => DONE.includes(o.status)).length
  const lo = c.lastOrder
  return (
    <div className="grid gap-1.5 pr-1">
      <p className="font-black text-white text-sm">{c.name || 'عميل'}</p>
      <Row k="الجوال" v={c.phone} /><Row k="الطلبات" v={`${c.orders.length} (مكتمل ${done})`} /><Row k="آخر ظهور" v={seenAgo(c.lastAt)} />
      {lo && <Row k="آخر خدمة" v={`${specialtyLabel(lo.specialtyId)} — ${lo.status}`} />}
      {c.phone && <a href={`tel:${c.phone}`} className="mt-1 flex items-center justify-center gap-2 bg-emerald-600 rounded-xl py-2 text-xs font-bold"><Phone size={14} />اتصال</a>}
    </div>
  )
}
