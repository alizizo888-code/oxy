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
import Chart from '../components/Chart'
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
  const nav = useNavigate()
  const sameDay = (iso, d = new Date()) => iso && new Date(iso).toDateString() === d.toDateString()
  const st = useMemo(() => {
    const O = orders || []
    const done = (o) => ['completed', 'closed'].includes(o.status)
    const today = O.filter((o) => sameDay(o.createdAt))
    const doneToday = O.filter((o) => done(o) && sameDay(o.completedAt || o.updatedAt))
    const now = new Date()
    const month = O.filter((o) => done(o) && (() => { const d = new Date(o.completedAt || o.updatedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })())
    const rev = (l) => l.reduce((a, o) => a + (Number(o.price) || 0), 0)
    const rated = O.filter((o) => o.rating)
    const avg = rated.length ? rated.reduce((a, o) => a + Number(o.rating), 0) / rated.length : 0
    const cancelled = O.filter((o) => o.status === 'cancelled').length
    const resp = O.map((o) => { const f = (o.statusHistory || []).find((h) => ['assigned', 'accepted'].includes(h.status)); return f && o.createdAt ? (new Date(f.at) - new Date(o.createdAt)) / 60000 : null }).filter((x) => x != null && x >= 0 && x < 1440)
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d })
    const bySrc = today.reduce((m, o) => { const k = o.source === 'whatsapp_manual' ? 'واتساب' : o.routing === 'operations' ? 'الموقع' : 'التطبيق'; m[k] = (m[k] || 0) + 1; return m }, {})
    const byTech = {}
    for (const o of O) if (o.technicianName && done(o)) { const t = (byTech[o.technicianName] ||= { n: 0, r: 0, rn: 0 }); t.n++; if (o.rating) { t.r += Number(o.rating); t.rn++ } }
    const top = Object.entries(byTech).map(([name, v]) => ({ name, n: v.n, avg: v.rn ? v.r / v.rn : 0 })).sort((a, b) => b.n - a.n)[0]
    return {
      active: O.filter((o) => ACTIVE_STATUSES.includes(o.status)).length, wait: O.filter((o) => ['new', 'forced'].includes(o.status) && !o.technicianId && !o.inhouse).length,
      today: today.length, doneToday: doneToday.length, revToday: rev(doneToday), revMonth: rev(month), monthN: month.length,
      avg, ratedN: rated.length, cancelRate: O.length ? Math.round((cancelled / O.length) * 100) : 0, respAvg: resp.length ? Math.round(resp.reduce((a, x) => a + x, 0) / resp.length) : null,
      daily: days.map((d) => O.filter((o) => sameDay(o.createdAt, d)).length), dayLabels: days.map((d) => ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d.getDay()]),
      bySrc, top, paid: O.filter((o) => done(o) && o.paymentStatus === 'paid').length, unpaid: O.filter((o) => done(o) && o.paymentStatus !== 'paid').length,
    }
  }, [orders])
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<DollarSign size={16} />} label="إيراد اليوم (مكتمل)" value={`${st.revToday} ر.س`} sub={`${st.doneToday} طلب مكتمل`} />
        <Stat icon={<TrendingUp size={16} />} label="إيراد الشهر" value={`${st.revMonth} ر.س`} sub={`${st.monthN} طلب`} />
        <Stat icon={<LayoutList size={16} />} label="طلبات اليوم" value={st.today} sub={`${st.active} نشطة • ${st.wait} بانتظار الإسناد`} />
        <Stat icon={<Star size={16} />} label="متوسط التقييم" value={st.avg ? st.avg.toFixed(2) : '—'} sub={`${st.ratedN} تقييم`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Radar size={16} />} label="زمن الاستجابة (إسناد/قبول)" value={st.respAvg != null ? `${st.respAvg} د` : '—'} />
        <Stat icon={<Users size={16} />} label="نسبة الإلغاء" value={`${st.cancelRate}%`} />
        <Stat icon={<DollarSign size={16} />} label="مدفوع / غير مدفوع" value={`${st.paid} / ${st.unpaid}`} sub="للطلبات المكتملة" />
        <Stat icon={<Wrench size={16} />} label="أفضل فني" value={st.top ? st.top.name : '—'} sub={st.top ? `${st.top.n} طلب${st.top.avg ? ` • ⭐ ${st.top.avg.toFixed(1)}` : ''}` : ''} />
      </div>
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
        <p className="text-white font-bold text-sm mb-2">الطلبات الواردة — آخر 7 أيام</p>
        <Chart spec={{ kind: 'bar', series: [{ name: 'طلبات', data: st.daily, color: '#0e8f88' }], labels: st.dayLabels }} />
        {Object.keys(st.bySrc).length > 0 && <p className="text-[11px] text-slate-400 mt-2">مصادر اليوم: {Object.entries(st.bySrc).map(([k, v]) => `${k} ${v}`).join(' • ')}</p>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => nav('/staff/operations')} className="flex-1 min-w-[140px] bg-primary text-black font-black rounded-xl py-3 text-sm">فتح غرفة العمليات</button>
        <button onClick={() => nav('/staff/map')} className="flex-1 min-w-[140px] bg-white/10 rounded-xl py-3 text-sm font-bold text-white">الخريطة الميدانية</button>
        <button onClick={() => nav('/staff/pay-links')} className="flex-1 min-w-[140px] bg-white/10 rounded-xl py-3 text-sm font-bold text-white">روابط الدفع</button>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-1.5">
      <span className="text-primary">{icon}</span>
      <span className="font-display font-black text-white text-xl truncate">{value}</span>
      <span className="text-[11px] text-slate-400 font-bold">{label}</span>
      {sub ? <span className="text-[10px] text-slate-500">{sub}</span> : null}
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
