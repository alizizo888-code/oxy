import { useMemo, useState } from 'react'
import { ShieldCheck, Loader2, Paperclip, X, AlertTriangle } from 'lucide-react'
import { storage } from '../lib/storage'
import { auth } from '../lib/auth'
import { submitClaim } from '../hooks/useWarranty'
import { orderWarranty, warrantyText, specialtyLabel } from '../warranty'

// Warranty claim — opens a real "customer file" with the problem, the checked
// warranty status and attached photos/documents, sent to operations for review.
export default function WarrantyClaimForm({ orders, policy, customer, presetOrderId, source = 'app', onDone }) {
  const eligible = useMemo(() => (orders || []).filter((o) => ['completed', 'closed'].includes(o.status)), [orders])
  const [orderId, setOrderId] = useState(presetOrderId || eligible[0]?.id || 'external')
  const [certificateNo, setCertificateNo] = useState('')
  const [problem, setProblem] = useState('')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const order = eligible.find((o) => o.id === orderId) || null
  const w = order ? orderWarranty(order, policy) : null

  async function addFiles(e) {
    const list = Array.from(e.target.files || []).slice(0, 4 - files.length)
    e.target.value = ''
    if (!list.length) return
    setUploading(true)
    setErr('')
    try {
      for (const f of list) {
        const { url } = await storage.upload(f, f.name || 'file')
        setFiles((x) => [...x, { url, name: f.name, type: f.type }])
      }
    } catch {
      setErr('تعذر رفع الملف — جرّب ملفًا أصغر')
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!problem.trim()) return setErr('اكتب وصف المشكلة')
    if (!order && !certificateNo.trim() && !phone.trim()) return setErr('أدخل رقم شهادة الضمان أو رقم الجوال المسجل به الضمان')
    if (policy?.claimPhotoRequired && !files.length) return setErr('أرفق صورة واحدة على الأقل للعطل')
    setBusy(true)
    setErr('')
    try {
      const row = await submitClaim({
        orderId: order?.id || null,
        specialtyId: order?.specialtyId || null,
        certificateNo: certificateNo.trim() || null,
        customerName: customer?.name || 'عميل',
        customerPhone: phone.trim() || null,
        clientId: auth.getCurrentUser()?.id || null,
        problem: problem.trim(),
        attachments: files,
        warrantyCheck: w?.known ? { active: w.active, end: w.end, days: w.days, remainingDays: w.remainingDays, source: 'order' } : { source: order ? 'order' : 'registry_pending' },
        source,
      })
      onDone?.(row, w)
    } catch {
      setErr('تعذر إرسال طلب الضمان، حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-3.5 fade-up" dir="rtl">
      <p className="font-display font-black text-slate-900 text-sm mb-2 flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-600" /> فتح ملف ضمان</p>

      <label className={lbl}>الخدمة المشمولة</label>
      <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inp}>
        {eligible.map((o) => (
          <option key={o.id} value={o.id}>{specialtyLabel(o.specialtyId)} · #{String(o.id).slice(-5)}</option>
        ))}
        <option value="external">ضمان مسجل خارج التطبيق (تركيب / جهاز / عقد)</option>
      </select>

      {order && (
        <div className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-bold flex items-start gap-1.5 ${w?.known && w.active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {w?.known && w.active ? <ShieldCheck size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
          <span>{warrantyText(w)}{w?.known && !w.active ? ' — يمكنك الإرسال وسيراجعه الفريق، أو اطلب زيارة جديدة.' : ''}</span>
        </div>
      )}

      {!order && (
        <>
          <label className={lbl}>رقم شهادة الضمان (إن وجد)</label>
          <input value={certificateNo} onChange={(e) => setCertificateNo(e.target.value)} className={inp} dir="ltr" placeholder="W-XXXXXX" />
          <label className={lbl}>رقم الجوال المسجل به الضمان</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} dir="ltr" inputMode="tel" />
          <p className="text-[10px] text-slate-400 mt-1">يفحص فريق العمليات سجل الضمانات ويؤكد لك المدة المتبقية.</p>
        </>
      )}

      <label className={lbl}>وصف المشكلة</label>
      <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="مثال: رجع المكيف يسرّب مياه بعد الغسيل" />

      <label className={lbl}>صور أو مستندات (فاتورة، صورة العطل){policy?.claimPhotoRequired ? ' — مطلوب' : ''}</label>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f, i) => (
          <span key={f.url} className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 max-w-[140px]">
            <span className="truncate">{f.name || `ملف ${i + 1}`}</span>
            <button onClick={() => setFiles((x) => x.filter((y) => y.url !== f.url))}><X size={11} /></button>
          </span>
        ))}
        {files.length < 4 && (
          <label className="flex items-center gap-1 bg-sky-50 border border-dashed border-sky-300 rounded-lg px-2.5 py-1 text-[10px] font-bold text-sky-700 cursor-pointer">
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />} إرفاق
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={addFiles} disabled={uploading} />
          </label>
        )}
      </div>

      {err && <p className="text-rose-600 text-[11px] font-bold mt-2">{err}</p>}
      <button onClick={submit} disabled={busy || uploading} className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-l from-emerald-500 to-teal-600 text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-60">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} إرسال ملف الضمان للفحص
      </button>
    </div>
  )
}

const lbl = 'block text-[11px] font-bold text-slate-500 mt-2.5 mb-1'
const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary'
