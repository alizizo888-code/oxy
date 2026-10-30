import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageCircle, Sparkles, ShieldCheck, Clock } from 'lucide-react'
import { share } from '../../lib/share'
import { team } from '../../lib/team'
import { useSession } from '../../hooks/useSession'
import { useWaNumbers, WA_DEPARTMENTS, pickNumber } from '../../hooks/useWaNumbers'
import AiLogo from '../../components/AiLogo'

// Public contact & ordering page: MUTQAN AI (answers instantly, in-app) + every
// enabled WhatsApp number grouped by department.
export default function Contact() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { numbers, loading } = useWaNumbers()
  const gidRef = useRef(null)
  useEffect(() => { team.groupId().then((g) => { gidRef.current = g }).catch(() => {}) }, [])

  const depts = useMemo(
    () => WA_DEPARTMENTS.map((d) => ({ ...d, list: numbers.filter((n) => n.enabled && n.department === d.id) })).filter((d) => d.list.length),
    [numbers]
  )

  function open(dept) {
    const n = pickNumber(numbers, dept.id)
    if (!n) return
    const name = session?.name ? ` معك ${session.name}.` : ''
    share.whatsappOrder({
      phone: n.phone,
      text: (n.prefill || dept.prefill) + name,
      collection: 'wa_leads',
      groupId: gidRef.current || undefined,
      record: { numberId: n.id, numberLabel: n.label || '', phone: n.phone, department: dept.id, customerName: session?.name || '', customerPhone: session?.phone || '', at: new Date().toISOString() },
    })
  }

  return (
    <div className="h-full overflow-y-auto pb-24 bg-[#eff7f5]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#eff7f5]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center"><ChevronRight size={18} className="text-slate-600" /></button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-black text-slate-900">تواصل واطلب</h1>
            <p className="text-[11px] text-slate-500">اختار القناة المناسبة لك</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        <button onClick={() => navigate('/ai')} className="relative overflow-hidden text-right bg-gradient-to-l from-sky-500 via-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-xl shadow-sky-200 fade-up">
          <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black tracking-widest text-sky-100">رد فوري · 24 ساعة</p>
              <p className="font-display text-xl font-black mt-1">كلّم MUTQAN AI الآن</p>
              <p className="text-xs text-white/85 mt-1 leading-relaxed">يفهم مشكلتك بالكتابة أو بالصوت، يسجل بياناتك، يفحص ضمانك، ويفتح طلبك مباشرة.</p>
              <span className="inline-flex items-center gap-1.5 mt-3 bg-white text-blue-700 rounded-full px-4 py-2 text-xs font-black"><Sparkles size={13} /> ابدأ المحادثة</span>
            </div>
            <AiLogo size={76} className="drop-shadow-lg" />
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/warranty')} className="bg-white rounded-2xl border border-emerald-100 p-3.5 text-right shadow-sm">
            <ShieldCheck size={18} className="text-emerald-600" />
            <p className="font-display font-black text-sm text-slate-900 mt-1">ضماناتي</p>
            <p className="text-[10px] text-slate-500">المدة المتبقية وفتح ملف ضمان</p>
          </button>
          <button onClick={() => navigate('/new')} className="bg-white rounded-2xl border border-sky-100 p-3.5 text-right shadow-sm">
            <MessageCircle size={18} className="text-sky-600" />
            <p className="font-display font-black text-sm text-slate-900 mt-1">طلب مباشر</p>
            <p className="text-[10px] text-slate-500">نموذج طلب فني سريع</p>
          </button>
        </div>

        <section>
          <p className="text-xs font-black text-slate-500 mb-2">واتساب حسب القسم</p>
          {loading ? (
            <p className="text-center text-slate-400 text-xs py-6">جارِ التحميل…</p>
          ) : depts.length === 0 ? (
            <p className="bg-white rounded-2xl border border-sky-100 p-4 text-center text-xs text-slate-500">أرقام الواتساب لم تُضف بعد — استخدم MUTQAN AI أو الطلب المباشر.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {depts.map((d, i) => (
                <button key={d.id} onClick={() => open(d)} className="flex items-center gap-3 bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-right fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-xl shrink-0">{d.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black text-slate-900 text-sm">{d.label}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      {d.list.length > 1 ? `${d.list.length} موظفين متاحين` : d.list[0].label || 'واتساب'}
                      {d.list[0].hours ? <><Clock size={9} className="mr-1" /> {d.list[0].hours}</> : null}
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 bg-emerald-500 text-white rounded-full px-3 py-1.5 text-[11px] font-bold"><MessageCircle size={12} /> واتساب</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
