import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Bell, BellRing, Loader2, CheckCheck, Settings2, Gift, Share2, MessageCircle, Copy } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { push } from '../lib/push'
import { useTeamRole } from '../hooks/useTeamRole'
import { notificationState } from '../hooks/useLocator'
import PermissionHelp from '../components/PermissionHelp'
import ThemeToggle from '../components/ThemeToggle'
import { useWelcome, shareText, WELCOME_LABEL } from '../lib/welcome'

// In-app notification center — the same notifications that arrive as phone
// notifications, kept here as a history (customer · technician · operations).
export default function Notifications() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const me = user?.id
  const { role, isOwner } = useTeamRole()
  const isOps = isOwner || role === 'operations'
  const [tab, setTab] = useState('mine')
  const { data, loading } = useLiveShared('notifications', { order: '-at', limit: 150 })

  const list = useMemo(() => {
    const rows = data || []
    if (tab === 'ops') return rows.filter((r) => r.audience === 'ops')
    return rows.filter((r) => r.audience !== 'ops' && r.userId === me)
  }, [data, tab, me])
  const unread = list.filter((r) => !r.read)

  async function open(n) {
    if (!n.read) db.updateShared('notifications', n.id, { read: true }).catch(() => {})
    if (n.url) navigate(n.url.replace(/^#/, ''))
  }
  async function readAll() {
    for (const n of unread) db.updateShared('notifications', n.id, { read: true }).catch(() => {})
  }

  return (
    <div className="h-full overflow-y-auto pb-16 bg-[#eff7f5]" dir="rtl">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-sky-100 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-3.5 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <h1 className="flex-1 font-display text-lg font-black text-slate-900">الإشعارات</h1>
          <ThemeToggle className="!w-9 !h-9" />
          {unread.length > 0 && (
            <button onClick={readAll} className="flex items-center gap-1 text-[11px] font-bold text-primary"><CheckCheck size={14} /> قراءة الكل</button>
          )}
          {isOps && (
            <button onClick={() => navigate('/staff/notify-settings')} className="w-9 h-9 rounded-full bg-white border border-sky-100 flex items-center justify-center" aria-label="إعدادات الإشعارات">
              <Settings2 size={16} className="text-slate-500" />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col gap-3">
        <EnablePush />
        <Offers />

        {isOps && (
          <div className="flex gap-2">
            {[{ k: 'mine', l: 'إشعاراتي' }, { k: 'ops', l: 'إشعارات العمليات' }].map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`flex-1 rounded-xl py-2.5 text-xs font-bold border ${tab === t.k ? 'bg-primary text-white border-primary' : 'bg-white border-sky-100 text-slate-500'}`}>{t.l}</button>
            ))}
          </div>
        )}

        {!me ? (
          <Empty text="ستظهر هنا إشعارات طلباتك وعروضنا. فعّل إشعارات الجوال من الأعلى ليصلك كل جديد." />
        ) : loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : list.length === 0 ? (
          <Empty text="لا توجد إشعارات بعد — ستظهر هنا مع كل تحديث على طلباتك" />
        ) : (
          list.map((n) => (
            <button key={n.id} onClick={() => open(n)} className={`text-right w-full rounded-2xl p-3.5 border shadow-sm flex gap-3 transition-colors hover:border-primary/40 ${n.read ? 'bg-white/70 border-sky-50' : 'bg-white border-sky-200'}`}>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-slate-100' : 'bg-primary/10'}`}>
                <Bell size={16} className={n.read ? 'text-slate-400' : 'text-primary'} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-display font-black text-sm text-slate-900 truncate">{n.title}</span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                </span>
                <span className="block text-[12px] text-slate-600 mt-0.5 leading-relaxed">{n.body}</span>
                <span className="block text-[10px] text-slate-400 mt-1">{n.at ? new Date(n.at).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Asks for notification permission ONLY on tap; if it was blocked, shows the enable-permissions guide.
function EnablePush() {
  const [perm, setPerm] = useState(() => notificationState())
  const [busy, setBusy] = useState(false)
  const d = push.diagnose()

  if (perm === 'granted') return null
  if (perm === 'denied') return <PermissionHelp kind="notifications" onRetry={() => setPerm(notificationState())} />
  if (d.reason === 'preview' || d.reason === 'unsupported' || d.reason === 'ios_needs_install') {
    return <p className="text-[11px] text-slate-500 bg-white border border-sky-100 rounded-2xl p-3 leading-relaxed">{d.hint || 'إشعارات الجوال تعمل على التطبيق المنشور بعد تثبيته على الشاشة الرئيسية.'}</p>
  }
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const p = await push.requestPermission()
          if (p === 'granted') await push.subscribe()
          setPerm(p === 'default' ? notificationState() : p)
        } finally { setBusy(false) }
      }}
      className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-sky-500 to-blue-600 text-white font-display font-black rounded-2xl py-3 text-sm shadow-md shadow-sky-200 disabled:opacity-50"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} تفعيل إشعارات الجوال
    </button>
  )
}

function Empty({ text }) {
  return (
    <div className="bg-white border border-sky-100 rounded-2xl p-8 text-center">
      <Bell size={28} className="text-sky-300 mx-auto mb-2" />
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  )
}

// Special offers: the one-time welcome discount and "share the app / site" invitations.
function Offers() {
  const w = useWelcome()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = shareText()
  async function claim() {
    setBusy(true)
    try {
      const r = await w.claim()
      if (r?.state === 'claimed' && notificationState() === 'granted') {
        try { new Notification('🎁 تم تفعيل خصم ' + WELCOME_LABEL, { body: 'يُطبَّق تلقائيًا على أول طلب من هذا الجهاز.' }) } catch { /* needs service worker on some phones */ }
      }
    } finally { setBusy(false) }
  }
  async function doShare() {
    try { if (navigator.share) { await navigator.share({ title: 'متقن', text }); return } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  const stateText = {
    available: `خصم ${WELCOME_LABEL} على أول طلب — مرة واحدة لكل جهاز`,
    claimed: 'خصمك مفعّل ويُطبَّق تلقائيًا على أول طلب ✅',
    used: 'تم استخدام العرض الترحيبي على هذا الجهاز',
    blocked: 'العرض الترحيبي غير متاح على هذا الجهاز/الشبكة',
    loading: 'جارٍ التحقق من العرض…',
  }[w.state]
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-2xl p-3.5 bg-gradient-to-l from-amber-400 to-orange-500 text-white shadow-md flex items-center gap-3" data-keep-colors>
        <span className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center shrink-0"><Gift size={20} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-sm">عرض ترحيبي {WELCOME_LABEL}</p>
          <p className="text-[11px] text-white/90 leading-relaxed">{stateText}</p>
        </div>
        {w.state === 'available' && (
          <button disabled={busy} onClick={claim} className="bg-white text-orange-600 font-black text-xs rounded-full px-3.5 py-2 shrink-0 disabled:opacity-60">{busy ? '…' : 'فعّل'}</button>
        )}
      </div>
      <div className="rounded-2xl p-3.5 bg-white border border-sky-100 shadow-sm">
        <p className="font-display font-black text-sm text-slate-900 flex items-center gap-1.5"><Share2 size={15} className="text-primary" /> انشر التطبيق والموقع</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">شارك رابط التطبيق والموقع مع أصدقائك — يحصل كل جهاز جديد على خصم {WELCOME_LABEL} في أول طلب.</p>
        <div className="flex gap-2 mt-2.5">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-white font-bold text-xs rounded-xl py-2.5"><MessageCircle size={14} /> واتساب</a>
          <button onClick={doShare} className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white font-bold text-xs rounded-xl py-2.5"><Copy size={14} /> {copied ? 'تم النسخ' : 'مشاركة / نسخ'}</button>
        </div>
      </div>
    </div>
  )
}
