import AccessDenied from '../components/AccessDenied'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Plus, Search, Loader2, Save, X, Paperclip, FileText, Check, Ban, Eye } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { push } from '../lib/push'
import { storage } from '../lib/storage'
import { useTeamRole } from '../hooks/useTeamRole'
import { useWarrantyPolicy, saveWarrantyPolicy, saveWarranty } from '../hooks/useWarranty'
import { orderWarranty, recordWarranty, warrantyText, fmtDate, CLAIM_STATUS, specialtyLabel } from '../warranty'
import { SPECIALTIES } from '../constants'

const digits = (s) => String(s || '').replace(/\D/g, '').slice(-9)

export default function Warranties() {
  const navigate = useNavigate()
  const { role, isOwner, loading, refresh } = useTeamRole()
  const [tab, setTab] = useState('claims')
  const allowed = isOwner || ['operations', 'supervisor'].includes(role)
  if (loading) return <Centered>جارِ التحقق…</Centered>
  if (!allowed) return <AccessDenied refresh={refresh} />
  const canEdit = isOwner || role === 'operations'

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/staff/operations')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ChevronRight size={18} className="text-slate-300" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-emerald-400 font-bold tracking-widest">WARRANTY CENTER</p>
            <h1 className="font-display text-lg font-black text-white">نظام الضمان</h1>
          </div>
        </div>
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 pb-3 flex gap-1.5">
          {[['claims', 'ملفات الضمان'], ['registry', 'سجل الضمانات'], ['policy', 'سياسة الضمان']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${tab === id ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>{label}</button>
          ))}
        </div>
      </header>
      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-5">
        {tab === 'claims' && <Claims canEdit={canEdit} />}
        {tab === 'registry' && <Registry canEdit={canEdit} />}
        {tab === 'policy' && <Policy canEdit={canEdit} />}
      </main>
    </div>
  )
}

function useAllWarranties() {
  const { policy } = useWarrantyPolicy()
  const { data: records } = useLiveShared('warranties', { order: '-updatedAt', limit: 500 })
  const { data: orders } = useLiveShared('orders', { order: '-createdAt', limit: 500 })
  const list = useMemo(() => {
    const fromOrders = (orders || []).filter((o) => ['completed', 'closed'].includes(o.status)).map((o) => ({
      key: 'o-' + o.id, kind: 'order', customerName: o.clientName, phone: o.clientPhone, specialtyId: o.specialtyId, label: `طلب #${String(o.id).slice(-5)}`, w: orderWarranty(o, policy), order: o,
    }))
    const fromRegistry = (records || []).map((r) => ({
      key: 'r-' + r.id, kind: 'registry', customerName: r.customerName, phone: r.phone, specialtyId: r.specialtyId, label: r.certificateNo, w: recordWarranty(r), rec: r,
    }))
    return [...fromRegistry, ...fromOrders]
  }, [records, orders, policy])
  return { list, policy }
}

function Claims({ canEdit }) {
  const { data: claims, loading } = useLiveShared('warranty_claims', { order: '-createdAt', limit: 200 })
  const { list } = useAllWarranties()
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('open')
  const shown = (claims || []).filter((c) => (filter === 'open' ? ['new', 'reviewing'].includes(c.status) : true))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {[['open', 'المفتوحة'], ['all', 'الكل']].map(([id, l]) => (
          <button key={id} onClick={() => setFilter(id)} className={`rounded-lg px-3 py-1 text-[11px] font-bold ${filter === id ? 'bg-white/15 text-white' : 'text-slate-400'}`}>{l}</button>
        ))}
      </div>
      {loading ? <p className="text-slate-500 text-xs text-center py-8">جارِ التحميل…</p> : shown.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-10">لا توجد ملفات ضمان {filter === 'open' ? 'مفتوحة' : ''}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((c) => {
            const st = CLAIM_STATUS[c.status] || CLAIM_STATUS.new
            return (
              <button key={c.id} onClick={() => setOpen(c)} className="text-right bg-white/[0.04] border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-white truncate">{c.customerName || 'عميل'}</p>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{c.specialtyId ? specialtyLabel(c.specialtyId) : c.certificateNo || 'ضمان خارجي'} · {fmtDate(c.createdAt)}{c.source === 'mutqan_ai' ? ' · عبر MUTQAN AI' : ''}</p>
                <p className="text-xs text-slate-300 mt-2 line-clamp-2">{c.problem}</p>
                {c.warrantyCheck?.end && <p className={`text-[10px] font-bold mt-2 ${c.warrantyCheck.active ? 'text-emerald-400' : 'text-rose-400'}`}>{c.warrantyCheck.active ? `ضمان ساري — متبقي ${c.warrantyCheck.remainingDays} يوم` : 'الضمان منتهي'}</p>}
                {c.attachments?.length > 0 && <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Paperclip size={10} /> {c.attachments.length} مرفق</p>}
              </button>
            )
          })}
        </div>
      )}
      {open && <ClaimSheet claim={(claims || []).find((c) => c.id === open.id) || open} list={list} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ClaimSheet({ claim, list, canEdit, onClose }) {
  const [note, setNote] = useState(claim.decisionNote || '')
  const [busy, setBusy] = useState('')
  // Check: match the claim against the real registry / completed orders
  const matches = useMemo(() => {
    if (claim.orderId) return list.filter((x) => x.order?.id === claim.orderId)
    const p = digits(claim.customerPhone)
    return list.filter((x) => (claim.certificateNo && x.label === claim.certificateNo) || (p && digits(x.phone) === p))
  }, [claim, list])

  async function decide(status) {
    setBusy(status)
    try {
      await db.updateShared('warranty_claims', claim.id, { status, decisionNote: note.trim(), decidedAt: new Date().toISOString(), matchedWarrantyId: matches[0]?.key || null })
      if (claim.clientId && status !== 'reviewing') {
        try { await push.send(claim.clientId, { title: status === 'approved' ? 'تم قبول طلب الضمان ✅' : 'تحديث على طلب الضمان', body: note.trim() || CLAIM_STATUS[status].label, url: '#/warranty' }) } catch {}
      }
      if (status !== 'reviewing') onClose()
    } catch { alert('تعذر الحفظ — تأكد من صلاحياتك') } finally { setBusy('') }
  }

  return (
    <Sheet title="ملف ضمان" onClose={onClose}>
      <Info k="العميل" v={claim.customerName} />
      <Info k="الجوال" v={claim.customerPhone} ltr />
      <Info k="الخدمة" v={claim.specialtyId ? specialtyLabel(claim.specialtyId) : '—'} />
      <Info k="رقم الشهادة" v={claim.certificateNo} ltr />
      <Info k="المصدر" v={claim.source === 'mutqan_ai' ? 'MUTQAN AI' : 'التطبيق'} />
      <p className="text-[11px] font-bold text-slate-400 mt-3 mb-1">المشكلة</p>
      <p className="text-sm text-slate-200 bg-white/5 rounded-xl p-3 leading-relaxed">{claim.problem}</p>
      {claim.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {claim.attachments.map((a, i) => (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="block">
              {String(a.type || '').startsWith('image') ? (
                <img src={a.url} alt="" className="w-20 h-20 object-cover rounded-xl border border-white/10" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <span className="flex items-center gap-1 bg-white/5 rounded-xl px-3 py-2 text-[11px] text-slate-300"><FileText size={12} /> {a.name || `ملف ${i + 1}`}</span>
              )}
            </a>
          ))}
        </div>
      )}
      <p className="text-[11px] font-bold text-slate-400 mt-4 mb-1 flex items-center gap-1"><ShieldCheck size={12} /> فحص الضمان من السجل</p>
      {matches.length === 0 ? (
        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-xl p-3">لا يوجد ضمان مطابق في السجل لهذا الرقم / الشهادة — تحقق يدويًا أو سجّل الضمان أولًا.</p>
      ) : matches.map((m) => (
        <div key={m.key} className={`rounded-xl p-3 mb-1.5 text-xs ${m.w.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
          <p className="font-bold">{m.label} · {specialtyLabel(m.specialtyId)}</p>
          <p className="mt-0.5">{warrantyText(m.w)}</p>
        </div>
      ))}
      {canEdit ? (
        <>
          <p className="text-[11px] font-bold text-slate-400 mt-4 mb-1">ملاحظة القرار (تظهر للعميل)</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inp} resize-none`} />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button onClick={() => decide('reviewing')} disabled={!!busy} className="flex items-center justify-center gap-1 bg-amber-500/15 text-amber-300 rounded-xl py-2.5 text-xs font-bold">{busy === 'reviewing' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} قيد الفحص</button>
            <button onClick={() => decide('approved')} disabled={!!busy} className="flex items-center justify-center gap-1 bg-emerald-500 text-black rounded-xl py-2.5 text-xs font-black">{busy === 'approved' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} قبول</button>
            <button onClick={() => decide('rejected')} disabled={!!busy} className="flex items-center justify-center gap-1 bg-rose-500/15 text-rose-300 rounded-xl py-2.5 text-xs font-bold">{busy === 'rejected' ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} رفض</button>
          </div>
        </>
      ) : <p className="text-[11px] text-slate-500 mt-4">القرار لمشرف العمليات أو المالك.</p>}
    </Sheet>
  )
}

function Registry({ canEdit }) {
  const { list } = useAllWarranties()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const shown = useMemo(() => {
    const s = q.trim()
    if (!s) return list
    const d = digits(s)
    return list.filter((x) => (x.customerName || '').includes(s) || (x.label || '').toUpperCase().includes(s.toUpperCase()) || (d.length >= 4 && digits(x.phone).includes(d)))
  }, [list, q])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
          <Search size={15} className="text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الجوال أو رقم الشهادة" className="flex-1 bg-transparent py-2.5 text-sm text-white focus:outline-none" />
        </div>
        {canEdit && (
          <button onClick={() => setEditing({ customerName: '', phone: '', specialtyId: 'ac', device: '', serial: '', startDate: new Date().toISOString().slice(0, 10), days: 30, notes: '', files: [] })} className="shrink-0 flex items-center gap-1.5 bg-emerald-500 text-black rounded-xl px-3 text-xs font-black"><Plus size={14} /> تسجيل ضمان</button>
        )}
      </div>
      <p className="text-[11px] text-slate-500">ضمانات الطلبات المكتملة تُسجَّل تلقائيًا من تاريخ الاكتمال. سجّل هنا يدويًا ضمانات التركيب والأجهزة والعقود أو العملاء القادمين من واتساب.</p>
      {shown.length === 0 ? <p className="text-slate-500 text-xs text-center py-10">لا توجد ضمانات مطابقة</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((x) => (
            <div key={x.key} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white truncate">{x.customerName || 'عميل'}</p>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${x.w.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/20 text-slate-400'}`}>{x.w.known ? (x.w.active ? 'ساري' : 'منتهي') : '—'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5" >{x.label} · {specialtyLabel(x.specialtyId)} · {x.kind === 'order' ? 'تلقائي من طلب' : 'يدوي'}</p>
              {x.phone && <p className="text-[11px] text-slate-500" dir="ltr">{x.phone}</p>}
              {x.rec?.device && <p className="text-[11px] text-slate-400">الجهاز: {x.rec.device}{x.rec.serial ? ` · ${x.rec.serial}` : ''}</p>}
              <p className="text-[11px] text-slate-300 mt-1.5">{warrantyText(x.w)}</p>
              {x.rec?.files?.length > 0 && <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Paperclip size={10} /> {x.rec.files.length} ملف</p>}
              {canEdit && x.rec && <button onClick={() => setEditing(x.rec)} className="mt-2 w-full bg-white/5 hover:bg-white/10 rounded-xl py-1.5 text-[11px] font-bold text-slate-300">تعديل</button>}
            </div>
          ))}
        </div>
      )}
      {editing && <RecordEditor rec={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RecordEditor({ rec, onClose }) {
  const [f, setF] = useState({ ...rec, files: rec.files || [] })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function addFiles(e) {
    const list = Array.from(e.target.files || [])
    e.target.value = ''
    setUploading(true)
    try {
      for (const file of list.slice(0, 5)) {
        const { url } = await storage.upload(file, file.name || 'file')
        setF((x) => ({ ...x, files: [...x.files, { url, name: file.name, type: file.type }] }))
      }
    } catch { setErr('تعذر رفع الملف') } finally { setUploading(false) }
  }

  async function save() {
    if (!f.customerName?.trim() || !f.phone?.trim()) return setErr('الاسم ورقم الجوال مطلوبان')
    if (!f.startDate) return setErr('حدد تاريخ بداية الضمان')
    setBusy(true); setErr('')
    try {
      await saveWarranty({ ...f, customerName: f.customerName.trim(), phone: f.phone.trim(), days: Math.max(0, Number(f.days) || 0), startDate: new Date(f.startDate).toISOString() })
      onClose()
    } catch { setErr('تعذر الحفظ — تأكد من صلاحياتك') } finally { setBusy(false) }
  }

  return (
    <Sheet title={rec.id ? 'تعديل ضمان' : 'تسجيل ضمان جديد'} onClose={onClose}>
      <label className={lbl}>اسم العميل</label>
      <input value={f.customerName} onChange={set('customerName')} className={inp} />
      <label className={lbl}>رقم الجوال</label>
      <input value={f.phone} onChange={set('phone')} className={inp} dir="ltr" inputMode="tel" />
      <label className={lbl}>الخدمة</label>
      <select value={f.specialtyId} onChange={set('specialtyId')} className={inp}>
        {SPECIALTIES.map((s) => <option key={s.id} value={s.id} className="bg-slate-900">{s.icon} {s.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>الجهاز / الموديل</label><input value={f.device || ''} onChange={set('device')} className={inp} /></div>
        <div><label className={lbl}>الرقم التسلسلي</label><input value={f.serial || ''} onChange={set('serial')} className={inp} dir="ltr" /></div>
        <div><label className={lbl}>تاريخ البداية</label><input type="date" value={String(f.startDate || '').slice(0, 10)} onChange={set('startDate')} className={inp} dir="ltr" /></div>
        <div><label className={lbl}>مدة الضمان (يوم)</label><input type="number" value={f.days} onChange={set('days')} className={inp} dir="ltr" /></div>
      </div>
      <label className={lbl}>ملاحظات</label>
      <textarea value={f.notes || ''} onChange={set('notes')} rows={2} className={`${inp} resize-none`} />
      <label className={lbl}>ملفات (فاتورة، شهادة، صور التركيب)</label>
      <div className="flex flex-wrap gap-1.5">
        {f.files.map((x, i) => (
          <span key={x.url} className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 text-[10px] text-slate-300 max-w-[150px]">
            <a href={x.url} target="_blank" rel="noreferrer" className="truncate">{x.name || `ملف ${i + 1}`}</a>
            <button onClick={() => setF((y) => ({ ...y, files: y.files.filter((z) => z.url !== x.url) }))}><X size={11} /></button>
          </span>
        ))}
        <label className="flex items-center gap-1 bg-white/5 border border-dashed border-white/20 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-300 cursor-pointer">
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />} إرفاق
          <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={addFiles} />
        </label>
      </div>
      {f.certificateNo && <p className="text-[11px] text-slate-400 mt-3">رقم الشهادة: <span dir="ltr" className="font-bold text-white">{f.certificateNo}</span></p>}
      {err && <p className="text-rose-400 text-xs font-bold mt-3">{err}</p>}
      <button onClick={save} disabled={busy || uploading} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 text-black font-black rounded-xl py-3 disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} حفظ الضمان
      </button>
    </Sheet>
  )
}

function Policy({ canEdit }) {
  const { policy, loading } = useWarrantyPolicy()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (loading) return <p className="text-slate-500 text-xs text-center py-8">جارِ التحميل…</p>
  const v = f || policy

  async function save() {
    setBusy(true); setMsg('')
    try { await saveWarrantyPolicy({ ...v, defaultDays: Math.max(0, Number(v.defaultDays) || 0) }); setF(null); setMsg('تم الحفظ ✓') } catch { setMsg('تعذر الحفظ — تأكد من صلاحياتك') } finally { setBusy(false) }
  }
  const upd = (patch) => setF({ ...v, ...patch })

  return (
    <div className="max-w-3xl flex flex-col gap-3">
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
        <label className={lbl}>مدة الضمان الافتراضية (يوم من اكتمال الخدمة)</label>
        <input type="number" disabled={!canEdit} value={v.defaultDays} onChange={(e) => upd({ defaultDays: e.target.value })} className={inp} dir="ltr" />
        <label className={lbl}>شروط الضمان (يقرأها MUTQAN AI والعميل)</label>
        <textarea disabled={!canEdit} value={v.terms} onChange={(e) => upd({ terms: e.target.value })} rows={3} className={`${inp} resize-none`} placeholder="مثال: إعادة زيارة مجانية لنفس العطل خلال مدة الضمان" />
        <label className={lbl}>ما لا يشمله الضمان</label>
        <textarea disabled={!canEdit} value={v.exclusions} onChange={(e) => upd({ exclusions: e.target.value })} rows={2} className={`${inp} resize-none`} placeholder="مثال: سوء الاستخدام، الكسر، قطع الغيار التي أحضرها العميل" />
        <button type="button" disabled={!canEdit} onClick={() => upd({ claimPhotoRequired: !v.claimPhotoRequired })} className="mt-3 w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
          <span className="text-xs font-bold text-white">إلزام العميل بإرفاق صورة للعطل</span>
          <span className={`w-10 h-6 rounded-full p-0.5 ${v.claimPhotoRequired ? 'bg-emerald-500' : 'bg-slate-600'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${v.claimPhotoRequired ? '-translate-x-4' : ''}`} /></span>
        </button>
      </div>
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
        <p className="text-xs font-black text-white mb-1">مدد خاصة لكل خدمة</p>
        <p className="text-[11px] text-slate-500 mb-3">اترك الخانة فارغة لتطبيق المدة الافتراضية.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SPECIALTIES.map((s) => (
            <label key={s.id} className="flex items-center gap-2 bg-white/5 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] text-slate-300 flex-1 truncate">{s.icon} {s.label}</span>
              <input type="number" disabled={!canEdit} value={v.days?.[s.id] ?? ''} placeholder={String(v.defaultDays)} onChange={(e) => upd({ days: { ...v.days, [s.id]: e.target.value === '' ? '' : Number(e.target.value) } })} className="w-16 bg-black/30 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none" dir="ltr" />
            </label>
          ))}
        </div>
      </div>
      {canEdit && (
        <button onClick={save} disabled={busy || !f} className="flex items-center justify-center gap-2 bg-emerald-500 text-black font-black rounded-xl py-3 disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} حفظ السياسة
        </button>
      )}
      {msg && <p className="text-xs font-bold text-slate-300 text-center">{msg}</p>}
    </div>
  )
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} dir="rtl">
      <div className="w-full max-w-lg bg-[#0f1422] border border-white/10 rounded-t-3xl md:rounded-3xl p-5 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-black text-white flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-400" /> {title}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><X size={16} className="text-slate-300" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Info({ k, v, ltr }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-xs">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200 font-bold" dir={ltr ? 'ltr' : undefined}>{v || '—'}</span>
    </div>
  )
}

const lbl = 'block text-[11px] font-bold text-slate-400 mt-3 mb-1'
const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400 disabled:opacity-60'

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#090c14]" dir="rtl">{children}</div>
}
