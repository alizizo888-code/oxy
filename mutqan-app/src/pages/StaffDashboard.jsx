import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Radar, LayoutList, Wrench, TrendingUp, Star, DollarSign } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { team } from '../lib/team'
import { social } from '../lib/social'
import MapView from '../components/MapView'
import OrderCard from '../components/OrderCard'
import { ROLE_LABELS, ACTIVE_STATUSES } from '../constants'

export default function StaffDashboard({ roles }) {
  const navigate = useNavigate()
  const [gid, setGid] = useState(null)
  const [role, setRole] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const myId = auth.getCurrentUser()?.id

  useEffect(() => {
    async function init() {
      const g = await team.groupId()
      setGid(g)
      setIsOwner(auth.isAppOwner())
      if (!auth.isAppOwner()) setRole(await social.getMyRole(g))
      else setRole('owner')
    }
    init()
  }, [])

  const effectiveRole = isOwner ? 'owner' : role

  const tabsFor = {
    owner: [{ k: 'overview', label: 'نظرة عامة' }, { k: 'all', label: 'كل الطلبات' }],
    operations: [{ k: 'queue', label: 'قيد الإسناد' }, { k: 'all', label: 'كل الطلبات' }, { k: 'radar', label: 'الرادار' }],
    supervisor: [{ k: 'overview', label: 'نظرة عامة' }, { k: 'all', label: 'كل الطلبات' }],
    technician: [{ k: 'mine', label: 'مهامي' }, { k: 'history', label: 'السجل' }],
  }
  const tabs = tabsFor[effectiveRole] || []
  const [tab, setTab] = useState(null)
  useEffect(() => { if (tabs.length && !tab) setTab(tabs[0].k) }, [effectiveRole])

  const { data: orders, loading } = useLiveShared('orders', { order: '-createdAt', limit: 300 })

  const filtered = useMemo(() => {
    if (!orders) return []
    if (effectiveRole === 'operations' && tab === 'queue') return orders.filter((o) => o.status === 'new')
    if (effectiveRole === 'technician' && tab === 'mine') return orders.filter((o) => o.technicianId === myId && ACTIVE_STATUSES.includes(o.status))
    if (effectiveRole === 'technician' && tab === 'history') return orders.filter((o) => o.technicianId === myId && !ACTIVE_STATUSES.includes(o.status))
    return orders
  }, [orders, tab, effectiveRole, myId])

  if (!effectiveRole) {
    return <div className="h-full flex items-center justify-center text-slate-500 text-sm" dir="rtl">جارِ التحميل…</div>
  }

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto w-full px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-primary font-bold tracking-widest">مُتقن</p>
            <h1 className="font-display text-lg font-black text-white">{ROLE_LABELS[effectiveRole] || 'الفريق'}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {(isOwner || effectiveRole === 'operations') && (
              <button
                onClick={() => navigate('/staff/operations')}
                className="flex items-center gap-1.5 text-xs font-bold text-black bg-primary rounded-full px-3 py-2"
              >
                <Radar size={14} /> غرفة العمليات
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => team.openAdmin({ roles })}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 border border-white/15 rounded-full px-3 py-2"
              >
                <Users size={14} /> إدارة الفريق
              </button>
            )}
          </div>
        </div>
        <div className="max-w-4xl mx-auto w-full px-4 flex gap-2 pb-3 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border ${
                tab === t.k ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full px-4 pt-5">
        {(tab === 'overview') && <OverviewPanel orders={orders} />}

        {tab === 'radar' && <RadarPanel orders={orders} />}

        {(tab === 'queue' || tab === 'all' || tab === 'mine' || tab === 'history') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {loading ? (
              <p className="text-slate-500 text-sm col-span-full text-center py-10">جارِ التحميل…</p>
            ) : filtered.length === 0 ? (
              <p className="text-slate-500 text-sm col-span-full text-center py-10">لا توجد طلبات</p>
            ) : (
              filtered.map((o) => (
                <OrderCard key={o.id} order={o} showClient onClick={() => navigate(`/staff/order/${o.id}`)} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function OverviewPanel({ orders }) {
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
  const completed = orders.filter((o) => o.status === 'closed').length
  const rated = orders.filter((o) => o.rating);
  const avgRating = rated.length ? (rated.reduce((a, o) => a + o.rating, 0) / rated.length).toFixed(1) : '—'
  const revenue = orders.filter((o) => o.status === 'closed' && o.price).reduce((a, o) => a + Number(o.price || 0), 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Stat icon={<LayoutList size={16} />} label="طلبات نشطة" value={active} />
      <Stat icon={<TrendingUp size={16} />} label="مكتملة" value={completed} />
      <Stat icon={<Star size={16} />} label="متوسط التقييم" value={avgRating} />
      <Stat icon={<DollarSign size={16} />} label="الإيرادات" value={`${revenue} ر.س`} />
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
      <span className="text-primary">{icon}</span>
      <span className="font-display font-black text-white text-xl">{value}</span>
      <span className="text-[11px] text-slate-500 font-bold">{label}</span>
    </div>
  )
}

function RadarPanel({ orders }) {
  const withLoc = orders.filter((o) => o.lat && ACTIVE_STATUSES.includes(o.status))
  const markers = withLoc.map((o) => ({ lat: o.lat, lng: o.lng, label: o.status === 'new' ? '🆕' : '📍', popup: o.clientName }))
  withLoc.forEach((o) => {
    if (o.technicianLocation) markers.push({ lat: o.technicianLocation.lat, lng: o.technicianLocation.lng, label: '🔧', popup: o.technicianName })
  })
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 mb-4">
      <MapView
        center={markers[0] ? [markers[0].lat, markers[0].lng] : [24.7136, 46.6753]}
        zoom={11}
        markers={markers}
        className="h-[60vh]"
      />
    </div>
  )
}
