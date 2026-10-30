import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Zap, SlidersHorizontal, LocateFixed, Radio, RefreshCw, Users, Headset, Bot, Tag, Sparkles, AlertTriangle, Radar, Wallet, MessageCircle, ShieldCheck, HardHat } from 'lucide-react'
import { db } from '../lib/db'
import { push } from '../lib/push'
import { useAiSettings } from '../hooks/useAiSettings'
import { isTechAvailable, sortByPriority } from '../assignment'
import { escalationLabel, handlerLabel, ACTIVE_STATUSES_FOR_ALERTS } from '../workflow'
import { useLiveShared } from '../lib/useLive'
import { team } from '../lib/team'
import { useTeamRole } from '../hooks/useTeamRole'
import { useTechProfiles } from '../hooks/useTechProfiles'
import { useAssignment } from '../hooks/useAssignment'
import { remainingCapacity } from '../assignment'
import OrderCard from '../components/OrderCard'
import { useOpsMode } from '../hooks/useOpsMode'
import { useOrderRouting } from '../hooks/useOrderRouting'
import ManualOrderModal from '../components/ManualOrderModal'
import AssignModal from '../components/ops/AssignModal'
import OpsMap from '../components/ops/OpsMap'
import IntakeBoard from '../components/ops/IntakeBoard'
import DispatchBoard from '../components/ops/DispatchBoard'
import TechTable from '../components/ops/TechTable'
import OrdersTable from '../components/ops/OrdersTable'
import { DONE, RUNNING, isToday, isUnassigned } from '../components/ops/helpers'
import { serviceScopeLabel, specialtyLabel } from '../constants'

const TABS = [
  ['map', '🗺️ الخريطة الميدانية', () => 0],
  ['intake', '📥 استقبال الطلبات', (k, u) => u.length],
  ['board', '📋 لوحة التوجيه', () => 0],
  ['table', '📑 جدول الطلبات', () => 0],
  ['techs', '🧰 الفنيون', () => 0],
  ['alerts', '🔔 محادثات وتنبيهات', (k, u, a, h) => a.length + h.length],
]

export default function OperationsRoom() {
  const navigate = useNavigate()
  const { role, isOwner, loading: roleLoading } = useTeamRole()
  const { profiles, settings, updateSettings } = useTechProfiles()
  const { data: orders, loading: ordersLoading } = useLiveShared('orders', { order: '-createdAt', limit: 300 })
  const { autoAssignOrder, linkTech } = useAssignment({ profiles, settings, orders })
  const { data: crmRows } = useLiveShared('customer_profiles', { limit: 800 })
  const [tab, setTab] = useState('map')
  const [assignOrder, setAssignOrder] = useState(null)
  const [busyId, setBusyId] = useState('')
  const { data: payRows } = useLiveShared('tech_pay', { limit: 5 })
  const sharePctVal = Number(payRows?.[0]?.sharePct) || 0
  const { data: handoffs } = useLiveShared('handoffs', { filters: { status: { in: ['open', 'claimed'] } }, order: '-createdAt', limit: 50 })
  const { settings: aiSettings } = useAiSettings()
  const { data: coverageRows } = useLiveShared('coverage', { limit: 1 })
  const { data: pendingTechs } = useLiveShared('tech_applications', { filters: { status: 'pending' }, limit: 100 })
  const { inhouse: inhouseOn, setInhouse } = useOpsMode()
  const routing = useOrderRouting()
  const [manualOpen, setManualOpen] = useState(false)
  const inhouseList = useMemo(() => orders.filter((o) => o.inhouse && !['completed', 'closed', 'cancelled'].includes(o.status)), [orders])
  const [now, setNow] = useState(Date.now())
  const flaggedRef = useRef(new Set())

  const [gid, setGid] = useState(null)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState('')
  const processingRef = useRef(new Set())

  const mode = settings?.mode || 'manual'
  const strategy = settings?.strategy || 'smart'
  const unassigned = useMemo(() => orders.filter((o) => o.status === 'new' && !o.technicianId && !o.inhouse), [orders])

  useEffect(() => { team.groupId().then(setGid) }, [])

  // Clock tick (no data re-fetch) so time-based follow-up rules re-evaluate
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // Follow-up automation: technician didn't accept in time → escalate; technician late → notify operations
  useEffect(() => {
    if (!gid || ordersLoading) return
    const fu = aiSettings.followUp
    const mins = (iso) => (iso ? (now - new Date(iso).getTime()) / 60000 : 0)
    const lastAt = (o, st) => [...(o.statusHistory || [])].reverse().find((h) => h.status === st)?.at
    const jobs = []
    for (const o of orders) {
      if (o.inhouse) continue
      const flags = o.followUpFlags || {}
      if (fu.escalateOnNoAccept && o.status === 'assigned' && !flags.noAccept && mins(o.assignedAt) > Number(fu.techAcceptMin || 15)) jobs.push([o, 'noAccept', 'no_accept'])
      if (fu.escalateOnNoAccept && o.status === 'forced' && !flags.forcedStale && mins(lastAt(o, 'forced') || o.createdAt) > Number(fu.techAcceptMin || 15)) jobs.push([o, 'forcedStale', 'forced_stale'])
      if (fu.notifyOpsOnLate && ['accepted', 'en_route'].includes(o.status) && !flags.late && mins(lastAt(o, o.status)) > Number(fu.techLateMin || 60)) jobs.push([o, 'late', 'tech_late'])
    }
    for (const [o, flag, reason] of jobs) {
      const key = `${o.id}:${flag}`
      if (flaggedRef.current.has(key)) continue
      flaggedRef.current.add(key)
      const at = new Date().toISOString()
      db.updateShared('orders', o.id, {
        followUpFlags: { ...(o.followUpFlags || {}), [flag]: at },
        escalation: { reason, level: 'operations', at, by: 'followup_engine' },
      }).catch(() => {})
      push.sendToAdmins(gid, { title: `تنبيه متابعة: ${escalationLabel(reason)}`, body: `${specialtyLabel(o.specialtyId)} — ${o.clientName || ''}${o.technicianName ? ` · ${o.technicianName}` : ''}`, url: `#/staff/order/${o.id}`, sound: 'bell' }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, orders, gid, ordersLoading, aiSettings.followUp])

  // Approximate coverage for customers: rounded positions of AVAILABLE technicians only (no names)
  useEffect(() => {
    if (!gid || !profiles.length) return
    const points = profiles
      .filter((t) => t.homeLat != null && isTechAvailable(t, orders))
      .map((t) => ({ lat: Math.round(t.homeLat * 50) / 50, lng: Math.round(t.homeLng * 50) / 50 }))
      .sort((a, b) => a.lat - b.lat || a.lng - b.lng)
    const cur = coverageRows?.[0]
    const fresh = cur?.updatedAt && Date.now() - new Date(cur.updatedAt).getTime() < 6 * 3600 * 1000
    if (fresh && JSON.stringify(cur.points || []) === JSON.stringify(points)) return
    db.upsertShared('coverage', { points, updatedAt: new Date().toISOString() }, 'default', { groupId: gid, writableBy: 'admins' }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, profiles, orders.length, coverageRows?.[0]?.updatedAt])

  const alerts = useMemo(
    () => orders.filter((o) => o.escalation && ACTIVE_STATUSES_FOR_ALERTS.includes(o.status)),
    [orders],
  )

  const kpi = useMemo(() => {
    const live = orders.filter((o) => !o.inhouse)
    return {
      running: live.filter((o) => RUNNING.includes(o.status)).length,
      assigned: live.filter((o) => ['assigned', 'forced'].includes(o.status)).length,
      done: orders.filter((o) => DONE.includes(o.status) && isToday(o.completedAt || o.updatedAt)).length,
      failed: orders.filter((o) => (o.status === 'cancelled' && isToday(o.updatedAt)) || (o.escalation && !DONE.includes(o.status) && o.status !== 'cancelled')).length,
      techOn: profiles.filter((t) => isTechAvailable(t, orders)).length,
    }
  }, [orders, profiles])

  async function autoOne(o) {
    setBusyId(o.id)
    try { const t = await autoAssignOrder(o, gid); setNotice(t ? `أُسندت إلى ${t.displayName || 'فني'}` : 'لا فني مناسب — أُرسلت كمهمة إجبارية') } finally { setBusyId('') }
  }

  // Auto-distribution: while mode is آلي, any unassigned order gets assigned on sight.
  const autoRunningRef = useRef(false)
  useEffect(() => {
    if (mode !== 'auto' || !gid || ordersLoading || autoRunningRef.current) return
    if (unassigned.length === 0) return
    const pending = sortByPriority(unassigned).filter((o) => !processingRef.current.has(o.id))
    if (pending.length === 0) return
    autoRunningRef.current = true
    setRunning(true)
    let assigned = 0
    let forced = 0
    ;(async () => {
      for (const o of pending) {
        processingRef.current.add(o.id)
        const tech = await autoAssignOrder(o, gid)
        if (tech) assigned++
        else forced++
      }
      processingRef.current.clear()
      setNotice(`تم التوزيع تلقائيًا: ${assigned} إسناد آلي · ${forced} إسناد إجباري`)
    })().finally(() => {
      autoRunningRef.current = false
      setRunning(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gid, ordersLoading, unassigned.length])

  async function runAuto() {
    setRunning(true)
    setNotice('')
    let assigned = 0
    let forced = 0
    try {
      for (const o of sortByPriority(unassigned)) {
        if (processingRef.current.has(o.id)) continue
        processingRef.current.add(o.id)
        const tech = await autoAssignOrder(o, gid)
        if (tech) assigned++
        else forced++
      }
      setNotice(`تم التوزيع: ${assigned} إسناد آلي · ${forced} إسناد إجباري`)
    } finally {
      processingRef.current.clear()
      setRunning(false)
    }
  }

  const allowed = isOwner || role === 'operations' || role === 'owner'
  if (roleLoading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <Centered>لا تملك صلاحية الوصول لغرفة العمليات</Centered>

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 py-3 flex items-center gap-2 overflow-x-auto pl-24">
          <button onClick={() => navigate('/staff')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <div className="shrink-0 min-w-[140px]">
            <p className="text-[11px] text-primary font-bold tracking-widest">غرفة العمليات</p>
            <h1 className="font-display text-lg font-black text-white truncate">مركز توزيع الطلبات</h1>
          </div>
          {(isOwner || routing.opsCreate) && (
            <button onClick={() => setManualOpen(true)} className="shrink-0 flex items-center gap-1.5 bg-emerald-500 text-black rounded-xl px-3 py-2 text-[11px] font-black">➕ <span>طلب من واتساب</span></button>
          )}
          <button onClick={() => navigate('/staff/tech-requests')} className="relative shrink-0 flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 rounded-xl px-3 py-2 text-[11px] font-bold text-white">
            <HardHat size={14} className="text-amber-300" /> <span className="hidden sm:inline">طلبات الفنيين</span>
            {pendingTechs.length > 0 && <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1">{pendingTechs.length}</span>}
          </button>
          <button onClick={() => navigate('/staff/wa-inbox')} className="shrink-0 flex items-center gap-1.5 bg-emerald-500 text-black rounded-xl px-3 py-2 text-[11px] font-black"><MessageCircle size={14} /> <span className="hidden sm:inline">صندوق الواتساب</span></button>
          <button onClick={() => navigate('/staff/whatsapp')} className="shrink-0 flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-xl px-3 py-2 text-[11px] font-bold text-white">
            <MessageCircle size={14} className="text-emerald-300" /> <span className="hidden sm:inline">الواتساب</span>
          </button>
          <button onClick={() => navigate('/staff/warranties')} className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200">
            <ShieldCheck size={14} className="text-emerald-400" /> <span className="hidden sm:inline">الضمان</span>
          </button>
          <button onClick={() => navigate('/staff/payment-methods')} className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200">
            <Wallet size={14} className="text-primary" /> <span className="hidden sm:inline">طرق الدفع</span>
          </button>
          <button onClick={() => navigate('/staff/ac')} className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200">❄️ أسعار وعروض المكيفات</button>
          <button onClick={() => navigate('/staff/pricing')} className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200">
            <Tag size={14} className="text-primary" /> <span className="hidden sm:inline">التسعير</span>
          </button>
          <button onClick={() => navigate('/staff/ai-command')} className="shrink-0 flex items-center gap-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 rounded-xl px-3 py-2 text-[11px] font-bold text-white">
            <Radar size={14} className="text-sky-300" /> <span className="hidden sm:inline">مركز قيادة AI</span>
          </button>
          <button onClick={() => navigate('/staff/ai-settings')} className="shrink-0 flex items-center gap-1.5 bg-primary/15 hover:bg-primary/25 border border-primary/40 rounded-xl px-3 py-2 text-[11px] font-bold text-white">
            <Bot size={14} className="text-primary" /> <span className="hidden sm:inline">إعدادات الذكاء الاصطناعي</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 pt-5 flex flex-col gap-5">
        {/* KPI strip */}
        <section className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            ['بانتظار الإسناد', unassigned.length, unassigned.length ? 'text-rose-300' : 'text-slate-300'],
            ['جارية', kpi.running, 'text-amber-300'],
            ['مُسندة', kpi.assigned, 'text-sky-300'],
            ['تمت اليوم', kpi.done, 'text-emerald-300'],
            ['لم تتم', kpi.failed, kpi.failed ? 'text-rose-300' : 'text-slate-300'],
            ['فنيون متاحون', `${kpi.techOn}/${profiles.length}`, 'text-emerald-300'],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-white/[0.04] border border-white/10 py-2.5 text-center"><p className={`text-xl font-black font-display ${c}`}>{v}</p><p className="text-[10px] text-slate-400 font-bold">{l}</p></div>
          ))}
        </section>

        {/* Dispatch mode: manual / automatic */}
        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={16} className="text-primary" />
            <h2 className="text-white font-bold text-sm">أسلوب التوزيع</h2>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => updateSettings({ mode: 'manual' })}
              className={`flex-1 rounded-xl py-3 text-sm font-bold border ${mode === 'manual' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}
            >
              يدوي
            </button>
            <button
              onClick={() => updateSettings({ mode: 'auto' })}
              className={`flex-1 rounded-xl py-3 text-sm font-bold border ${mode === 'auto' ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-slate-300'}`}
            >
              آلي
            </button>
          </div>

          {mode === 'auto' && (
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ strategy: 'nearest' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border ${strategy === 'nearest' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}
              >
                <LocateFixed size={14} /> الأقرب جغرافيًا
              </button>
              <button
                onClick={() => updateSettings({ strategy: 'capacity' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border ${strategy === 'capacity' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}
              >
                <Users size={14} /> حسب السعة اليومية
              </button>
              <button
                onClick={() => updateSettings({ strategy: 'smart' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border ${strategy === 'smart' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}
              >
                <Sparkles size={14} /> مطابقة ذكية
              </button>
            </div>
          )}
          {mode === 'auto' && strategy === 'smart' && (
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">الطلبات العاجلة تُوزَّع أولًا. ثم يُختار الفني حسب: الأقرب (موقعه المباشر)، المتصل الآن أونلاين، المتفرغ حاليًا، التخصص، عدد ما أنجزه، التقييم، وضغط العمل — مع الالتزام بالسعة اليومية. غير المتصلين يُختارون فقط إذا لم يتوفر أونلاين.</p>
          )}

          <button
            onClick={runAuto}
            disabled={running || unassigned.length === 0}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-black font-display font-black rounded-xl py-3 disabled:opacity-40 active:scale-[0.99] transition-transform"
          >
            {running ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
            توزيع الطلبات الجديدة آليًا الآن ({unassigned.length})
          </button>
          {notice && <p className="text-emerald-400 text-xs font-bold text-center mt-2">{notice}</p>}
        </section>


        {isOwner && (
          <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3"><Radar size={16} className="text-primary" /><h2 className="text-white font-bold text-sm">استقبال الطلبات (المالك)</h2></div>
            <div className="flex gap-2 flex-wrap">

              <button onClick={() => routing.setMode(routing.mode === 'operations' ? 'whatsapp' : 'operations').catch(() => {})} className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black border ${routing.mode === 'operations' ? 'bg-amber-400 text-black border-amber-200' : 'bg-white/5 border-white/10 text-slate-200'}`}>
                📋 توجيه الطلبات: {routing.mode === 'operations' ? 'لمشرف العمليات' : 'للواتساب'}
              </button>
              <button onClick={() => routing.setOpsCreate(!routing.opsCreate).catch(() => {})} className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black border ${routing.opsCreate ? 'bg-emerald-400 text-black border-emerald-200' : 'bg-white/5 border-white/10 text-slate-200'}`}>
                ➕ إنشاء طلبات يدوية: {routing.opsCreate ? 'مفعّل' : 'متوقف'}
              </button>
            <button onClick={() => setInhouse(!inhouseOn).catch(() => {})} className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black border ${inhouseOn ? 'bg-sky-500 text-black border-sky-300' : 'bg-white/5 border-white/10 text-slate-200'}`}>
              🏗️ هندمة الأعمال: {inhouseOn ? 'مفعّلة' : 'متوقفة'}
            </button>
            </div>
            <TechShareBox />
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">«لمشرف العمليات»: الطلب يدخل غرفة العمليات مباشرة دون واتساب. «للواتساب»: يكمل العميل على واتساب. الطلبات اليدوية: تسمح لمشرف العمليات بتحويل محادثات الواتساب إلى طلبات.</p>
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto sticky top-[68px] z-10 bg-[#090c14]/95 backdrop-blur py-1.5">
          {TABS.map(([id, label, n]) => (
            <button key={id} onClick={() => setTab(id)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black border ${tab === id ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>
              {label}{n(kpi, unassigned, alerts, handoffs) ? <span className="mr-1.5 inline-block min-w-[18px] rounded-full bg-rose-500 text-white text-[10px] px-1">{n(kpi, unassigned, alerts, handoffs)}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'map' && <OpsMap orders={orders} profiles={profiles} crm={crmRows} onAssign={setAssignOrder} onAuto={autoOne} onOpenOrder={(o) => navigate(`/staff/order/${o.id}`)} />}
        {tab === 'intake' && <IntakeBoard orders={orders} mode={mode} busyId={busyId} onAssign={setAssignOrder} onAuto={autoOne} onOpen={(o) => navigate(`/staff/order/${o.id}`)} onLocate={() => setTab('map')} />}
        {tab === 'board' && <DispatchBoard orders={orders} onOpen={(o) => navigate(`/staff/order/${o.id}`)} onReassign={setAssignOrder} />}
        {tab === 'table' && <OrdersTable orders={orders} onOpen={(o) => navigate(`/staff/order/${o.id}`)} onAssign={setAssignOrder} />}
        {tab === 'techs' && (
          <>
            <TechTable profiles={profiles} orders={orders} sharePct={sharePctVal} />
        {/* Technician board */}
        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Radio size={16} className="text-primary" />
            <h2 className="text-white font-bold text-sm">لوحة الفنيين</h2>
          </div>
          {profiles.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-4">لا يوجد فنيون سجّلوا ملفاتهم بعد</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profiles.map((t) => {
                const rem = remainingCapacity(t, orders)
                return (
                  <div key={t.userId} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{t.displayName || 'فني'}</p>
                      <p className="text-[11px] text-slate-500">{serviceScopeLabel(t.scope)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-black ${rem > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {rem} / {t.dailyCapacity || 0}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${t.active === false ? 'bg-slate-600' : rem > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {(inhouseOn || inhouseList.length > 0) && (
          <section>
            <h2 className="text-sky-300 font-bold text-sm mb-1">تنفيذ داخلي ({inhouseList.length})</h2>
            <p className="text-[11px] text-slate-500 mb-3">{inhouseOn ? 'الوضع مفعّل: الطلبات الجديدة تُنفَّذ بواسطة الشركة، بدون إسناد، وغير محتسبة في الرصيد أو النسبة أو الدفع.' : 'طلبات قيد التنفيذ الداخلي.'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {inhouseList.map((o) => (
                <OrderCard key={o.id} order={o} showClient dark onClick={() => navigate(`/staff/order/${o.id}`)} />
              ))}
            </div>
          </section>
        )}

          </>
        )}
        {tab === 'alerts' && (
          <>
        {/* Human handoff inbox from MUTQAN AI */}
        <section className="bg-amber-500/[0.06] border border-amber-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Headset size={16} className="text-amber-400" />
            <h2 className="text-white font-bold text-sm">محادثات محوّلة من MUTQAN AI ({handoffs.length})</h2>
          </div>
          {handoffs.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-3">لا توجد محادثات بانتظار موظف</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {handoffs.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/staff/handoff/${h.id}`)}
                  className="text-right bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-bold text-sm truncate">{h.customerName}</p>
                    <span className={`text-[10px] font-black shrink-0 ${h.status === 'open' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {h.status === 'open' ? 'بانتظار موظف' : `مع ${h.agentName || 'موظف'}`}
                    </span>
                  </div>
                  {h.reason && h.reason !== 'human' && (
                    <span className={`inline-block mt-1 text-[10px] font-black rounded-md px-1.5 py-0.5 ${h.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-slate-300'}`}>
                      {h.priority === 'high' ? '⚠️ ' : ''}{escalationLabel(h.reason)}
                    </span>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{h.summary}</p>
                  {h.service && <p className="text-[10px] text-primary mt-1 font-bold">{specialtyLabel(h.service)}</p>}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Follow-up & escalation alerts */}
        {alerts.length > 0 && (
          <section className="bg-rose-500/[0.06] border border-rose-500/25 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-rose-400" />
              <h2 className="text-white font-bold text-sm">تصعيدات وتنبيهات المتابعة ({alerts.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {alerts.map((o) => (
                <button key={o.id} onClick={() => navigate(`/staff/order/${o.id}`)} className="text-right bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-bold text-sm truncate">{specialtyLabel(o.specialtyId)} · {o.clientName}</p>
                    <span className="text-[10px] font-black text-rose-300 shrink-0">{escalationLabel(o.escalation.reason)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">الجهة: {handlerLabel(o.escalation.level)}{o.technicianName ? ` · الفني: ${o.technicianName}` : ''}</p>
                </button>
              ))}
            </div>
          </section>
        )}

          </>
        )}
      </div>
      {assignOrder && <AssignModal order={assignOrder} profiles={profiles} orders={orders} onAssign={(o, t) => linkTech(o, t, 'operations')} onClose={() => setAssignOrder(null)} />}
      {manualOpen && <ManualOrderModal by={role} onClose={() => setManualOpen(false)} />}
    </div>
  )
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}

// Owner: the technician's share of each completed service (percent). Empty = technicians do not see earnings figures.
function TechShareBox() {
  const { data } = useLiveShared('tech_pay', { limit: 5 })
  const cur = (data || [])[0]
  const [v, setV] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (cur && v === '') setV(String(cur.sharePct ?? '')) }, [cur]) // eslint-disable-line
  const save = async () => {
    const n = Number(v); if (!(n >= 0 && n <= 100)) return
    const gid = await team.groupId()
    await db.upsertShared('tech_pay', { sharePct: n, updatedAt: new Date().toISOString() }, 'default', { groupId: gid, visibleTo: 'group', writableBy: 'admins' })
    setSaved(true); setTimeout(() => setSaved(false), 1800)
  }
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-200">
      💰 نسبة الفني من الخدمة
      <input value={v} onChange={(e) => setV(e.target.value)} inputMode="numeric" placeholder="مثال 60" className="w-16 bg-white/10 rounded-lg px-2 py-1 text-center text-white" dir="ltr" />%
      <button onClick={save} className="rounded-lg bg-primary text-black font-black px-3 py-1">{saved ? 'تم ✓' : 'حفظ'}</button>
    </div>
  )
}
