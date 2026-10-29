// Fixed reference content for the Metqan maintenance ops app.

export const SPECIALTIES = [
  { id: 'ac', label: 'صيانة وتكييف', icon: '❄️', desc: 'غسيل، فك وتركيب، فريون' },
  { id: 'electric', label: 'كهرباء', icon: '⚡', desc: 'تمديدات، أعطال، لوحات' },
  { id: 'plumbing', label: 'سباكة', icon: '🚿', desc: 'تسربات، تمديد، أدوات صحية' },
  { id: 'locks', label: 'أقفال ذكية', icon: '🔐', desc: 'تركيب وصيانة الأقفال الذكية' },
  { id: 'appliances', label: 'أجهزة منزلية', icon: '🧺', desc: 'غسالات، أفران، سخانات' },
  { id: 'satellite', label: 'ساتلايت ودش', icon: '📡', desc: 'تركيب وضبط القنوات' },
  { id: 'paint', label: 'دهان وديكور', icon: '🎨', desc: 'دهانات، ورق جدران، ديكور' },
  { id: 'tiling', label: 'تبليط وترميم', icon: '🧱', desc: 'تبليط، ترميم، عزل' },
  { id: 'cameras', label: 'كاميرات ومراقبة', icon: '📹', desc: 'كاميرات مراقبة وأنظمة أمن' },
  { id: 'fridge', label: 'التبريد', icon: '🧊', desc: 'ثلاجات ومبردات وفريزرات' },
  { id: 'cleaning', label: 'تنظيف وتعقيم', icon: '🧽', desc: 'تنظيف عميق وتعقيم' },
  { id: 'pest', label: 'مكافحة الحشرات', icon: '🐜', desc: 'رش وضمان مكافحة' },
  { id: 'tanks', label: 'خزانات المياه', icon: '🚰', desc: 'تنظيف، عزل، تعقيم' },
  { id: 'moving', label: 'نقل الأثاث', icon: '📦', desc: 'فك، نقل، تركيب' },
  { id: 'solar', label: 'طاقة شمسية', icon: '☀️', desc: 'تركيب وصيانة الأنظمة الشمسية' },
  { id: 'corporate', label: 'خدمات الشركات', icon: '🏢', desc: 'عقود وصيانة المنشآت' },
  { id: 'general', label: 'الصيانة العامة', icon: '🛠️', desc: 'أعمال صيانة متنوعة' },
  { id: 'contracting', label: 'مقاولات عامة', icon: '🏗️', desc: 'إشراف هندسي وعمالة مشاريع' },
]

export const HOME_TILES = ['ac', 'electric', 'plumbing', 'locks', 'appliances', 'satellite', 'paint', 'tiling', 'cameras']

export const specialtyLabel = (id) => SPECIALTIES.find((s) => s.id === id)?.label || id

export const STATUS_META = {
  new: { label: 'جديد', color: '#64748b', text: 'text-slate-200', bg: 'bg-slate-500/20', dot: 'bg-slate-400' },
  inhouse: { label: 'جارٍ التنفيذ', color: '#0ea5e9', text: 'text-sky-200', bg: 'bg-sky-500/20', dot: 'bg-sky-400' },
  forced: { label: 'إسناد إجباري', color: '#f43f5e', text: 'text-rose-200', bg: 'bg-rose-500/20', dot: 'bg-rose-400' },
  assigned: { label: 'مسندة لفني', color: '#3b82f6', text: 'text-blue-200', bg: 'bg-blue-500/20', dot: 'bg-blue-400' },
  accepted: { label: 'مقبولة', color: '#6366f1', text: 'text-indigo-200', bg: 'bg-indigo-500/20', dot: 'bg-indigo-400' },
  en_route: { label: 'الفني في الطريق', color: '#f59e0b', text: 'text-amber-200', bg: 'bg-amber-500/20', dot: 'bg-amber-400' },
  nearby: { label: 'الفني قريب منك', color: '#f59e0b', text: 'text-amber-200', bg: 'bg-amber-500/20', dot: 'bg-amber-400' },
  arrived: { label: 'وصل الفني', color: '#14b8a6', text: 'text-teal-200', bg: 'bg-teal-500/20', dot: 'bg-teal-400' },
  in_progress: { label: 'قيد التنفيذ', color: '#0d9488', text: 'text-teal-200', bg: 'bg-teal-600/20', dot: 'bg-teal-500' },
  completed: { label: 'اكتملت الخدمة', color: '#10b981', text: 'text-emerald-200', bg: 'bg-emerald-500/20', dot: 'bg-emerald-400' },
  closed: { label: 'مغلقة', color: '#94a3b8', text: 'text-slate-300', bg: 'bg-slate-600/20', dot: 'bg-slate-400' },
  cancelled: { label: 'ملغاة', color: '#f43f5e', text: 'text-rose-200', bg: 'bg-rose-500/20', dot: 'bg-rose-400' },
}

export const ORDER_FLOW = ['new', 'forced', 'assigned', 'accepted', 'en_route', 'nearby', 'arrived', 'in_progress', 'completed', 'closed']

export const ACTIVE_STATUSES = ['new', 'forced', 'assigned', 'accepted', 'en_route', 'nearby', 'arrived', 'in_progress']

export const SERVICE_SCOPES = [
  { id: 'wash', label: 'غسيل فقط', icon: '🚿' },
  { id: 'wash_maintenance', label: 'غسيل وصيانة', icon: '🔧' },
  { id: 'maintenance', label: 'صيانة فقط', icon: '🛠️' },
  { id: 'wash_maintenance_install', label: 'غسيل وصيانة وتركيب', icon: '⚙️' },
]

export const serviceScopeLabel = (id) => SERVICE_SCOPES.find((s) => s.id === id)?.label || 'كل الخدمات'

export const PRIORITY_META = {
  normal: { label: 'عادي', color: 'text-slate-300' },
  urgent: { label: 'عاجل', color: 'text-rose-400' },
}

export const TEAM_ROLES = [
  { name: 'operations', label: 'مشرف العمليات', admin: true },
  { name: 'supervisor', label: 'مشرف الموقع' },
  { name: 'technician', label: 'فني ميداني' },
]

export const ROLE_LABELS = {
  owner: 'المالك',
  admin: 'مشرف',
  operations: 'مشرف العمليات',
  supervisor: 'مشرف الموقع',
  technician: 'فني ميداني',
  member: 'عضو',
}

export const PROMO_CODE = 'OXYGEN30'

// أسعار ابتدائية تقديرية لكل تخصص (ر.س) — تُعرض كمدى تقديري قبل المعاينة
export const PRICE_BASE = {
  ac: 115, electric: 90, plumbing: 100, locks: 150, appliances: 120, satellite: 130,
  paint: 200, tiling: 250, cameras: 180, fridge: 140, cleaning: 150, pest: 120,
  tanks: 180, moving: 300, solar: 400, corporate: 500, general: 100, contracting: 600,
}

export const priceRange = (specialtyId, urgent) => {
  const base = PRICE_BASE[specialtyId] || 100
  const t = urgent ? base * 1.25 : base
  return { low: Math.round(t * 0.9), high: Math.round(t * 1.15) }
}

// أرقام تواصل المنشأة بصيغة دولية بدون + — يضبطها المالك، وعند تركها فارغة تعتمد بدائل مناسبة
export const BUSINESS_PHONE = ''
export const BUSINESS_WHATSAPP = ''
