import { useState } from 'react'
import { Camera, Plus, X, Loader2 } from 'lucide-react'
import { db } from '../lib/db'
import { storage } from '../lib/storage'

// Service documentation (reference: design-reference/03): before/after photos + invoice lines. Technician edits; the customer only reads.
export default function ServiceDocs({ order, canEdit, dark = true }) {
  const [busy, setBusy] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')
  const before = order.photosBefore || [], after = order.photosAfter || [], items = order.invoiceItems || []
  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0)
  const patch = async (p) => { setErr(''); try { await db.updateShared('orders', order.id, p) } catch { setErr('تعذر الحفظ') } }
  const add = async (key, list, files) => {
    setBusy(key)
    try { const urls = []; for (const f of Array.from(files || []).slice(0, 4)) { const { url } = await storage.upload(f, f.name || 'photo'); urls.push(url) }; if (urls.length) await patch({ [key]: [...list, ...urls] }) }
    catch { setErr('تعذر رفع الصورة') } finally { setBusy('') }
  }
  const tone = dark ? { box: 'bg-white/[0.04] border-white/10', t: 'text-white', s: 'text-slate-400', inp: 'bg-white/5 border-white/10 text-white' } : { box: 'bg-white border-black/5', t: 'text-slate-900', s: 'text-slate-500', inp: 'bg-slate-50 border-slate-200 text-slate-900' }
  if (!canEdit && !before.length && !after.length && !items.length) return null
  const Photos = ({ title, k, list }) => (
    <div className="flex-1 min-w-0">
      <p className={`text-[11px] font-black mb-1.5 ${tone.s}`}>{title}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {list.map((u, i) => (
          <div key={u + i} className="relative"><img src={u} alt="" className="w-full h-20 object-cover rounded-lg" />
            {canEdit && <button onClick={() => patch({ [k]: list.filter((x) => x !== u) })} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={11} /></button>}</div>
        ))}
        {canEdit && <label className={`h-20 rounded-lg border border-dashed flex items-center justify-center cursor-pointer ${dark ? 'border-white/20 text-slate-400' : 'border-slate-300 text-slate-400'}`}>
          {busy === k ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => add(k, list, e.target.files)} /></label>}
      </div>
    </div>
  )
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${tone.box}`}>
      <p className={`text-sm font-black ${tone.t}`}>توثيق الخدمة وبنود الفاتورة</p>
      <div className="flex gap-3"><Photos title="قبل الصيانة" k="photosBefore" list={before} /><Photos title="بعد التنفيذ" k="photosAfter" list={after} /></div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tone.box}`}>
            <span className={`flex-1 text-xs font-bold ${tone.t}`}>{it.name}</span><span className={`text-xs font-black ${tone.t}`}>{it.price} ر.س</span>
            {canEdit && <button onClick={() => patch({ invoiceItems: items.filter((_, j) => j !== i) })} className="text-rose-400"><X size={14} /></button>}
          </div>
        ))}
        {canEdit && (
          <div className="flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="بند أو قطعة غيار" className={`flex-[2] rounded-xl border px-3 py-2 text-xs ${tone.inp}`} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="السعر" className={`flex-1 rounded-xl border px-3 py-2 text-xs ${tone.inp}`} />
            <button disabled={!name.trim() || !(Number(amount) >= 0) || amount === ''} onClick={async () => { await patch({ invoiceItems: [...items, { name: name.trim().slice(0, 80), price: Number(amount) }] }); setName(''); setAmount('') }} className="rounded-xl bg-primary text-black px-3 disabled:opacity-40"><Plus size={16} /></button>
          </div>
        )}
        {items.length > 0 && <div className="flex items-center"><span className={`text-xs font-bold ${tone.s}`}>إجمالي البنود</span><span className={`mr-auto font-display font-black ${tone.t}`}>{total} ر.س</span>
          {canEdit && Number(order.price) !== total && <button onClick={() => patch({ price: total })} className="mr-2 rounded-lg bg-emerald-500 text-black text-[11px] font-black px-2.5 py-1">اعتمد كسعر نهائي</button>}</div>}
      </div>
      {err && <p className="text-[11px] text-rose-400">{err}</p>}
    </div>
  )
}
