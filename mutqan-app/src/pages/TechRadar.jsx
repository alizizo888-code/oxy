import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Radar, MapPin, Loader2, CheckCircle2, Save, Power } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { auth } from '../lib/auth'
import { team } from '../lib/team'
import { maps } from '../lib/maps'
import { useTeamRole } from '../hooks/useTeamRole'
import { useTechProfiles } from '../hooks/useTechProfiles'
import { useAssignment } from '../hooks/useAssignment'
import { remainingCapacity, TECH_LEVELS } from '../assignment'
import OrderCard from '../components/OrderCard'
import TechMap from '../components/TechMap'
import { SERVICE_SCOPES, serviceScopeLabel, ACTIVE_STATUSES, SPECIALTIES } from '../constants'

export default function TechRadar() {
  const navigate = useNavigate()
  const { role, isOwner, loading: roleLoading } = useTeamRole()
  const { profiles, upsertProfile } = useTechProfiles()
  const { data: orders, loading: ordersLoading } = useLiveShared('orders', { order: '-createdAt', limit: 300 })
  const { linkTech } = useAssignment({ profiles, settings: {}, orders })

  const myId = auth.getCurrentUser()?.id
  const myProfile = useMemo(() => profiles.find((p) => p.userId === myId), [profiles, myId])
  // A technician who registered through the join form: seed their profile from the approved application.
  const { data: myApps } = useLiveShared('tech_applications', { filters: { userId: myId || '__none__', status: 'approved' }, limit: 1 })
  const myApp = myApps?.[0] || null

  const { data: shops } = useLiveShared('shops', { limit: 300 })
  const [tab, setTab] = useState(() => { try { return new URLSearchParams((location.hash.split('?')[1]) || '').get('tab') || 'mine' } catch { return 'mine' } })
  const [myName, setMyName] = useState('')
  const [dailyCapacity, setDailyCapacity] = useState('8')
  const [scope, setScope] = useState('wash_maintenance_install')
  const [active, setActive] = useState(true)
  const [specialties, setSpecialties] = useState([])
  const [level, setLevel] = useState('senior')
  const [locating, setLocating] = useState(false)
  const [homeLoc, setHomeLoc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { const f = () => { const t = new URLSearchParams((location.hash.split('?')[1]) || '').get('tab'); if (t) setTab(t) }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])

  // Seed the form from the technician's saved profile, and their real name from the roster.
  useEffect(() => {
    if (myProfile) {
      setDailyCapacity(String(myProfile.dailyCapacity || 8))
      setScope(myProfile.scope || 'wash_maintenance_install')
      setActive(myProfile.active !== false)
      setSpecialties(Array.isArray(myProfile.specialties) ? myProfile.specialties : [])
      setLevel(myProfile.level || 'senior')
      setHomeLoc(myProfile.homeLat != null ? { lat: myProfile.homeLat, lng: myProfile.homeLng } : null)
      if (myProfile.displayName && !myName) setMyName(myProfile.displayName)
    } else if (myApp) {
      setSpecialties(Array.isArray(myApp.specialties) ? myApp.specialties : [])
      if (myApp.location?.lat != null) setHomeLoc({ lat: myApp.location.lat, lng: myApp.location.lng })
      if (myApp.name && !myName) setMyName(myApp.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myProfile, myApp])

  useEffect(() => {
    let alive = true
    team.currentMember().then((m) => {
      if (alive && m && !myName) setMyName(m.displayName || m.handle || '')
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (roleLoading) return <Centered>جارِ التحقق…</Centered>
  if (!myId || (role !== 'technician' && !isOwner && role !== 'owner')) return <Centered>لا تملك صلاحية الوصول</Centered>

  const myActive = orders.filter((o) => o.technicianId === myId && ACTIVE_STATUSES.includes(o.status))
  const myHistory = orders.filter((o) => o.technicianId === myId && !ACTIVE_STATUSES.includes(o.status))
  const available = orders.filter((o) => o.status === 'forced' && !o.technicianId)

  const displayName = myName || myProfile?.displayName || auth.getCurrentUser()?.displayName || 'فني'
  const rem = myProfile ? remainingCapacity(myProfile, orders) : Number(dailyCapacity) || 0

  async function setMyLocation() {
    setLocating(true)
    try {
      const { lat, lng } = await maps.getCurrentLocation()
      setHomeLoc({ lat, lng })
    } catch {
      alert('تعذر الوصول لموقعك — فعّل صلاحية الموقع')
    } finally {
      setLocating(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    setSaved(false)
    try {
      await upsertProfile({
        userId: myId,
        displayName,
        dailyCapacity: Number(dailyCapacity) || 0,
        scope,
        active,
        specialties,
        level,
        homeLat: homeLoc?.lat ?? null,
        homeLng: homeLoc?.lng ?? null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function acceptOrder(order) {
    if (!myProfile) {
      alert('احفظ ملفك أولاً حتى يتمكن النظام من ربط المهمة بك')
      return
    }
    setBusy(true)
    try {
      await linkTech(order, myProfile)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <div>
            <p className="text-[11px] text-primary font-bold tracking-widest">الرادار</p>
            <h1 className="font-display text-lg font-black text-white">مرحبًا {displayName}</h1>
          </div>
          <div className="mr-auto text-left">
            <p className="text-[10px] text-slate-500">المتبقي اليوم</p>
            <p className={`font-display font-black text-lg ${rem > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{rem}</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto w-full px-4 flex gap-2 pb-3 overflow-x-auto">
          {[
            { k: 'mine', label: `مهامي (${myActive.length})` },
            { k: 'available', label: `متاحة للقبول (${available.length})` },
            { k: 'map', label: '🗺️ الخريطة' },
            { k: 'profile', label: 'ملفي اليومي' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border ${tab === t.k ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full px-4 pt-5">
        {tab === 'mine' && (
          <div className="flex flex-col gap-2.5">
            {ordersLoading ? <p className="text-slate-500 text-sm text-center py-10">جارِ التحميل…</p>
              : myActive.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">لا توجد مهام نشطة الآن</p>
              : myActive.map((o) => <OrderCard key={o.id} order={o} showClient dark onClick={() => navigate(`/staff/order/${o.id}`)} />)}
            {myHistory.length > 0 && (
              <>
                <p className="text-slate-500 text-xs font-bold mt-3">مهام سابقة</p>
                {myHistory.slice(0, 5).map((o) => <OrderCard key={o.id} order={o} showClient dark onClick={() => navigate(`/staff/order/${o.id}`)} />)}
              </>
            )}
          </div>
        )}

        {tab === 'available' && (
          <div className="flex flex-col gap-2.5">
            {available.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10 flex flex-col items-center gap-2">
                <Radar size={28} className="text-slate-600" />
                لا توجد مهام إجبارية بانتظار القبول
              </p>
            ) : (
              available.map((o) => (
                <div key={o.id} className="bg-white/[0.04] border border-rose-500/30 rounded-2xl p-4 flex flex-col gap-3">
                  <OrderCard order={o} showClient dark onClick={() => navigate(`/staff/order/${o.id}`)} />
                  <button
                    onClick={() => acceptOrder(o)}
                    disabled={busy || rem <= 0}
                    className="w-full flex items-center justify-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold rounded-xl py-2.5 disabled:opacity-40 active:scale-[0.99] transition-transform"
                  >
                    <CheckCircle2 size={16} /> قبول المهمة وربطها بي
                  </button>
                  {rem <= 0 && <p className="text-[11px] text-rose-400 text-center -mt-1">وصلت للحد اليومي — ارفع السعة في ملفك لقبول المزيد</p>}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'map' && <TechMap myId={myId} myProfile={myProfile} profiles={profiles} orders={orders} shops={shops || []} upsertProfile={upsertProfile} />}
        {tab === 'profile' && (
          <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-sm">نظامي اليومي</h2>
              <button
                onClick={() => setActive((v) => !v)}
                className={`flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 border ${active ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-700/30 border-slate-600 text-slate-400'}`}
              >
                <Power size={13} /> {active ? 'متاح لاستقبال المهام' : 'متوقف مؤقتًا'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">اسمي</label>
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="اسمك الظاهر للعملاء والمشرفين"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">السعة اليومية (عدد الخدمات)</label>
              <input
                type="number"
                min="1"
                value={dailyCapacity}
                onChange={(e) => setDailyCapacity(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">نوع الخدمات التي أستقبلها</label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_SCOPES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScope(s.id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border text-xs font-bold ${scope === s.id ? 'bg-primary/15 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}
                  >
                    <span>{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">المحدد حاليًا: {serviceScopeLabel(scope)}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">تخصصاتي (للمطابقة الذكية)</label>
              <div className="flex flex-wrap gap-1.5">
                {SPECIALTIES.map((s) => {
                  const on = specialties.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSpecialties((l) => (on ? l.filter((x) => x !== s.id) : [...l, s.id]))}
                      className={`rounded-lg px-2.5 py-1.5 border text-[11px] font-bold ${on ? 'bg-primary/15 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}
                    >
                      {s.icon} {s.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">{specialties.length ? `${specialties.length} تخصص` : 'بدون تحديد = كل التخصصات'}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">مستوى التأهيل</label>
              <div className="grid grid-cols-3 gap-2">
                {TECH_LEVELS.map((l) => (
                  <button key={l.id} onClick={() => setLevel(l.id)} className={`rounded-xl py-2.5 border text-xs font-bold ${level === l.id ? 'bg-primary/15 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">موقعي الأساسي (للتوزيع حسب الأقرب)</label>
              <button
                onClick={setMyLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-slate-200 font-bold rounded-xl py-3 text-sm disabled:opacity-50"
              >
                {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                {homeLoc ? 'تحديد موقعي من جديد' : 'تحديد موقعي الآن'}
              </button>
              {homeLoc && <p className="text-[11px] text-emerald-400 mt-1.5">✓ تم حفظ موقعك الأساسي</p>}
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary text-black font-display font-black rounded-xl py-3 disabled:opacity-50 active:scale-[0.99] transition-transform"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saved ? 'تم الحفظ ✓' : 'حفظ ملفي'}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
