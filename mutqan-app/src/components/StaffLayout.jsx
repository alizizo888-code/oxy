import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MessageCircle, Bell, Radar, Wallet, ListChecks, Briefcase, Layers, X } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { useLiveShared } from '../lib/useLive'
import { auth } from '../lib/auth'

const NAV = {
  owner: [
    ['/staff', 'الرئيسية', LayoutDashboard, true],
    ['/staff/operations', 'العمليات', Briefcase],
    ['/staff/wa-inbox', 'المحادثات', MessageCircle, false, 'wa'],
    ['/notifications', 'الإشعارات', Bell, false, 'bell'],
    ['/staff/payment-methods', 'الدفع', Wallet],
  ],
  operations: [
    ['/staff', 'العمليات', Briefcase, true],
    ['/staff/wa-inbox', 'المحادثات', MessageCircle, false, 'wa'],
    ['/notifications', 'الإشعارات', Bell, false, 'bell'],
    ['/staff/radar', 'الرادار', Radar],
    ['/staff/payment-methods', 'الدفع', Wallet],
  ],
  technician: [
    ['/staff', 'المهام', ListChecks, true],
    ['/notifications', 'الإشعارات', Bell, false, 'bell'],
  ],
}
NAV.supervisor = NAV.operations

// Owner only: jump into every workspace (operations room, supervisor board, technician radar, the customer app…) without logging out.
const WORKSPACES = [
  ['/staff', 'لوحة المالك (كل التحكمات)'],
  ['/staff/operations', 'غرفة العمليات'],
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

// One navigation bar for every staff role: tasks/operations, chats, notifications, radar, payments.
export default function StaffLayout() {
  const { signedIn, role, loading } = useTeamRole()
  const { pathname } = useLocation()
  const items = signedIn ? NAV[role] : null
  const showWa = !!items?.some((i) => i[4] === 'wa')
  const { data: threads } = useLiveShared('wa_threads', { order: '-lastAt', limit: showWa ? 200 : 1 })
  const { data: notes } = useLiveShared('notifications', { order: '-at', limit: 60 })
  const meId = auth.getCurrentUser()?.id
  const bell = (notes || []).filter((n) => !n.read && (n.audience === 'ops' || n.userId === meId)).length
  const unread = showWa ? (threads || []).reduce((a, t) => a + (t.unread || 0), 0) : 0
  const hide = loading || !items || /\/staff\/order\//.test(pathname)
  return (
    <div className="h-full flex flex-col bg-[#090c14]">
      <div className="flex-1 min-h-0 relative"><Outlet />{!hide && role === 'owner' && <OwnerSwitcher />}</div>
      {!hide && (
        <nav dir="rtl" className="shrink-0 bg-[#0d1220]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)]" data-keep-colors>
          <ul className="max-w-3xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
            {items.map(([to, label, Icon, end, badge]) => (
              <li key={to}>
                <NavLink to={to} end={!!end} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                  <Icon size={19} />
                  {label}
                  {badge === 'bell' && bell > 0 && <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center px-1">{bell > 99 ? '99+' : bell}</span>}
                  {badge === 'wa' && unread > 0 && <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center px-1">{unread > 99 ? '99+' : unread}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
