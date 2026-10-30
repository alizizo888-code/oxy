import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Clock, LayoutDashboard, MessageCircle, Bell, Radar, Wallet, ListChecks, Briefcase, Layers, X, Map as MapIcon, Menu, ChevronDown, Settings2, Bot, Tags, Snowflake, ShieldCheck, UserPlus, Smartphone, Home, ShoppingBag, Palette } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { useLiveShared } from '../lib/useLive'
import { auth } from '../lib/auth'
import { passkey } from '../lib/passkey'
import { useStaffTheme } from '../lib/theme'

const NAV = {
  owner: [
    ['/staff', 'الرئيسية', LayoutDashboard, true],
    ['/staff/operations', 'العمليات', Briefcase],
    ['/staff/map', 'الخريطة', MapIcon],
    ['/staff/wa-inbox', 'المحادثات', MessageCircle, false, 'wa'],
    ['/notifications', 'الإشعارات', Bell, false, 'bell'],
    ['/staff/payment-methods', 'الدفع', Wallet],
  ],
  operations: [
    ['/staff', 'العمليات', Briefcase, true],
    ['/staff/wa-inbox', 'المحادثات', MessageCircle, false, 'wa'],
    ['/notifications', 'الإشعارات', Bell, false, 'bell'],
    ['/staff/radar', 'الرادار', Radar],
    ['/staff/map', 'الخريطة', MapIcon],
    ['/staff/payment-methods', 'الدفع', Wallet],
  ],
  technician: [
    ['/staff', 'المهام', ListChecks, true],
    ['/staff?tab=map', 'الخريطة', MapIcon],
    ['/notifications', 'الإشعارات', Bell, false, 'bell'],
  ],
}
NAV.supervisor = NAV.operations

// Owner only: jump into every workspace (operations room, supervisor board, technician radar, the customer app…) without logging out.
const WORKSPACES = [
  ['/staff', 'لوحة المالك (كل التحكمات)'],
  ['/staff/operations', 'غرفة العمليات'],
  ['/staff/map', 'الخريطة الميدانية'],
  ['/staff/tech-requests', 'مشرف الموقع — طلبات الفنيين'],
  ['/staff/radar', 'الفني — الرادار والمهام'],
  ['/staff/wa-inbox', 'محادثات الواتساب'],
  ['/staff/payment-methods', 'طرق الدفع'],
  ['/', 'تطبيق العميل'],
]
function OwnerSwitcher() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="تبديل الواجهة" className="fixed z-40 left-3 top-[calc(env(safe-area-inset-top,0px)+0.6rem)] w-9 h-9 rounded-full bg-primary text-black flex items-center justify-center shadow-lg"><Layers size={17} /></button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center mb-3"><p className="flex-1 text-sm font-black text-white">دخول كل الواجهات (المالك)</p><button onClick={() => setOpen(false)} className="text-slate-400"><X size={18} /></button></div>
            <div className="grid gap-2">
              {WORKSPACES.map(([to, label]) => <button key={to} onClick={() => { setOpen(false); nav(to) }} className="text-right rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm font-bold text-slate-100">{label}</button>)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Management pages, shown inside the collapsible "إدارة" group of the side menu.
const MANAGE = [
  ['/staff/pricing', 'التسعير والخصومات', Tags],
  ['/staff/ac', 'خدمات المكيفات', Snowflake],
  ['/staff/used-ac', 'متجر المستعمل', ShoppingBag],
  ['/staff/schedule', 'نظام المواعيد', Clock],
  ['/staff/pay-links', 'روابط الدفع', Wallet],
  ['/staff/ai-command', 'مركز قيادة الذكاء', Bot],
  ['/staff/ai-settings', 'إعدادات البوت', Settings2],
  ['/staff/ai-owner', 'تحكم المالك بالبوت', Bot],
  ['/staff/whatsapp', 'أرقام الواتساب', Smartphone],
  ['/staff/notify-settings', 'الإشعارات والرنين', Bell],
  ['/staff/warranties', 'الضمانات', ShieldCheck],
  ['/staff/tech-requests', 'طلبات الفنيين', UserPlus],
  ['/staff/payment-methods', 'طرق الدفع', Wallet],
  ['/staff/business', 'إعدادات المنشأة والفاتورة', ShieldCheck],
]

function SideMenu({ items, role, bell, unread, open, setOpen }) {
  const { pathname } = useLocation()
  const canManage = role === 'owner' || role === 'operations' || role === 'supervisor'
  const [manage, setManage] = useState(() => MANAGE.some((m) => pathname.startsWith(m[0])))
  useEffect(() => { setOpen(false) }, [pathname]) // eslint-disable-line
  const link = ([to, label, Icon, end, badge]) => (
    <NavLink key={to} to={to} end={!!end} className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold ${isActive ? 'bg-primary/15 text-primary' : 'text-slate-300 hover:bg-white/5'}`}>
      <Icon size={18} /><span className="flex-1">{label}</span>
      {badge === 'bell' && bell > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1">{bell > 99 ? '99+' : bell}</span>}
      {badge === 'wa' && unread > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1">{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
  )
  const body = (
    <nav dir="rtl" className="h-full w-64 bg-[#0d1220] border-l border-white/10 flex flex-col p-3 gap-1 overflow-y-auto pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-keep-colors>
      <p className="text-xs font-black text-primary px-3 py-2">متقن</p>
      {items.map(link)}
      {canManage && (
        <>
          <button onClick={() => setManage((v) => !v)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5 mt-1">
            <Settings2 size={18} /><span className="flex-1 text-right">إدارة</span><ChevronDown size={16} className={`transition-transform ${manage ? 'rotate-180' : ''}`} />
          </button>
          {manage && <div className="mr-3 pr-2 border-r border-white/10 grid gap-0.5">{MANAGE.map(([to, label, Icon]) => link([to, label, Icon]))}</div>}
        </>
      )}
      <NavLink to="/staff/theme" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold mt-1 ${isActive ? 'bg-primary/15 text-primary' : 'text-slate-300 hover:bg-white/5'}`}><Palette size={18} />قوالب المظهر</NavLink>
      {role === 'owner' && <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-400 hover:bg-white/5 mt-auto"><Home size={18} />تطبيق العميل</NavLink>}
    </nav>
  )
  return (
    <>
      <div className="hidden md:block shrink-0 h-full">{body}</div>
      {open && <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}><div className="absolute right-0 top-0 h-full" onClick={(e) => e.stopPropagation()}>{body}</div></div>}
    </>
  )
}

// Owner, after signing in with username + password: offer to bind fingerprint / face for next time.
function PasskeyOffer() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let alive = true
    const dismissed = (() => { try { return localStorage.getItem('mq_pk_no') === '1' } catch { return false } })()
    if (dismissed || passkey.hasDeviceKey()) return
    passkey.supported().then((ok) => { if (alive && ok) setShow(true) })
    return () => { alive = false }
  }, [])
  if (!show) return null
  const enable = async () => {
    setBusy(true); setMsg('')
    try { await passkey.register(); setShow(false) } catch (e) { setMsg(e && e.name === 'NotAllowedError' ? 'تم الإلغاء.' : (e && e.message) || 'تعذر التفعيل.') } finally { setBusy(false) }
  }
  const later = () => { try { localStorage.setItem('mq_pk_no', '1') } catch { /* ignore */ } setShow(false) }
  return (
    <div dir="rtl" className="fixed z-40 bottom-3 inset-x-3 md:right-72 md:inset-x-auto md:w-96 rounded-2xl bg-[#0d1220] border border-primary/40 p-3 shadow-2xl">
      <p className="text-sm font-black text-white">🔐 فعّل الدخول بالبصمة أو الوجه</p>
      <p className="text-xs text-slate-400 mt-1">سجّلتَ بكلمة المرور مرة واحدة، والمرة الجاية تدخل ببصمتك فقط ولن يُطلب منك اليوزر والباسورد.</p>
      {msg && <p className="text-xs text-rose-400 mt-1">{msg}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={enable} disabled={busy} className="flex-1 rounded-xl bg-primary text-black text-sm font-black py-2 disabled:opacity-60">{busy ? '…' : 'تفعيل الآن'}</button>
        <button onClick={later} className="rounded-xl border border-white/15 text-slate-300 text-sm px-3">لاحقاً</button>
      </div>
    </div>
  )
}

// Side navigation for every staff role (drawer on phones, fixed sidebar on wide screens).
function StaffThemeButton({ light, toggle, shift }) {
  return (
    <button onClick={toggle} data-keep-colors aria-label={light ? 'الوضع الداكن' : 'تفتيح الشاشة'} title={light ? 'الوضع الداكن' : 'تفتيح الشاشة'}
      className={`fixed z-40 ${shift ? 'left-14' : 'left-3'} top-[calc(env(safe-area-inset-top,0px)+0.6rem)] w-9 h-9 rounded-full bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center text-base active:scale-95`}>
      {light ? '🌙' : '☀️'}
    </button>
  )
}

export default function StaffLayout() {
  const { signedIn, role, loading } = useTeamRole()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [light, toggleLight] = useStaffTheme()
  const items = signedIn ? NAV[role] : null
  const showWa = !!items?.some((i) => i[4] === 'wa')
  const { data: threads } = useLiveShared('wa_threads', { order: '-lastAt', limit: showWa ? 200 : 1 })
  const { data: notes } = useLiveShared('notifications', { order: '-at', limit: 60 })
  const meId = auth.getCurrentUser()?.id
  const bell = (notes || []).filter((n) => !n.read && (n.audience === 'ops' || n.userId === meId)).length
  const unread = showWa ? (threads || []).reduce((a, t) => a + (t.unread || 0), 0) : 0
  const hide = loading || !items || /\/staff\/order\//.test(pathname)
  return (
    <div className="h-full flex bg-[#090c14]" dir="rtl">
      {!hide && <SideMenu items={items} role={role} bell={bell} unread={unread} open={open} setOpen={setOpen} />}
      <div className="flex-1 min-w-0 min-h-0 relative" dir="rtl">
        <Outlet />
        {!hide && <button onClick={() => setOpen(true)} aria-label="القائمة" className="md:hidden fixed z-40 right-3 top-[calc(env(safe-area-inset-top,0px)+0.6rem)] w-9 h-9 rounded-full bg-[#0d1220]/90 border border-white/15 text-white flex items-center justify-center shadow-lg"><Menu size={18} />{(bell + unread) > 0 && <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-rose-500" />}</button>}
        {!hide && role === 'owner' && <OwnerSwitcher />}
        {!hide && <StaffThemeButton light={light} toggle={toggleLight} shift={role === 'owner'} />}
        {!hide && role === 'owner' && <PasskeyOffer />}
      </div>
    </div>
  )
}
