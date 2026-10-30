import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { team } from '../lib/team'
import { validVat } from '../lib/zatca'
import { SPECIALTIES } from '../constants'
import { useAdLanding } from '../lib/adLanding'
import { useTeamRole } from '../hooks/useTeamRole'
import { useContact } from '../hooks/useContact'

const inp = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary'

// إعدادات المنشأة (المالك فقط): الاسم والرقم الضريبي والعنوان — تظهر على الفاتورة الضريبية وفي رمز QR.
export default function BusinessSettings() {
  const nav = useNavigate()
  const { isOwner, loading } = useTeamRole()
  const { data } = useLiveShared('pricing', { limit: 100 })
  const info = useMemo(() => (data || []).find((r) => (r.serviceId || r.id) === 'tax_info') || {}, [data])
  const [f, setF] = useState({ seller: '', vat: '', address: '' })
  const ad = useAdLanding()
  const cur = useContact()
  const [c, setC] = useState({ wa: '', phone: '' })
  const [cm, setCm] = useState('')
  useEffect(() => { setC({ wa: cur.wa, phone: cur.phone }) }, [cur.wa, cur.phone])
  const saveContact = async () => {
    setCm('')
    const wa = c.wa.replace(/\D/g, ''), phone = c.phone.replace(/[^\d+]/g, '')
    if (wa && wa.length < 9) return setCm('رقم الواتساب غير صحيح')
    try { const gid = await team.groupId(); await db.upsertShared('pricing', { serviceId: 'contact_numbers', whatsapp: wa, phone, updatedAt: new Date().toISOString() }, 'contact_numbers', { groupId: gid, writableBy: 'admins' }); setCm('تم الحفظ ✓ — يُطبَّق في الرئيسية والتوزيع والتوجيهات والمقالات') } catch { setCm('تعذر الحفظ') }
  }
  const [copied, setCopied] = useState('')
  const setAd = async (on) => { const gid = await team.groupId(); await db.upsertShared('pricing', { serviceId: 'ad_landing', enabled: !!on, updatedAt: new Date().toISOString() }, 'ad_landing', { groupId: gid, writableBy: 'admins' }) }
  const base = typeof location !== 'undefined' ? location.origin + location.pathname : ''
  const copy = (u) => { try { navigator.clipboard.writeText(u) } catch { /* ignore */ } setCopied(u); setTimeout(() => setCopied(''), 1800) }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { setF({ seller: info.seller || '', vat: info.vat || '', address: info.address || '' }) }, [info.seller, info.vat, info.address])
  if (loading) return <p className="p-6 text-slate-400 text-sm" dir="rtl">جارِ التحقق…</p>
  if (!isOwner) return <p className="p-6 text-white text-sm font-bold" dir="rtl">إعدادات المنشأة للمالك فقط.</p>
  const save = async () => {
    setMsg('')
    if (!f.seller.trim()) return setMsg('اكتب اسم المنشأة')
    if (!validVat(f.vat)) return setMsg('الرقم الضريبي 15 رقمًا يبدأ وينتهي بالرقم 3')
    setBusy(true)
    try {
      const gid = await team.groupId()
      await db.upsertShared('pricing', { serviceId: 'tax_info', seller: f.seller.trim(), vat: f.vat.replace(/\s/g, ''), address: f.address.trim(), updatedAt: new Date().toISOString() }, 'tax_info', { groupId: gid, writableBy: 'admins' })
      setMsg('تم الحفظ ✓')
    } catch { setMsg('تعذر الحفظ') } finally { setBusy(false) }
  }
  return (
    <div className="h-full overflow-y-auto pb-24 text-white" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><ChevronRight size={18} /></button>
        <div className="flex-1"><h1 className="font-display font-black text-base">إعدادات المنشأة والفاتورة</h1><p className="text-[11px] text-white/60">البيانات الضريبية التي تُطبع على الفاتورة ورمز QR</p></div>
      </header>
      <div className="p-4 max-w-xl mx-auto grid gap-3">
        <label className="grid gap-1 text-xs font-bold text-slate-300">اسم المنشأة (كما في الشهادة الضريبية)<input className={inp} value={f.seller} onChange={(e) => setF({ ...f, seller: e.target.value })} /></label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">الرقم الضريبي (15 رقمًا)<input className={inp} dir="ltr" inputMode="numeric" value={f.vat} onChange={(e) => setF({ ...f, vat: e.target.value })} placeholder="3xxxxxxxxxxxxx3" /></label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">العنوان (اختياري)<input className={inp} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        <button onClick={save} disabled={busy} className="rounded-xl bg-emerald-500 text-black font-black py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}حفظ</button>
        {msg && <p className="text-xs font-bold text-amber-300">{msg}</p>}
        <section className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 grid gap-2">
          <p className="font-black text-sm">📞 أرقام التواصل (تفعّل أزرار الواتساب والاتصال في كل الموقع)</p>
          <label className="grid gap-1 text-xs font-bold text-slate-300">رقم الواتساب (بالصيغة الدولية، مثال 9665xxxxxxxx)<input className={inp} dir="ltr" inputMode="tel" value={c.wa} onChange={(e) => setC({ ...c, wa: e.target.value })} /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">رقم الهاتف للاتصال<input className={inp} dir="ltr" inputMode="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
          <button onClick={saveContact} className="rounded-xl bg-emerald-500 text-black font-black py-2.5 text-sm">حفظ الأرقام</button>
          {cm && <p className="text-xs font-bold text-amber-300">{cm}</p>}
          <p className="text-[11px] text-slate-500">الأزرار تظهر فقط عند وجود الرقم، وزر الطلب والرئيسية يظهران دائمًا.</p>
        </section>
        <section className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 grid gap-2">
          <p className="font-black text-sm">📣 روابط الإعلانات الممولة (تجربة)</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">كل تخصص له رابط خاص للإعلان. عند الفتح يدخل العميل الرئيسية أولًا ثم ينتقل تلقائيًا لصفحة التخصص، وفي صفحة التخصص زر «الرئيسية» ثابت بالأسفل.</p>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={ad.enabled} onChange={(e) => setAd(e.target.checked)} /> تفعيل الدخول عبر الرئيسية أولًا {ad.enabled ? '' : '(متوقف: الرابط يفتح التخصص مباشرة)'}</label>
          <div className="grid gap-1.5 max-h-72 overflow-y-auto">
            {SPECIALTIES.map((sp) => { const u = `${base}#/s/${sp.id}`; return (
              <button key={sp.id} onClick={() => copy(u)} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-right text-xs">
                <span>{sp.icon}</span><span className="font-bold">{sp.label}</span><span className="mr-auto text-[10px] text-slate-500 truncate max-w-[55%]" dir="ltr">{u}</span><span className="text-sky-300">{copied === u ? 'نُسخ ✓' : 'نسخ'}</span>
              </button>) })}
          </div>
        </section>
        <p className="text-[11px] text-slate-500 leading-relaxed">يُستخدم في الفاتورة الضريبية المبسّطة (رمز QR المرحلة الأولى). الاعتماد الإلكتروني للمرحلة الثانية غير مفعّل.</p>
      </div>
    </div>
  )
}
