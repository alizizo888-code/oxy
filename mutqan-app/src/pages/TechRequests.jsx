import AccessDenied from '../components/AccessDenied'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Check, X, Loader2, MapPin, Phone, HardHat } from 'lucide-react'
import { db } from '../lib/db'
import { social } from '../lib/social'
import { team } from '../lib/team'
import { auth } from '../lib/auth'
import { useLiveShared } from '../lib/useLive'
import { useTeamRole } from '../hooks/useTeamRole'
import { SPECIALTIES } from '../constants'

// Owner / operations supervisor: review technician join requests. Approving adds the
// person to the team with the "technician" role — only then do they get the technician workspace.
const TABS = [
  { k: 'pending', label: 'بانتظار الموافقة' },
  { k: 'approved', label: 'مقبولة' },
  { k: 'rejected', label: 'مرفوضة' },
]

export default function TechRequests() {
  const navigate = useNavigate()
  const { role, isOwner, loading, refresh } = useTeamRole()
  const [tab, setTab] = useState('pending')
  const { data: apps, loading: appsLoading } = useLiveShared('tech_applications', { filters: { status: tab }, order: '-createdAt', limit: 200 })
  const [busyId, setBusyId] = useState(null)
  const [notes, setNotes] = useState({})

  const allowed = isOwner || role === 'operations'
  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <AccessDenied refresh={refresh} />

  const reviewer = auth.getCurrentUser()?.displayName || (isOwner ? 'المالك' : 'مشرف العمليات')

  async function approve(a) {
    setBusyId(a.id)
    try {
      const gid = await team.groupId()
      try { await social.inviteToGroup(gid, a.userId) } catch {} // already a member is fine
      await social.setRole(gid, a.userId, 'technician')
      await db.updateShared('tech_applications', a.id, { status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: reviewer, reviewNote: notes[a.id] || '' })
    } catch {
      alert('تعذر التفعيل — تأكد من الاتصال وحاول مرة أخرى')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(a) {
    if (!confirm(`رفض طلب ${a.name}؟`)) return
    setBusyId(a.id)
    try {
      await db.updateShared('tech_applications', a.id, { status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: reviewer, reviewNote: notes[a.id] || '' })
    } catch {
      alert('تعذر الحفظ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ChevronRight size={18} className="text-slate-300" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-400 font-bold tracking-widest">TECHNICIAN REQUESTS</p>
            <h1 className="font-display text-lg font-black text-white">طلبات انضمام الفنيين</h1>
          </div>
        </div>
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 pb-3 flex gap-2">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`text-[11px] font-bold rounded-full px-3.5 py-1.5 border ${tab === t.k ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>{t.label}</button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-5">
        {appsLoading ? <p className="text-slate-500 text-xs text-center py-8">جارِ التحميل…</p> : apps.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl">
            <HardHat size={30} className="mx-auto text-slate-600" />
            <p className="text-sm text-slate-400 mt-2 font-bold">لا توجد طلبات هنا</p>
            <p className="text-[11px] text-slate-500 mt-1">يقدّم الفنيون طلباتهم من «حسابي» ← «سجّل كفني» أو عبر MUTQAN AI.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {apps.map((a, i) => (
              <div key={a.id} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 fade-up hover:bg-white/[0.06]" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{a.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1" dir="ltr"><Phone size={11} /> {a.phone}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('ar') : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {(a.specialties || []).map((id) => {
                    const s = SPECIALTIES.find((x) => x.id === id)
                    return <span key={id} className="text-[10px] font-bold bg-amber-500/15 text-amber-200 rounded-full px-2 py-0.5">{s ? `${s.icon} ${s.label}` : id}</span>
                  })}
                </div>
                <div className="text-[11px] text-slate-400 mt-2.5 space-y-1">
                  {(a.city || a.years) && <p>{a.city}{a.city && a.years ? ' · ' : ''}{a.years ? `${a.years} سنوات خبرة` : ''}</p>}
                  <p className="flex items-center gap-1 truncate"><MapPin size={11} /> {a.location ? a.location.address || 'تم تحديد الموقع' : 'بدون موقع'}</p>
                  {a.notes && <p className="text-slate-300 leading-relaxed">{a.notes}</p>}
                  {a.reviewedBy && <p className="text-slate-500">راجعه: {a.reviewedBy}{a.reviewNote ? ` — ${a.reviewNote}` : ''}</p>}
                </div>
                {tab === 'pending' && (
                  <>
                    <input
                      value={notes[a.id] || ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                      placeholder="ملاحظة للفني (اختياري)"
                      className="w-full mt-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => approve(a)} disabled={busyId === a.id} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-black rounded-xl py-2.5 text-xs font-black disabled:opacity-50 hover:bg-emerald-400">
                        {busyId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} موافقة وتفعيل
                      </button>
                      <button onClick={() => reject(a)} disabled={busyId === a.id} className="flex items-center justify-center gap-1.5 bg-white/5 border border-rose-500/40 text-rose-300 rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-50 hover:bg-rose-500/10">
                        <X size={14} /> رفض
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
