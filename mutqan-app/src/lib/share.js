import { db } from './db'

export const isInAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok/i.test(navigator.userAgent || '')
const digits = (n) => String(n || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/\D/g, '')
function open(url) { const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url }
export const share = {
  whatsapp(number, text) { const n = digits(number); open(`https://wa.me/${n}?text=${encodeURIComponent(text || '')}`) },
  whatsappOrder({ phone, number, to, text, message, collection, record, groupId } = {}) {
    if (collection && record) { db.insertShared(collection, record, undefined, groupId ? { groupId } : {}).catch(() => {}) } // lead log, best-effort
    share.whatsapp(phone || number || to || '', text || message || '')
  },
  async copy(text) {
    try { await navigator.clipboard.writeText(text); return true } catch {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(t); t.select()
      let ok = false; try { ok = document.execCommand('copy') } catch { /* ignore */ }
      t.remove(); return ok
    }
  },
  async native(data) { if (navigator.share) { await navigator.share(data); return true } return false },
}
