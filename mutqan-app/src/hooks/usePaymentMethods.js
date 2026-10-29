import { useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'

// Payment methods = ONE shared collection managed by the owner + operations
// supervisor (writableBy admins). Customers and MUTQAN AI read it; nobody else edits.
export const METHOD_TYPES = [
  { id: 'cash', label: 'نقدًا عند الفني', icon: '💵' },
  { id: 'card_on_site', label: 'شبكة / مدى عند الفني', icon: '💳' },
  { id: 'bank_transfer', label: 'تحويل بنكي', icon: '🏦' },
  { id: 'pay_link', label: 'رابط دفع (مدى / STC Pay / PayPal / بوابة)', icon: '🔗' },
  { id: 'online', label: 'دفع إلكتروني برابط آمن', icon: '🔒' },
  { id: 'wallet_app', label: 'تطبيق دفع (STC Pay / Apple Pay …)', icon: '📱' },
  { id: 'custom', label: 'طريقة مخصصة', icon: '✨' },
]
// Quick starters for the owner: the URL is the owner's OWN payment page/link; {amount} {order} {name} {phone} are filled per order.
export const PAY_LINK_PRESETS = [
  { name: 'PayPal', url: 'https://www.paypal.me/USERNAME/{amount}SAR', hint: 'استبدل USERNAME باسم حسابك في PayPal.me' },
  { name: 'رابط بوابة دفع (Moyasar / Tap / HyperPay / PayTabs)', url: '', hint: 'الصق رابط الدفع أو الفاتورة من لوحة بوابتك' },
  { name: 'STC Pay / تطبيق محفظة', url: '', hint: 'الصق رابط الدفع أو الطلب من التطبيق' },
  { name: 'رابط بنكي / مدى', url: '', hint: 'الصق رابط الدفع المقدم من بنكك' },
]
export const typeMeta = (id) => METHOD_TYPES.find((t) => t.id === id) || METHOD_TYPES[METHOD_TYPES.length - 1]

// Built-in starting set — stored only when an admin saves/edits one (fixed ids = idempotent).
export const BUILTIN_METHODS = [
  { id: 'pm-cash', type: 'cash', name: 'نقدًا للفني', enabled: true, instructions: 'تدفع للفني بعد اكتمال الخدمة.', fee: 0, sort: 1 },
  { id: 'pm-card', type: 'card_on_site', name: 'شبكة / مدى عند الفني', enabled: true, instructions: 'جهاز الشبكة مع الفني.', fee: 0, sort: 2 },
  { id: 'pm-transfer', type: 'bank_transfer', name: 'تحويل بنكي', enabled: true, instructions: '', bankName: '', accountHolder: '', iban: '', fee: 0, sort: 3 },
  { id: 'pm-online', type: 'online', name: 'دفع إلكتروني', enabled: true, instructions: 'رابط دفع آمن — الطلب لا يُعتبر مدفوعًا إلا بعد تأكيد مزود الدفع.', fee: 0, sort: 4 },
]

export function mergeMethods(rows) {
  const byId = new Map((rows || []).map((r) => [r.id, r]))
  const merged = BUILTIN_METHODS.map((b) => ({ ...b, builtin: true, ...(byId.get(b.id) || {}) }))
  for (const r of rows || []) if (!BUILTIN_METHODS.some((b) => b.id === r.id)) merged.push(r)
  return merged.filter((m) => !m.deleted).sort((a, b) => (Number(a.sort) || 99) - (Number(b.sort) || 99))
}

export function usePaymentMethods() {
  const { data, loading, error } = useLiveShared('payment_methods', { limit: 100 })
  const methods = useMemo(() => mergeMethods(data), [data])
  return { methods, loading, error }
}

export async function saveMethod(method) {
  const gid = await team.groupId()
  const { id, builtin, ...rest } = method
  const mid = id || `pm-${Date.now().toString(36)}`
  await db.upsertShared('payment_methods', { ...rest, updatedAt: new Date().toISOString() }, mid, { groupId: gid, writableBy: 'admins' })
  return mid
}

// Soft-remove (kept for audit) — only from an explicit admin tap.
export async function removeMethod(method) {
  await saveMethod({ ...method, enabled: false, deleted: true })
}

export async function loadMethods() {
  try { return mergeMethods(await db.selectShared('payment_methods', {}, { limit: 100 })) } catch { return mergeMethods([]) }
}
