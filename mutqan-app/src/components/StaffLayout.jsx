import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, MessageCircle, Bell, Radar, Wallet, ListChecks, Briefcase } from 'lucide-react'
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
      <div className="flex-1 min-h-0 relative"><Outlet /></div>
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
