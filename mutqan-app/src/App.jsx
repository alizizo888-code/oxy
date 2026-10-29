import { Suspense } from 'react'
import { lazyRetry } from './lib/lazy'
import { HashRouter, Routes, Route } from 'react-router-dom'
import ClientShell from './components/ClientShell'
import Home from './pages/client/Home'
import Services from './pages/client/Services'
import Offers from './pages/client/Offers'
import Notifications from './pages/Notifications'
const FieldMap = lazyRetry(() => import('./pages/FieldMap'))
const NotifySettings = lazyRetry(() => import('./pages/NotifySettings'))
import Store from './pages/client/Store'
import MyOrders from './pages/client/MyOrders'
import Account from './pages/client/Account'
import Calculator from './pages/client/Calculator'
import More from './pages/client/More'
const AiChat = lazyRetry(() => import('./pages/client/AiChat'))
const NewOrder = lazyRetry(() => import('./pages/NewOrder'))
const ClientOrderDetail = lazyRetry(() => import('./pages/ClientOrderDetail'))
const StaffGate = lazyRetry(() => import('./pages/StaffGate'))
const OrderDetailStaff = lazyRetry(() => import('./pages/OrderDetailStaff'))
const OperationsRoom = lazyRetry(() => import('./pages/OperationsRoom'))
const TechRadar = lazyRetry(() => import('./pages/TechRadar'))
const HandoffDetail = lazyRetry(() => import('./pages/HandoffDetail'))
const AiSettings = lazyRetry(() => import('./pages/AiSettings'))
const PricingRules = lazyRetry(() => import('./pages/PricingRules'))
const AcAdmin = lazyRetry(() => import('./pages/AcAdmin'))
const AiCommandCenter = lazyRetry(() => import('./pages/AiCommandCenter'))
const PaymentMethods = lazyRetry(() => import('./pages/PaymentMethods'))
const AiOwnerControl = lazyRetry(() => import('./pages/AiOwnerControl'))
const Privacy = lazyRetry(() => import('./pages/Privacy'))
const Contact = lazyRetry(() => import('./pages/client/Contact'))
const MyWarranties = lazyRetry(() => import('./pages/client/MyWarranties'))
const WhatsappCenter = lazyRetry(() => import('./pages/WhatsappCenter'))
const WaInbox = lazyRetry(() => import('./pages/WaInbox'))
const InstallApp = lazyRetry(() => import('./pages/InstallApp'))
import StaffLayout from './components/StaffLayout'
import PushToaster from './components/PushToaster'
const Warranties = lazyRetry(() => import('./pages/Warranties'))
const TechJoin = lazyRetry(() => import('./pages/TechJoin'))
const TechRequests = lazyRetry(() => import('./pages/TechRequests'))

export default function App() {
  return (
    <HashRouter>
      <PushToaster />
      <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm" dir="rtl">جارِ التحميل…</div>}>
      <Routes>
        {/* واجهة الزائر = واجهة العميل: يستقبل الزوار مباشرة على الرئيسية */}
        <Route path="/" element={<ClientShell />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="offers" element={<Offers />} />
          <Route path="store" element={<Store />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="account" element={<Account />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="more" element={<More />} />
        </Route>

        {/* تدفق الطلب وتفاصيله — شاشات مركّزة بدون شريط تبويب */}
        <Route path="/ai" element={<AiChat />} />
        <Route path="/staff/notify-settings" element={<NotifySettings />} />
        <Route path="/new" element={<NewOrder />} />
        <Route path="/install" element={<InstallApp />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/warranty" element={<MyWarranties />} />
        <Route path="/order/:id" element={<ClientOrderDetail />} />
        <Route path="/join-tech" element={<TechJoin />} />

        {/* فريق العمل */}
        <Route element={<StaffLayout />}>
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/staff" element={<StaffGate />} />
        <Route path="/staff/order/:id" element={<OrderDetailStaff />} />
        <Route path="/staff/operations" element={<OperationsRoom />} />
        <Route path="/staff/radar" element={<TechRadar />} />
        <Route path="/staff/map" element={<FieldMap />} />
        <Route path="/staff/handoff/:id" element={<HandoffDetail />} />
        <Route path="/staff/ai-settings" element={<AiSettings />} />
        <Route path="/staff/pricing" element={<PricingRules />} />
        <Route path="/staff/ac" element={<AcAdmin />} />
        <Route path="/staff/ai-command" element={<AiCommandCenter />} />
        <Route path="/staff/payment-methods" element={<PaymentMethods />} />
        <Route path="/staff/ai-owner" element={<AiOwnerControl />} />
        <Route path="/staff/whatsapp" element={<WhatsappCenter />} />
        <Route path="/staff/wa-inbox" element={<WaInbox />} />
        <Route path="/staff/warranties" element={<Warranties />} />
        <Route path="/staff/tech-requests" element={<TechRequests />} />
        </Route>
      </Routes>
      </Suspense>
    </HashRouter>
  )
}
