import { NavLink, Outlet } from 'react-router-dom'
import { Home, ClipboardList, Calculator, LayoutGrid, User, Wrench, Percent, ShoppingBag, Snowflake, Sparkles } from 'lucide-react'
import FloatingContact from './FloatingContact'

// ترتيب التبويبات كما في الواجهة المعتمدة (من اليمين لليسار): طلباتي، حاسب الأسعار، الرئيسية، المزيد، حسابي
const TABS = [
  { to: '/orders', label: 'طلباتي', icon: ClipboardList },
  { to: '/calculator', label: 'الحاسبة', icon: Calculator },
  { to: '/', label: 'الرئيسية', icon: Home, end: true, center: true },
  { to: '/ai', label: 'المساعد الذكي', icon: Sparkles, ai: true },
  { to: '/more', label: 'المزيد', icon: LayoutGrid },
]

const SIDE_LINKS = [
  { to: '/', label: 'الرئيسية', icon: Home, end: true },
  { to: '/services', label: 'الخدمات', icon: Wrench },
  { to: '/offers', label: 'العروض', icon: Percent },
  { to: '/store', label: 'المتجر', icon: ShoppingBag },
  { to: '/orders', label: 'طلباتي', icon: ClipboardList },
  { to: '/calculator', label: 'حاسب الأسعار', icon: Calculator },
  { to: '/ai', label: 'المساعد الذكي', icon: Sparkles },
  { to: '/more', label: 'المزيد', icon: LayoutGrid },
  { to: '/account', label: 'حسابي', icon: User },
]

export default function ClientShell() {
  return (
    <div className="h-full flex" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col bg-white border-e border-sky-100 p-4 gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-md shadow-sky-300/50">
            <Snowflake size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display font-black text-slate-900 text-lg leading-none">OXYGEN</p>
            <p className="text-[10px] text-sky-600 font-bold mt-1">الصيانة والمقاولات العامة</p>
          </div>
        </div>
        {SIDE_LINKS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-sky-50'
              }`
            }
          >
            <t.icon size={18} />
            {t.label}
          </NavLink>
        ))}
        <div className="mt-auto pt-3 border-t border-sky-100">
          <NavLink to="/staff" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-sky-50">
            <Wrench size={18} />
            دخول فريق العمل
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <FloatingContact />

      {/* Phone bottom tab bar — frosted ice glass with raised center action */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-2xl border-t border-sky-100/80 rounded-t-[26px] shadow-[0_-10px_34px_rgba(8,60,130,0.16)] pb-[env(safe-area-inset-bottom,0px)]">
        <span className="pointer-events-none absolute top-1 right-6 text-sky-300/40 text-[10px] select-none">❄</span>
        <span className="pointer-events-none absolute top-2 left-10 text-sky-300/30 text-[9px] select-none">❄</span>
        <div className="grid grid-cols-5 items-end">
          {TABS.map((t) =>
            t.center ? (
              <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-end pt-1">
                {({ isActive }) => (
                  <>
                    <span
                      className={`-mt-7 w-14 h-14 rounded-full flex items-center justify-center text-white border-4 border-[#eef4fb] shadow-lg shadow-sky-500/40 transition-transform active:scale-95 ${
                        isActive ? 'bg-gradient-to-br from-sky-400 to-blue-600' : 'bg-gradient-to-br from-sky-300 to-blue-500'
                      }`}
                    >
                      <t.icon size={22} />
                    </span>
                    <span className={`mt-1 mb-1 text-[10px] font-bold ${isActive ? 'text-primary' : 'text-sky-700'}`}>{t.label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors ${
                    isActive ? 'text-primary' : 'text-slate-400'
                  }`
                }
              >
                {t.ai ? (
                  <span className="relative w-9 h-7 -mt-0.5 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white flex items-center justify-center shadow-md shadow-violet-400/40">
                    <t.icon size={16} />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
                  </span>
                ) : (
                  <t.icon size={20} />
                )}
                {t.label}
              </NavLink>
            )
          )}
        </div>
      </nav>
    </div>
  )
}
