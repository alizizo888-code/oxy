// MUTQAN payments — online payment links on the owner's own connected payment
// account. The ONLY proof of payment is the provider's server-verified record
// (payments.hasPurchased); the redirect back and any client state are never proof.
import { payments } from './lib/payments'
import { auth } from './lib/auth'
import { db } from './lib/db'
import { team } from './lib/team'
import { push } from './lib/push'
import { specialtyLabel } from './constants'
import { loadMethods } from './hooks/usePaymentMethods'
import { notify } from './notify'

// Owner-defined payment links (https only). Placeholders are URL-encoded; the link is only a way to PAY — proof of payment is always confirmed by the team.
export function resolvePayUrl(tpl, order) {
  const t = String(tpl || '').trim()
  if (!/^https:\/\//i.test(t)) return ''
  const enc = encodeURIComponent
  return t.replace(/\{amount\}/g, enc(String(orderAmount(order) || ''))).replace(/\{order\}/g, enc(String(order?.id || '').slice(-8)))
    .replace(/\{name\}/g, enc(order?.clientName || '')).replace(/\{phone\}/g, enc(order?.clientPhone || ''))
}
export const orderSku = (id) => `mutqan-order-${id}`
export const orderAmount = (o) => Number(o?.price || o?.agreedPrice || o?.priceQuote?.total || 0)

// Which payment methods MUTQAN offers right now — read from the admin-managed
// payment_methods collection + the live provider connection, never assumed.
// Online payment counts only when enabled by an admin AND the provider is connected.
export async function paymentMethods() {
  let connected = false
  try { connected = !!(await payments.status())?.available } catch {}
  const all = await loadMethods()
  const enabled = all.filter((m) => m.enabled)
  const onlineMethod = enabled.find((m) => m.type === 'online')
  const offline = enabled.filter((m) => m.type !== 'online')
  const links = enabled.filter((m) => m.type === 'pay_link' && /^https:\/\//i.test(m.payUrl || ''))
  return {
    online: !!onlineMethod && connected,
    onlineSetupRequired: !!onlineMethod && !connected,
    list: offline,
    links,
    onSite: offline.map((m) => m.name + (m.fee ? ` (+${m.fee} ر.س)` : '')),
    details: offline.map((m) => {
      const extra = [m.instructions, m.bankName && `البنك: ${m.bankName}`, m.accountHolder && `باسم: ${m.accountHolder}`, m.iban && `الآيبان: ${m.iban}`].filter(Boolean).join(' — ')
      return `${m.name}${extra ? `: ${extra}` : ''}`
    }),
  }
}

// Customer taps "pay" → a hosted payment page on the owner's provider.
export async function startOrderPayment(order) {
  const amount = orderAmount(order)
  if (!amount) {
    const e = new Error('no amount'); e.code = 'NO_AMOUNT'; throw e
  }
  // Purchases bind to a signed-in identity so they survive device changes.
  let user = auth.getCurrentUser()
  if (!user) user = await auth.signIn()
  if (!user) {
    const e = new Error('sign in'); e.code = 'SIGN_IN'; throw e
  }
  const now = new Date().toISOString()
  try {
    await db.updateShared('orders', order.id, {
      onlinePayment: { status: 'created', amount, currency: 'SAR', createdAt: now, attempts: (order.onlinePayment?.attempts || 0) + 1 },
    })
    const gid = await team.groupId()
    push.sendToAdmins(gid, { title: 'تم إنشاء رابط دفع', body: `${specialtyLabel(order.specialtyId)} — ${amount} ر.س`, url: `#/staff/order/${order.id}` }).catch(() => {})
  } catch {}
  const back = `/#/order/${order.id}`
  await payments.checkout({
    sku: orderSku(order.id),
    name: `مُتقن — ${specialtyLabel(order.specialtyId)} #${String(order.id).slice(-5)}`,
    amount,
    currency: 'SAR',
    metadata: { orderId: String(order.id) },
    successPath: `/?payment=success${back}`,
    cancelPath: `/?payment=canceled${back}`,
  })
}

// Ask the payment provider's verified record. Only a TRUE answer marks the order paid.
export async function verifyOrderPayment(order) {
  if (!order || !auth.getCurrentUser()) return false
  let paid = false
  try { paid = await payments.hasPurchased(orderSku(order.id)) } catch { return false }
  if (paid && order.paymentStatus !== 'paid') {
    const now = new Date().toISOString()
    try {
      await db.updateShared('orders', order.id, {
        paymentStatus: 'paid',
        paymentMethod: 'online',
        paidAt: now,
        onlinePayment: { ...(order.onlinePayment || {}), status: 'paid', verifiedAt: now },
      })
      notify('paid', { ...order, paymentStatus: 'paid' }, { extra: { amount: orderAmount(order), method: 'دفع إلكتروني' } }).catch(() => {})
    } catch {}
  }
  return paid
}

// Returning from the hosted page: canceled = not paid (recorded as a failed attempt).
export async function recordCheckoutReturn(order) {
  const r = payments.checkoutResult()
  if (!r || !order) return null
  try {
    const u = new URL(window.location.href)
    u.searchParams.delete('payment')
    window.history.replaceState(null, '', u.toString())
  } catch {}
  if (r.status === 'canceled' && order.paymentStatus !== 'paid') {
    try {
      await db.updateShared('orders', order.id, { onlinePayment: { ...(order.onlinePayment || {}), status: 'failed', failedAt: new Date().toISOString() } })
      const gid = await team.groupId()
      push.sendToAdmins(gid, { title: 'فشل / إلغاء دفع', body: `${specialtyLabel(order.specialtyId)} — ${order.clientName || ''}`, url: `#/staff/order/${order.id}` }).catch(() => {})
    } catch {}
  }
  return r.status
}

export const ONLINE_STATUS = {
  created: { label: 'تم إنشاء رابط الدفع — بانتظار تأكيد مزود الدفع', tone: 'amber' },
  paid: { label: 'مدفوع إلكترونيًا — مؤكَّد من مزود الدفع', tone: 'emerald' },
  failed: { label: 'لم يكتمل الدفع (أُلغي أو فشل)', tone: 'rose' },
}

export function paymentErrorText(e) {
  if (e?.code === 'NO_CONNECTION') return 'الدفع الإلكتروني غير مفعّل بعد — يمكنك الدفع للفني نقدًا أو بالشبكة.'
  if (e?.code === 'SIGN_IN') return 'سجّل الدخول أولًا ليُربط الدفع بحسابك.'
  if (e?.code === 'NO_AMOUNT') return 'لم يُحدد مبلغ الطلب بعد — سيحدده الفني أو غرفة العمليات.'
  if (e?.code === 'UNSUPPORTED') return 'العملة غير مدعومة لدى مزود الدفع الحالي.'
  return 'تعذر فتح صفحة الدفع، حاول مرة أخرى.'
}
