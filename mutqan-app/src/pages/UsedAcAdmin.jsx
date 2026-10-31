import { errText } from '../lib/_api'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Trash2, Loader2, ImagePlus, Save, X, Phone, MessageCircle } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { useLiveShared } from '../lib/useLive'
import { useAcConfig } from '../hooks/useAcConfig'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { storage } from '../lib/storage'
import { KINDS, CONDITIONS, STATUSES, condOf, kindOf, statusOf, waLink } from '../lib/usedAc'

const inp = 'w-full bg-white/10 border-2 border-white/20 rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400'
const EMPTY = { title: '', kind: 'split', brand: '', capacity: '', age: '', condition: 'good', appearance: '', defects: '', warranty: '', price: '', floor: '', status: 'available', photos: [] }

// Owner / operations: add used AC units with photos, price (+ private floor for negotiation) and details.
export default function UsedAcAdmin() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { cfg } = useAcConfig()
  const { data: units } = useLiveShared('used_ac', { order: '-createdAt', limit: 200 })
  const { data: priv } = useLiveShared('used_ac_private', { limit: 200 })
  const { data: offers } = useLiveShared('used_offers', { order: '-updatedAt', limit: 300 })
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const floors = useMemo(() => Object.fromEntries((priv || []).map((p) => [p.id, p.floor])), [priv])
  const offersBy = useMemo(() => { const m = {}; (offers || []).forEach((o) => { (m[o.unitId] ||= []).push(o) }); return m }, [offers])

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">جارِ التحميل…</div>
  if (!(isOwner || role === 'operations')) return <div className="h-full flex items-center justify-center text-slate-400">للمالك ومشرف العمليات فقط</div>

  const edit = (u) => setF(u ? { ...EMPTY, ...u, price: u.price ?? '', floor: floors[u.id] ?? '' } : { ...EMPTY })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const addPhotos = async (files) => {
    const list = Array.from(files || []); if (!list.length) return
    setBusy(true); setErr('')
    try { const urls = []; for (const file of list) { const { url } = await storage.upload(file); urls.push(url) }; setF((s) => ({ ...s, photos: [...(s.photos || []), ...urls] })) }
    catch (e) { setErr(errText(e, 'تعذر رفع الصورة')) }
    setBusy(false)
  }
  const save = async () => {
    if (!f.title.trim()) return setErr('اكتب عنوان الجهاز')
    setBusy(true); setErr('')
    try {
      const g = await team.groupId()
      const data = { title: f.title.trim(), kind: f.kind, brand: f.brand.trim(), capacity: f.capacity.trim(), age: f.age.trim(), condition: f.condition, appearance: f.appearance.trim(), defects: f.defects.trim(), warranty: f.warranty.trim(), price: Number(f.price) || 0, status: f.status, photos: f.photos || [] }
      let id = f.id
      if (id) await db.updateShared('used_ac', id, data)
      else { const r = await db.insertShared('used_ac', { ...data, createdAt: new Date().toISOString() }, undefined, { groupId: g, writableBy: 'admins' }); id = r?.id }
      if (id) await db.upsertShared('used_ac_private', { floor: Number(f.floor) || 0 }, id, { groupId: g, writableBy: 'admins' })
      setF(null)
    } catch (e) { setErr(errText(e, 'تعذر الحفظ')) }
    setBusy(false)
  }
  const del = async (u) => { if (!window.confirm('حذف هذا الجهاز نهائياً؟')) return; try { await db.deleteShared('used_ac', u.id); await db.deleteShared('used_ac_private', u.id).catch(() => {}) } catch (e) { setErr(errText(e, 'تعذر الحذف')) } }
  const setStatus = (u, status) => db.updateShared('used_ac', u.id, { status }).catch(() => setErr('تعذر التحديث'))

  return (
    <div className="h-full overflow-y-auto pb-24 text-white" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button>
        <div className="flex-1"><h1 className="font-display font-black text-base">متجر الأجهزة المستعملة</h1><p className="text-[11px] text-white/60">{(units || []).length} جهاز · {(offers || []).filter((o) => o.state === 'open').length} عرض مفتوح</p></div>
        <button onClick={() => edit(null)} className="flex items-center gap-1.5 bg-emerald-600 text-white font-black text-sm rounded-xl px-4 py-2.5 shadow-lg"><Plus size={16} />جهاز جديد</button>
      </header>
      {err && <p className="mx-4 mt-3 bg-rose-600 text-white text-sm font-black rounded-xl p-3">{err}</p>}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl mx-auto">
        {(units || []).length === 0 && <p className="text-center text-white/60 font-bold py-12 col-span-full">لم تُضف أجهزة بعد — اضغط «جهاز جديد»</p>}
        {(units || []).map((u) => {
          const c = condOf(u.condition); const st = statusOf(u.status || 'available'); const os = offersBy[u.id] || []
          return (
            <div key={u.id} className="bg-white/5 border-2 border-white/15 rounded-2xl overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="w-24 h-24 rounded-xl bg-white/10 overflow-hidden shrink-0 flex items-center justify-center text-3xl">{u.photos?.[0] ? <img src={u.photos[0]} className="w-full h-full object-cover" /> : kindOf(u.kind).icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate">{u.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] font-black rounded-full px-2 py-0.5" style={{ background: c.bg }}>{c.label}</span>
                    <span className="text-[10px] font-black rounded-full px-2 py-0.5" style={{ background: st.bg }}>{st.label}</span>
                    <span className="text-[10px] font-black rounded-full px-2 py-0.5 bg-slate-700">{kindOf(u.kind).label}</span>
                  </div>
                  <p className="text-sm font-black mt-1.5 text-sky-300">{u.price ? `${u.price} ر.س` : 'بدون سعر'} <span className="text-[11px] text-amber-300">{floors[u.id] ? `· أقل سعر ${floors[u.id]}` : ''}</span></p>
                </div>
              </div>
              <div className="flex gap-2 px-3 pb-3">
                {STATUSES.filter((s) => s.id !== (u.status || 'available')).slice(0, 3).map((s) => <button key={s.id} onClick={() => setStatus(u, s.id)} className="flex-1 text-[11px] font-black rounded-lg py-2 border-2 border-white/20 active:scale-95" style={{ background: s.bg }}>{s.label}</button>)}
                <button onClick={() => edit(u)} className="px-4 text-[11px] font-black rounded-lg bg-sky-600">تعديل</button>
                <button onClick={() => del(u)} className="px-3 rounded-lg bg-rose-700"><Trash2 size={14} /></button>
              </div>
              {os.length > 0 && (
                <div className="border-t border-white/10 bg-black/20 p-3 flex flex-col gap-2">
                  <p className="text-[11px] font-black text-amber-300">عروض العملاء ({os.length})</p>
                  {os.slice(0, 6).map((o) => (
                    <div key={o.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-2 text-xs">
                      <div className="flex-1 min-w-0"><p className="font-black truncate">{o.name || 'عميل'} — عرض {o.lastOffer} ر.س</p><p className="text-white/60 text-[10px]">{o.lastReply === 'accepted' ? '✅ مقبول' : `ردّ البوت: ${o.lastPrice} ر.س`} · محاولة {o.attempts}</p></div>
                      <a href={`tel:+${o.phone}`} className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center"><Phone size={14} /></a>
                      <a href={waLink(o.phone, `السلام عليكم ${o.name || ''}، بخصوص ${u.title}`)} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center"><MessageCircle size={14} /></a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {f && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center" onClick={() => !busy && setF(null)}>
          <div className="bg-slate-900 border border-white/15 w-full md:max-w-xl max-h-[94dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-display font-black">{f.id ? 'تعديل جهاز' : 'جهاز جديد'}</h2><button onClick={() => setF(null)} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><X size={16} /></button></div>
            <input className={inp} placeholder="عنوان الجهاز (مثال: سبليت 18000 وحدة LG)" value={f.title} onChange={(e) => set('title', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => <button key={k.id} onClick={() => set('kind', k.id)} className={`py-2.5 rounded-xl text-sm font-black border-2 ${f.kind === k.id ? 'bg-sky-600 border-sky-300' : 'bg-white/5 border-white/20'}`}>{k.icon} {k.label}</button>)}
            </div>
            <p className="text-xs font-black text-white/80">حالة الجهاز</p>
            <div className="grid grid-cols-3 gap-2">
              {CONDITIONS.map((c) => <button key={c.id} onClick={() => set('condition', c.id)} className="py-2.5 rounded-xl text-xs font-black border-2" style={{ background: f.condition === c.id ? c.bg : 'transparent', borderColor: f.condition === c.id ? c.ring : 'rgba(255,255,255,.25)' }}>{c.label}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} placeholder="الماركة" value={f.brand} onChange={(e) => set('brand', e.target.value)} />
              <input className={inp} placeholder="السعة (مثال: 18000 وحدة / 1.5 طن)" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} />
              <input className={inp} placeholder="العمر (مثال: 3 سنوات)" value={f.age} onChange={(e) => set('age', e.target.value)} />
              <input className={inp} placeholder="الضمان (مثال: 30 يوم)" value={f.warranty} onChange={(e) => set('warranty', e.target.value)} />
            </div>
            <textarea className={inp} rows={2} placeholder="الشكل والحالة (تفاصيل المظهر والأداء)" value={f.appearance} onChange={(e) => set('appearance', e.target.value)} />
            <textarea className={inp} rows={2} placeholder="ملاحظات/عيوب (اختياري — تظهر للعميل)" value={f.defects} onChange={(e) => set('defects', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-black text-sky-300">السعر المعروض (ر.س)<input className={`${inp} mt-1`} inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))} /></label>
              <label className="text-[11px] font-black text-amber-300">أقل سعر للتفاوض 🔒 (لا يراه العميل)<input className={`${inp} mt-1 !border-amber-400/60`} inputMode="numeric" value={f.floor} onChange={(e) => set('floor', e.target.value.replace(/[^\d]/g, ''))} /></label>
            </div>
            <p className="text-[10px] font-bold text-white/60 -mt-1">النظام يفاوض العميل تلقائياً بين السعر المعروض وأقل سعر. إن تركت الأقل فارغاً يُحسب 90% من السعر.</p>
            <p className="text-xs font-black text-white/80">الصور</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(f.photos || []).map((p, n) => (
                <div key={p + n} className="relative w-20 h-20 shrink-0"><img src={p} className="w-full h-full object-cover rounded-lg" />
                  <button onClick={() => set('photos', f.photos.filter((_, j) => j !== n))} className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center"><X size={12} /></button>
                  {n === 0 && <span className="absolute bottom-0 inset-x-0 text-[9px] font-black text-center bg-black/70 rounded-b-lg">الرئيسية</span>}
                </div>
              ))}
              <label className="w-20 h-20 shrink-0 rounded-lg border-2 border-dashed border-white/40 flex flex-col items-center justify-center text-[10px] font-black text-white/80 cursor-pointer"><ImagePlus size={20} />إضافة<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} /></label>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {STATUSES.map((s) => <button key={s.id} onClick={() => set('status', s.id)} className="py-2 rounded-lg text-[11px] font-black border-2" style={{ background: f.status === s.id ? s.bg : 'transparent', borderColor: f.status === s.id ? '#fff' : 'rgba(255,255,255,.25)' }}>{s.label}</button>)}
            </div>
            {err && <p className="text-rose-300 text-xs font-black">{err}</p>}
            <button onClick={save} disabled={busy} className="bg-emerald-600 text-white font-display font-black rounded-2xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl">{busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}حفظ الجهاز</button>
          </div>
        </div>
      )}
    </div>
  )
}
