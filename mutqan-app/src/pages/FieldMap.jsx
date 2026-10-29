import { useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Phone, X, Plus, Trash2 } from 'lucide-react'
import FieldMapCanvas from '../components/FieldMapCanvas'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { maps } from '../lib/maps'
import { useTeamRole } from '../hooks/useTeamRole'
import { useTechProfiles } from '../hooks/useTechProfiles'
import { isTechAvailable } from '../assignment'
import { ACTIVE_STATUSES, specialtyLabel } from '../constants'
import { CRM_STATUS, CRM_FINANCE, CRM_STYLE, crmLabel, buildCustomers, seenAgo, isOnline } from '../lib/crm'

const LAYERS = [
  { id: 'regular', label: 'عملاء قدامى', emoji: '👤', color: '#3b82f6' },
  { id: 'new', label: 'عملاء جدد', emoji: '🆕', color: '#22c55e' },
  { id: 'vip', label: 'مميزون / ولاء', emoji: '⭐', color: '#f59e0b' },
  { id: 'blocked', label: 'محظورون', emoji: '⛔', color: '#ef4444' },
  { id: 'orders', label: 'طلبات جديدة', emoji: '🔔', color: '#ef4444' },
  { id: 'techOn', label: 'فنيون متاحون', emoji: '🧰', color: '#10b981' },
  { id: 'techOff', label: 'فنيون مغلقون', emoji: '🧰', color: '#64748b' },
  { id: 'shops', label: 'محلات الصيانة', emoji: '🏪', color: '#8b5cf6' },
]
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary'

export default function FieldMap() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 500 })
  const { data: crm } = useLiveShared('customer_profiles', { limit: 800 })
  const { data: shops } = useLiveShared('shops', { limit: 300 })
  const { profiles } = useTechProfiles()
  const [on, setOn] = useState(() => Object.fromEntries(LAYERS.map((l) => [l.id, true])))
  const [sel, setSel] = useState(null)
  const mapRef = useRef(null)
  const allowed = isOwner || ['owner', 'operations', 'supervisor'].includes(role)

  const customers = useMemo(() => buildCustomers(orders || [], crm || []), [orders, crm])
  const newOrders = useMemo(() => (orders || []).filter((o) => o.status === 'new' && o.lat != null), [orders])
  const points = useMemo(() => {
    const out = []
    for (const c of customers) {
      const g = c.status === 'vip' || c.status === 'loyal' ? 'vip' : c.status === 'blocked' ? 'blocked' : c.status === 'new' ? 'new' : 'regular'
      if (!on[g]) continue
      const L = LAYERS.find((x) => x.id === g)
      out.push({ id: 'c' + c.key, kind: 'customer', data: c, lat: c.lat, lng: c.lng, emoji: L.emoji, color: L.color, label: c.name || c.phone || 'عميل' })
    }
    if (on.orders) for (const o of newOrders) out.push({ id: 'o' + o.id, kind: 'order', data: o, lat: o.lat, lng: o.lng, emoji: '🔔', color: '#ef4444', pulse: true, label: `طلب جديد · ${o.clientName || ''}` })
    for (const t of profiles || []) {
      const lat = t.lat ?? t.homeLat, lng = t.lng ?? t.homeLng
      if (lat == null) continue
      const av = isTechAvailable(t, orders || [])
      if (!on[av ? 'techOn' : 'techOff']) continue
      out.push({ id: 't' + t.userId, kind: 'tech', data: t, lat, lng, emoji: '🧰', color: av ? '#10b981' : '#64748b', label: `${t.displayName || 'فني'} · ${av ? 'متاح' : 'مغلق'}` })
    }
    if (on.shops) for (const s of shops || []) if (s.lat != null) out.push({ id: 's' + s.id, kind: 'shop', data: s, lat: s.lat, lng: s.lng, emoji: '🏪', color: s.available === false ? '#64748b' : '#8b5cf6', label: s.name })
    return out
  }, [customers, newOrders, profiles, shops, orders, on])

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">جارِ التحقق…</div>
  if (!allowed) return <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-[#090c14]" dir="rtl">لا تملك صلاحية الوصول</div>

  async function addShop() {
    const name = prompt('اسم المحل؟'); if (!name) return
    const phone = prompt('رقم المحل (اختياري)') || ''
    const c = mapRef.current?.getCenter(); if (!c) return
    const gid = await team.groupId()
    await db.insertShared('shops', { name, phone, lat: c.lat, lng: c.lng, available: true, specialties: '', lastSeenAt: new Date().toISOString() }, undefined, { groupId: gid, visibleTo: 'group', writableBy: 'admins' })
  }
  const counts = { customers: customers.length, orders: newOrders.length, techs: (profiles || []).length, shops: (shops || []).length }

  return (
    <div className="h-full flex flex-col bg-[#090c14] text-white" dir="rtl">
      <header className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.8rem)] pb-2">
        <div className="flex items-center gap-2"><button onClick={() => navigate('/staff')} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button><h1 className="flex-1 font-black">🗺️ الخريطة الميدانية</h1><button onClick={addShop} className="flex items-center gap-1 text-xs font-bold bg-violet-600 rounded-full px-3 py-1.5"><Plus size={14} />محل</button></div>
        <p className="text-[10px] text-slate-400 mt-1">{counts.customers} عميل • {counts.orders} طلب جديد • {counts.techs} فني • {counts.shops} محل — «محل» يُثبَّت في منتصف الخريطة</p>
        <div className="flex gap-1.5 overflow-x-auto pt-2 pb-1">
          {LAYERS.map((l) => <button key={l.id} onClick={() => setOn((p) => ({ ...p, [l.id]: !p[l.id] }))} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${on[l.id] ? 'text-white' : 'opacity-40 text-slate-300'}`} style={{ borderColor: l.color, background: on[l.id] ? l.color + '33' : 'transparent' }}>{l.emoji} {l.label}</button>)}
        </div>
      </header>
      <div className="flex-1 min-h-0 px-3 pb-3"><FieldMapCanvas points={points} height="100%" onSelect={setSel} onReady={(m) => { mapRef.current = m }} className="h-full" /></div>
      {sel && <Sheet sel={sel} onClose={() => setSel(null)} navigate={navigate} orders={orders || []} />}
    </div>
  )
}

function Row({ k, v }) { return v ? <p className="text-xs text-slate-300"><span className="text-slate-500">{k}: </span>{v}</p> : null }

function Sheet({ sel, onClose, navigate, orders }) {
  const d = sel.data
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[72vh] overflow-y-auto bg-[#0d1220] border-t border-white/10 rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button onClick={onClose} className="absolute left-3 top-3 text-slate-400"><X size={18} /></button>
      {sel.kind === 'customer' && <CustomerCard c={d} />}
      {sel.kind === 'order' && (
        <div className="grid gap-1.5"><p className="font-black">🔔 طلب جديد — {specialtyLabel(d.specialtyId)}</p><Row k="العميل" v={`${d.clientName || ''} ${d.clientPhone || ''}`} /><Row k="العنوان" v={d.address} /><Row k="الوصف" v={d.description} /><Row k="وصل منذ" v={seenAgo(d.createdAt)} />
          <button onClick={() => navigate(`/staff/order/${d.id}`)} className="mt-2 bg-primary text-black font-black rounded-xl py-2 text-sm">فتح الطلب والإسناد</button></div>
      )}
      {sel.kind === 'tech' && (
        <div className="grid gap-1.5"><p className="font-black">🧰 {d.displayName || 'فني'}</p><Row k="الحالة" v={d.active === false ? 'مغلق' : isTechAvailable(d, orders) ? 'متاح' : 'مشغول/اكتملت السعة'} /><Row k="آخر ظهور" v={seenAgo(d.lastSeenAt || d.updatedAt)} /><Row k="مهام نشطة" v={String(orders.filter((o) => o.technicianId === d.userId && ACTIVE_STATUSES.includes(o.status)).length)} /><Row k="التخصصات" v={(d.specialties || []).map(specialtyLabel).join('، ')} />
          {d.phone && <a href={`tel:${d.phone}`} className="mt-2 flex items-center justify-center gap-2 bg-emerald-600 rounded-xl py-2 text-sm font-bold"><Phone size={15} />اتصال</a>}</div>
      )}
      {sel.kind === 'shop' && <ShopCard s={d} onClose={onClose} />}
    </div>
  )
}

function ShopCard({ s, onClose }) {
  const upd = (patch) => db.updateShared('shops', s.id, { ...patch, lastSeenAt: new Date().toISOString() })
  return (
    <div className="grid gap-1.5"><p className="font-black">🏪 {s.name}</p><Row k="آخر ظهور" v={seenAgo(s.lastSeenAt || s.updatedAt)} /><Row k="الحالة" v={s.available === false ? 'مغلق' : 'متاح'} />
      <div className="flex gap-2 mt-2"><button onClick={() => { upd({ available: s.available === false }); onClose() }} className="flex-1 bg-white/10 rounded-xl py-2 text-sm font-bold">{s.available === false ? 'تفعيل كمتاح' : 'إغلاق مؤقت'}</button>
        {s.phone && <a href={`tel:${s.phone}`} className="flex-1 bg-emerald-600 rounded-xl py-2 text-sm font-bold text-center">اتصال</a>}
        <button onClick={async () => { if (confirm('حذف المحل؟')) { await db.deleteShared('shops', s.id); onClose() } }} className="px-3 bg-rose-600/80 rounded-xl"><Trash2 size={15} /></button></div></div>
  )
}

function CustomerCard({ c }) {
  const p = c.profile || {}
  const [f, setF] = useState({ status: p.status || c.status, finance: p.finance || 'unknown', style: p.style || 'calm', special: p.special || '', note: p.note || '', lastDealing: p.lastDealing || '' })
  const [saved, setSaved] = useState('')
  const lo = c.lastOrder
  const done = c.orders.filter((o) => o.status === 'completed').length
  async function save() {
    try { const gid = await team.groupId(); await db.upsertShared('customer_profiles', { ...p, ...f, name: c.name, phone: c.phone, updatedAt: new Date().toISOString() }, c.key, { groupId: gid, visibleTo: 'group', writableBy: 'admins' }); setSaved('تم الحفظ ✓') } catch { setSaved('تعذر الحفظ') }
    setTimeout(() => setSaved(''), 2000)
  }
  return (
    <div className="grid gap-2">
      <p className="font-black">{c.name || 'عميل'} <span className="text-[11px] font-bold" style={{ color: CRM_STATUS.find((s) => s.id === f.status)?.color }}>• {crmLabel(CRM_STATUS, f.status)}</span></p>
      <Row k="الجوال" v={c.phone} /><Row k="آخر ظهور" v={seenAgo(c.lastAt)} /><Row k="الطلبات" v={`${c.orders.length} (مكتمل ${done})`} />
      {lo && <Row k="آخر تعامل" v={`${specialtyLabel(lo.specialtyId)} — ${lo.status}${lo.agreedPrice ? ` — ${lo.agreedPrice} ر.س` : ''}`} />}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <label className="text-[10px] text-slate-400">حالة العميل<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}>{CRM_STATUS.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">الحالة المادية<select value={f.finance} onChange={(e) => setF({ ...f, finance: e.target.value })} className={inputCls}>{CRM_FINANCE.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">أسلوب التعامل<select value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} className={inputCls}>{CRM_STYLE.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">تسعيرة خاصة<input value={f.special} onChange={(e) => setF({ ...f, special: e.target.value })} placeholder="مثال: غسيل 90 / خصم 10%" className={inputCls} /></label>
      </div>
      <label className="text-[10px] text-slate-400">آخر تعامل (ملاحظتك)<input value={f.lastDealing} onChange={(e) => setF({ ...f, lastDealing: e.target.value })} className={inputCls} /></label>
      <label className="text-[10px] text-slate-400">ملاحظات<textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={inputCls} /></label>
      <div className="flex gap-2"><button onClick={save} className="flex-1 bg-primary text-black font-black rounded-xl py-2 text-sm">حفظ بيانات العميل {saved}</button>{c.phone && <a href={`tel:${c.phone}`} className="px-4 bg-emerald-600 rounded-xl flex items-center"><Phone size={16} /></a>}</div>
    </div>
  )
}
