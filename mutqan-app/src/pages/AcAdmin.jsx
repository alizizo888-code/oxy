import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Save, Plus, Trash2, Loader2, Check, ImagePlus } from 'lucide-react'
import { useTeamRole } from '../hooks/useTeamRole'
import { useAcConfig } from '../hooks/useAcConfig'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { storage } from '../lib/storage'
import { DEFAULT_AC, AC_TYPES, normalizeAc } from '../acPricing'
import { SPECIALTIES } from '../constants'
import { PROMO_LABELS } from '../lib/promoArt'

const inp = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary'
const FIELDS = [
  ['split1', 'سبليت ×1'], ['split2', 'سبليت ×2'], ['split3', 'سبليت ×3'], ['win1', 'شباك ×1'], ['win2', 'شباك ×2'], ['win3', 'شباك ×3'],
  ['winExtra', 'شباك: كل وحدة بعد 3'], ['other1', 'باقي الأنواع (للوحدة)'], ['innerOff1', 'خصم داخلي فقط ×1'], ['innerOff2', 'خصم داخلي فقط ×2'], ['innerOff3', 'خصم داخلي فقط ×3'],
  ['w1', 'ضمان شهر (للوحدة)'], ['w2', 'ضمان شهرين (للوحدة)'], ['w3', 'ضمان 3 شهور (للوحدة)'], ['vatPct', 'الضريبة %'], ['visitFee', 'كشفية الزيارة'], ['maxDiscountPct', 'أقصى خصم تفاوض %'],
]

export default function AcAdmin() {
  const navigate = useNavigate()
  const { role, isOwner, loading } = useTeamRole()
  const { cfg, offers, media, saveCfg } = useAcConfig()
  const [f, setF] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setF(cfg) }, [JSON.stringify(cfg)]) // eslint-disable-line

  if (loading || !f) return <div className="h-full flex items-center justify-center text-slate-400">جارِ التحميل…</div>
  if (!(isOwner || role === 'operations')) return <div className="h-full flex items-center justify-center text-slate-400">للمالك ومشرف العمليات فقط</div>

  const save = async () => {
    setBusy(true); setErr('')
    try { await saveCfg(f); setSaved(true) } catch (e) { setErr('تعذر الحفظ') }
    setBusy(false)
  }
  const gid = () => team.groupId()
  const addOffer = async () => {
    await db.insertShared('offers', { title: 'عرض جديد', acMode: 'wash', acType: 'سبليت', qty: 3, price: 200, badge: '', warranty: '15 يوم', active: true, sort: offers.length + 1, specialtyId: 'ac', image: '' }, undefined, { groupId: await gid(), writableBy: 'admins' })
  }
  const addDefaults = async () => {
    const g = await gid()
    const base = { acMode: 'wash', acType: 'سبليت', active: true, specialtyId: 'ac', image: '' }
    await db.insertShared('offers', { ...base, title: 'غسيل 3 مكيفات سبليت', qty: 3, price: 200, badge: '🔥 العرض الأكثر طلباً', warranty: '15 يوم', sort: 1 }, undefined, { groupId: g, writableBy: 'admins' })
    await db.insertShared('offers', { ...base, title: 'غسيل 6 مكيفات سبليت', qty: 6, price: 380, badge: '', warranty: '15 يوم', sort: 2 }, undefined, { groupId: g, writableBy: 'admins' })
  }
  const updOffer = (id, patch) => db.updateShared('offers', id, patch)
  const [mSpec, setMSpec] = useState('ac')
  const [urlsText, setUrlsText] = useState('')
  const addMedia = async (files) => {
    const list = Array.from(files || [])
    if (!list.length) return
    setBusy(true)
    try {
      const g = await gid()
      for (const file of list) {
        const { url } = await storage.upload(file)
        await db.insertShared('ac_media', { url, title: '', category: 'wash', specialty: mSpec, sort: media.length + 1 }, undefined, { groupId: g, writableBy: 'admins' })
      }
    } catch { setErr('تعذر رفع الصورة') }
    setBusy(false)
  }
  const addUrls = async () => {
    const urls = urlsText.split(/\s+/).filter((u) => /^https:\/\//i.test(u))
    if (!urls.length) return setErr('الصق روابط صور تبدأ بـ https://')
    setBusy(true)
    try {
      const g = await gid()
      for (const url of urls) await db.insertShared('ac_media', { url, title: '', category: 'wash', specialty: mSpec, sort: media.length + 1 }, undefined, { groupId: g, writableBy: 'admins' })
      setUrlsText('')
    } catch { setErr('تعذر حفظ الروابط') }
    setBusy(false)
  }
  const upOfferImg = async (id, file) => {
    if (!file) return
    try { const { url } = await storage.upload(file); await updOffer(id, { image: url }) } catch { setErr('تعذر رفع الصورة') }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-white pb-24" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button>
        <h1 className="font-display font-black">أسعار وعروض المكيفات</h1>
      </header>
      <div className="max-w-2xl mx-auto px-4 pt-5 flex flex-col gap-6">
        <section>
          <h2 className="text-sm font-black mb-2">جدول الأسعار (ر.س)</h2>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(([k, l]) => (
              <label key={k} className="text-[11px] text-slate-400">{l}
                <input type="number" min="0" value={f[k]} onChange={(e) => { setSaved(false); setF({ ...f, [k]: e.target.value }) }} className={`${inp} mt-1`} />
              </label>
            ))}
          </div>
          <label className="block text-[11px] text-slate-400 mt-4">رقم واتساب الاستقبال (بصيغة دولية بدون +)
            <input dir="ltr" value={f.waNumber} onChange={(e) => { setSaved(false); setF({ ...f, waNumber: e.target.value }) }} className={`${inp} mt-1`} />
          </label>
          <h3 className="text-xs font-black mt-4 mb-2">أسعار التركيب (0 = يُحدَّد بعد المعاينة)</h3>
          <div className="grid grid-cols-2 gap-2">
            {AC_TYPES.install.map((t) => (
              <label key={t.v} className="text-[11px] text-slate-400">{t.l}
                <input type="number" min="0" value={f.installPrices[t.v]} onChange={(e) => { setSaved(false); setF({ ...f, installPrices: { ...f.installPrices, [t.v]: e.target.value } }) }} className={`${inp} mt-1`} />
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={busy} className="flex-1 bg-primary rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2">{busy ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />} حفظ الأسعار</button>
            <button onClick={() => { setF(normalizeAc(DEFAULT_AC)); setSaved(false) }} className="px-4 rounded-xl bg-white/10 text-xs font-bold">القيم الافتراضية</button>
          </div>
          {err && <p className="text-rose-400 text-xs mt-2">{err}</p>}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-black">العروض</h2>
            {offers.length === 0 && <button onClick={addDefaults} className="text-xs font-bold bg-amber-500/20 text-amber-300 rounded-lg px-3 py-1.5">العروض الافتراضية</button>}
            <button onClick={addOffer} className="text-xs font-bold bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1"><Plus size={13} /> عرض</button>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">العرض يُطبَّق تلقائياً عندما يطابق العميل (النوع + العدد) — وسعره هو الأساس بدل الجدول.</p>
          <div className="flex flex-col gap-3">
            {offers.map((o) => (
              <div key={o.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
                <input defaultValue={o.title} onBlur={(e) => updOffer(o.id, { title: e.target.value })} className={inp} placeholder="عنوان العرض" />
                <div className="grid grid-cols-3 gap-2">
                  <select defaultValue={o.acMode} onChange={(e) => updOffer(o.id, { acMode: e.target.value })} className={inp}>
                    <option value="wash">غسيل</option><option value="install">تركيب</option>
                  </select>
                  <select defaultValue={o.acType || 'سبليت'} onChange={(e) => updOffer(o.id, { acType: e.target.value })} className={inp}>
                    {AC_TYPES.wash.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" defaultValue={o.qty} onBlur={(e) => updOffer(o.id, { qty: Number(e.target.value) || 1 })} className={inp} placeholder="العدد" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" defaultValue={o.price} onBlur={(e) => updOffer(o.id, { price: Number(e.target.value) || 0 })} className={inp} placeholder="سعر العرض" />
                  <input defaultValue={o.badge} onBlur={(e) => updOffer(o.id, { badge: e.target.value })} className={inp} placeholder="شارة (مثال: الأكثر طلباً)" />
                </div>
                <input defaultValue={o.warranty} onBlur={(e) => updOffer(o.id, { warranty: e.target.value })} className={inp} placeholder="الضمان (مثال: 15 يوم)" />
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] flex items-center gap-1.5"><input type="checkbox" defaultChecked={o.active !== false} onChange={(e) => updOffer(o.id, { active: e.target.checked })} /> مفعّل</label>
                  <label className="text-[11px] flex items-center gap-1 cursor-pointer bg-white/10 rounded-lg px-2 py-1"><ImagePlus size={13} /> {o.image ? 'تغيير الصورة' : 'صورة'}<input type="file" accept="image/*" hidden onChange={(e) => upOfferImg(o.id, e.target.files[0])} /></label>
                  <button onClick={() => db.deleteShared('offers', o.id)} className="text-rose-400 p-1"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-black">مكتبة الصور (كل الخدمات)</h2>
            <label className="text-xs font-bold bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1 cursor-pointer"><ImagePlus size={13} /> رفع عدة صور<input type="file" accept="image/*" multiple hidden onChange={(e) => addMedia(e.target.files)} /></label>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-3 flex flex-col gap-2">
            <p className="text-[11px] text-white/60">اختر الخدمة التي تُضاف لها الصور؛ تظهر تلقائيًا في بانر الرئيسية ومعرض الخدمة.</p>
            <select value={mSpec} onChange={(e) => setMSpec(e.target.value)} className={inp}>
              {SPECIALTIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              {Object.entries(PROMO_LABELS).map(([k, l]) => <option key={k} value={`promo_${k}`}>بانر العروض — {l}</option>)}
            </select>
            <textarea value={urlsText} onChange={(e) => setUrlsText(e.target.value)} rows={2} placeholder="أو الصق روابط صور (https://…) واحد في كل سطر" className={`${inp} resize-none`} dir="ltr" />
            <button onClick={addUrls} disabled={busy} className="bg-sky-500 text-white font-black rounded-xl py-2 text-xs disabled:opacity-50">إضافة الروابط للخدمة</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {media.map((m) => (
              <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <img src={m.url} alt="" className="h-24 w-full object-cover" />
                <p className="px-2 pt-1 text-[10px] text-sky-300 font-bold">{SPECIALTIES.find((x) => x.id === (m.specialty || 'ac'))?.label || PROMO_LABELS[String(m.specialty).replace('promo_', '')] || m.specialty}</p>
                <div className="p-2 flex flex-col gap-1.5">
                  <input defaultValue={m.title} onBlur={(e) => db.updateShared('ac_media', m.id, { title: e.target.value })} className={inp} placeholder="وصف" />
                  <div className="flex gap-1.5">
                    <select defaultValue={m.category} onChange={(e) => db.updateShared('ac_media', m.id, { category: e.target.value })} className={`${inp} flex-1`}>
                      <option value="wash">غسيل</option><option value="install">تركيب</option><option value="maintenance">صيانة</option>
                    </select>
                    <button onClick={() => db.deleteShared('ac_media', m.id)} className="text-rose-400 px-1"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
