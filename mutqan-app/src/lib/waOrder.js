// Builds the full order message and opens the customer's own WhatsApp toward the business number.
import { specialtyLabel } from '../constants'

export function buildOrderMessage({ draft = {}, who = {}, price, orderId, detail }) {
  const c = draft.coords || {}
  const lines = [
    '🔔 *طلب جديد — أكسجين*',
    orderId ? `رقم الطلب: #${String(orderId).slice(-5)}` : null,
    who.name ? `👤 الاسم: ${who.name}` : null,
    who.phone ? `📱 الجوال: ${who.phone}` : null,
    `🛠️ الخدمة: ${specialtyLabel(draft.specialtyId) || '-'}`,
    detail || draft.problem ? `📝 التفاصيل: ${detail || draft.problem}` : null,
    draft.qty > 1 ? `🔢 العدد: ${draft.qty}` : null,
    `⏰ الموعد: ${draft.preferredTime || (draft.priority === 'urgent' ? 'عاجل — الآن' : 'أقرب وقت')}`,
    draft.welcomeDiscountPct ? `🎁 خصم ترحيبي ${draft.welcomeDiscountPct}%${draft.welcomeOff ? ` (−${draft.welcomeOff} ر.س)` : ' حتى 20 ر.س'} على أول طلب` : null,
    price ? `💰 السعر المتفق: ${price} ر.س` : null,
    c.address || draft.locationText ? `🏠 العنوان: ${c.address || draft.locationText}` : null,
    c.lat ? `📍 الموقع: https://maps.google.com/?q=${c.lat},${c.lng}` : null,
  ]
  return lines.filter(Boolean).join('\n')
}

export function waLink(number, text) {
  return `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}
export function openWhatsApp(number, text) {
  try { window.open(waLink(number, text), '_blank', 'noopener') } catch {}
}
