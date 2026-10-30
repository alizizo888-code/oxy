import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { X, Printer, Send, Loader2 } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { useNavigate } from 'react-router-dom'
import { useTeamRole } from '../hooks/useTeamRole'
import { zatcaQrBase64, totals, validVat } from '../lib/zatca'
import { waApi } from '../hooks/useWa'


// فاتورة ضريبية مبسّطة (QR متوافق مع المرحلة الأولى من هيئة الزكاة). بيانات البائع تُحفظ مرة واحدة في `pricing/tax_info`.
export default function InvoiceModal({ order, onClose, canEdit, wa }) {
  const nav = useNavigate()
  const { isOwner } = useTeamRole()
  const { data } = useLiveShared('pricing', { limit: 100 })
  const info = useMemo(() => (data || []).find((r) => (r.serviceId || r.id) === 'tax_info') || {}, [data])
  const [inclusive, setInclusive] = useState(true)
  const [qr, setQr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const items = (order.invoiceItems?.length ? order.invoiceItems : [{ name: 'خدمة صيانة', price: Number(order.price || order.agreedPrice || 0) }]).filter((i) => Number(i.price) >= 0)
  const t = totals(items, inclusive)
  const at = order.completedAt || order.updatedAt || new Date().toISOString()
  const ready = info.seller && validVat(info.vat)
  const no = `INV-${String(order.id).slice(-6).toUpperCase()}`
  useEffect(() => {
    if (!ready) { setQr(''); return }
    QRCode.toDataURL(zatcaQrBase64({ seller: info.seller, vat: String(info.vat).replace(/\s/g, ''), at: new Date(at).toISOString(), total: t.total, vatAmount: t.vat }), { margin: 1, width: 180 }).then(setQr).catch(() => setQr(''))
  }, [ready, info.seller, info.vat, at, t.total, t.vat])
  const text = () => `🧾 فاتورة ضريبية مبسّطة ${no}\n${info.seller}\nالرقم الضريبي: ${info.vat}\n${items.map((i) => `• ${i.name}: ${i.price} ر.س`).join('\n')}\nقبل الضريبة: ${t.net} ر.س\nضريبة القيمة المضافة 15%: ${t.vat} ر.س\nالإجمالي: ${t.total} ر.س\nشكرًا لاختيارك ${info.seller} 🙏`
  function print() {
    const w = window.open('', '_blank'); if (!w) return setMsg('اسمح بالنوافذ المنبثقة للطباعة')
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><title>${no}</title><style>body{font-family:sans-serif;max-width:380px;margin:16px auto;color:#111}h2,p{margin:4px 0}table{width:100%;border-collapse:collapse;margin:10px 0}td{padding:4px 0;border-bottom:1px solid #ddd;font-size:13px}.r{text-align:left}.t td{font-weight:bold}img{display:block;margin:10px auto}</style><h2>فاتورة ضريبية مبسّطة</h2><p>${no} — ${new Date(at).toLocaleString('ar-SA')}</p><p><b>${info.seller}</b><br>الرقم الضريبي: ${info.vat}<br>${info.address || ''}</p><p>العميل: ${order.clientName || ''}</p><table>${items.map((i) => `<tr><td>${i.name}</td><td class="r">${i.price}</td></tr>`).join('')}<tr><td>قبل الضريبة</td><td class="r">${t.net}</td></tr><tr><td>ضريبة 15%</td><td class="r">${t.vat}</td></tr><tr class="t"><td>الإجمالي (ر.س)</td><td class="r">${t.total}</td></tr></table><img src="${qr}" width="160" height="160"><script>onload=()=>print()<\/script></html>`)
    w.document.close()
  }
  async function send() {
    if (!wa) return
    setBusy(true); setMsg('')
    try { await waApi('send', { accountId: wa.accountId, to: wa.phone, text: text() }); setMsg('أُرسلت الفاتورة ✓') } catch (e) { setMsg(e?.message || 'تعذر الإرسال') } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose} dir="rtl">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0f1424] border border-white/10 p-4 flex flex-col gap-3 text-white">
        <div className="flex items-center"><h3 className="font-black flex-1">🧾 فاتورة ضريبية مبسّطة <span className="text-[11px] text-slate-400">{no}</span></h3><button onClick={onClose}><X size={18} /></button></div>
        {!ready ? (
          <div className="grid gap-2 text-xs">
            <p className="text-amber-300 font-bold">لم تُدخَل بيانات المنشأة الضريبية بعد.</p>
            <p className="text-slate-400">يضيف المالك اسم المنشأة والرقم الضريبي من: القائمة ← إدارة ← إعدادات المنشأة والفاتورة.</p>
            {isOwner && <button onClick={() => { onClose(); nav('/staff/business') }} className="rounded-xl bg-emerald-500 text-black font-black py-2.5">فتح إعدادات المنشأة</button>}
          </div>
        ) : (
          <>
            <p className="text-xs"><b>{info.seller}</b> · ض: <span dir="ltr">{info.vat}</span></p>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs grid gap-1.5">
              {items.map((i, k) => <div key={k} className="flex"><span className="flex-1">{i.name}</span><span>{i.price} ر.س</span></div>)}
              <hr className="border-white/10" />
              <div className="flex"><span className="flex-1 text-slate-400">قبل الضريبة</span><span>{t.net}</span></div>
              <div className="flex"><span className="flex-1 text-slate-400">ضريبة القيمة المضافة 15%</span><span>{t.vat}</span></div>
              <div className="flex font-black text-sm"><span className="flex-1">الإجمالي</span><span>{t.total} ر.س</span></div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} /> الأسعار المدخلة شاملة الضريبة</label>
            {qr && <img src={qr} alt="ZATCA QR" className="w-36 h-36 mx-auto rounded bg-white p-1" />}
            <div className="flex gap-2">
              <button onClick={print} className="flex-1 rounded-xl bg-white/10 py-2.5 text-xs font-black flex items-center justify-center gap-1.5"><Printer size={14} /> طباعة / PDF</button>
              {wa && <button onClick={send} disabled={busy} className="flex-1 rounded-xl bg-emerald-500 text-black py-2.5 text-xs font-black flex items-center justify-center gap-1.5">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} إرسال للعميل</button>}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">رمز QR وفق المرحلة الأولى (الإصدار). الربط والاعتماد الإلكتروني (المرحلة الثانية — فاتورة) غير مفعّل ويحتاج تسجيلًا لدى هيئة الزكاة.</p>
          </>
        )}
        {msg && <p className="text-[11px] font-bold text-amber-300">{msg}</p>}
      </div>
    </div>
  )
}
