import { useState } from 'react'
import { X, Loader2, ClipboardPlus } from 'lucide-react'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { SPECIALTIES } from '../constants'
import AppointmentPicker from './AppointmentPicker'

const inp = 'w-full bg-white border-2 border-sky-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500'

// Operations supervisor: turn a WhatsApp / phone request into a real order in the distribution queue.
export default function ManualOrderModal({ onClose, onCreated, by, initial }) {
  const [f, setF] = useState({ name: '', phone: '', specialtyId: 'ac', description: '', address: '', price: '', ...(initial || {}) })
  const [appt, setAppt] = useState({ label: '', at: null })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  async function submit() {
    setErr('')
    const phone = f.phone.replace(/\D/g, '')
    if (!f.name.trim()) return setErr('اكتب اسم العميل')
    if (!/^(?:966|0)?5\d{8}$/.test(phone)) return setErr('اكتب رقم جوال سعودي صحيح')
    setBusy(true)
    try {
      const gid = await team.groupId()
      const now = new Date().toISOString()
      const price = Number(f.price)
      const order = await db.insertShared('orders', {
        clientId: null, clientName: f.name.trim(), clientPhone: '966' + phone.slice(-9), clientType: 'guest',
        specialtyId: f.specialtyId, description: f.description.trim(), serviceDetails: f.description.trim() || null,
        preferredTime: appt.label || null, appointmentAt: appt.at || null, address: f.address.trim(),
        ...(price > 0 ? { agreedPrice: price } : {}),
        priority: initial?.priority === 'urgent' ? 'urgent' : 'normal', status: 'new', statusHistory: [{ status: 'new', at: now, by: by || 'operations' }],
        source: 'whatsapp_manual', routing: 'operations', ...(initial?.waThreadId ? { waThreadId: initial.waThreadId } : {}),
      }, undefined, { groupId: gid, visibleTo: 'creator-and-admin' })
      onCreated?.(order)
      onClose()
    } catch (e) {
      setErr(e?.code === 'forbidden' ? 'إنشاء الطلبات اليدوية متوقف من المالك.' : 'تعذر إنشاء الطلب، حاول مرة أخرى')
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3" onClick={onClose} dir="rtl">
      <div className="bg-sky-50 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border-4 border-emerald-500" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-l from-emerald-600 to-green-500 text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <ClipboardPlus size={22} />
          <div className="flex-1"><p className="font-display font-black text-base">طلب جديد من واتساب / اتصال</p><p className="text-[11px] font-bold opacity-90">يدخل مباشرة قائمة التوزيع على الفنيين</p></div>
          <button onClick={onClose} aria-label="إغلاق" className="w-8 h-8 rounded-full bg-black/25 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <input className={inp} placeholder="اسم العميل" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <input className={inp} placeholder="جوال العميل 05xxxxxxxx" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <select className={inp} value={f.specialtyId} onChange={(e) => set('specialtyId', e.target.value)}>{SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <textarea className={`${inp} resize-none`} rows={2} placeholder="تفاصيل الطلب (المشكلة، العدد…)" value={f.description} onChange={(e) => set('description', e.target.value)} />
          <input className={inp} placeholder="العنوان / الحي" value={f.address} onChange={(e) => set('address', e.target.value)} />
          <input className={inp} placeholder="السعر المتفق عليه (اختياري)" inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value)} />
          <AppointmentPicker onChange={setAppt} />
          {err && <p className="bg-rose-600 text-white text-xs font-black rounded-xl p-2.5">{err}</p>}
          <button onClick={submit} disabled={busy} className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-display font-black text-sm rounded-2xl py-3.5 shadow-lg disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardPlus size={16} />}إنشاء الطلب وإرساله للتوزيع</button>
        </div>
      </div>
    </div>
  )
}
