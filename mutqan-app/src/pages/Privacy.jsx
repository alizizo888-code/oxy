import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Mic, Fingerprint, Trash2, Loader2, Clock, Lock, Eye } from 'lucide-react'
import { db } from '../lib/db'
import { useAiSettings } from '../hooks/useAiSettings'

const VOICE_CONSENT_KEY = 'mutqan_voice_consent'

export default function Privacy() {
  const navigate = useNavigate()
  const { settings } = useAiSettings()
  const [consentAt, setConsentAt] = useState(() => localStorage.getItem(VOICE_CONSENT_KEY))
  const [count, setCount] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')
  const days = settings.privacy.retentionDays

  useEffect(() => { db.count('ai_messages').then(setCount).catch(() => setCount(null)) }, [])

  function withdraw() {
    localStorage.removeItem(VOICE_CONSENT_KEY)
    setConsentAt(null)
    db.insert('consents', { type: 'voice', withdrawn: true, at: new Date().toISOString() }).catch(() => {})
    setMsg('تم سحب الموافقة على الرسائل الصوتية.')
  }

  // Deletes ONLY this user's own conversation rows — on an explicit, confirmed tap.
  async function deleteMine() {
    if (!confirm('حذف كل محادثاتك مع MUTQAN AI نهائيًا؟ لا يمكن التراجع.')) return
    setDeleting(true); setMsg('')
    try {
      let rows = await db.select('ai_messages', {}, { limit: 500 })
      while (rows.length) {
        for (const r of rows) await db.delete('ai_messages', r.id)
        rows = rows.length === 500 ? await db.select('ai_messages', {}, { limit: 500 }) : []
      }
      localStorage.removeItem('mutqan_ai_draft')
      setCount(0)
      setMsg('تم حذف محادثاتك.')
    } catch {
      setMsg('تعذر إكمال الحذف، حاول مرة أخرى.')
    } finally { setDeleting(false) }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#eff7f5]" dir="rtl">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto w-full px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center"><ChevronRight size={18} className="text-slate-600" /></button>
          <h1 className="font-display text-base font-black text-slate-900">الخصوصية وبياناتك</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-5 pb-16 flex flex-col gap-3">
        <section className="rounded-3xl bg-gradient-to-l from-sky-500 to-blue-600 text-white p-5 shadow-lg shadow-sky-200 fade-up">
          <ShieldCheck size={26} className="mb-2" />
          <p className="font-display font-black text-lg">بياناتك محمية</p>
          <p className="text-[12px] text-white/85 leading-relaxed mt-1">صوتك وبياناتك الشخصية تُعامل كبيانات حساسة، ولا تُستخدم إلا لتقديم الخدمة التي طلبتها.</p>
        </section>

        {settings.privacy.notice?.trim() && (
          <Block icon={Eye} title="إشعار الخصوصية">
            <p className="whitespace-pre-line">{settings.privacy.notice}</p>
          </Block>
        )}

        <Block icon={Mic} title="الرسائل الصوتية">
          <p>تُحوَّل رسالتك الصوتية إلى نص لفهم طلبك فقط، ولا تُستخدم لتدريب أو تسويق أو أي غرض غير مصرّح به.</p>
          <p className="mt-1.5 font-bold text-slate-700">الحالة: {consentAt ? `موافق منذ ${new Date(consentAt).toLocaleDateString('ar')}` : 'لم تتم الموافقة'}</p>
          {consentAt && <button onClick={withdraw} className="mt-2 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-lg px-3 py-1.5">سحب الموافقة</button>}
        </Block>

        <Block icon={Clock} title="مدة الاحتفاظ">
          <p>محادثاتك مع المساعد وتسجيلاتها تُحذف تلقائيًا بعد <b>{days}</b> يومًا من إرسالها.</p>
        </Block>

        <Block icon={Fingerprint} title="البصمة والسمات الحيوية">
          <p>مُتقن لا يخزن صورة بصمة ولا صورة وجه ولا أي قالب حيوي. التحقق يتم على جهازك بواسطة نظام التشغيل (Passkeys)، ونحفظ فقط بيانات الاعتماد اللازمة للمصادقة.</p>
        </Block>

        <Block icon={Lock} title="من يصل إلى بياناتك">
          <p>أنت ترى محادثاتك وطلباتك فقط. الإدارة ترى ما يلزم لتنفيذ الخدمة، ويُسجَّل كل تغيير في إعدادات الذكاء الاصطناعي في سجل تدقيق. لا يُكشف لك ولا لغيرك رقم أو موقع دقيق لفني أو عميل آخر.</p>
        </Block>

        <Block icon={Trash2} title="حذف بياناتك">
          <p>عدد رسائلك المحفوظة مع المساعد: <b>{count ?? '—'}</b></p>
          <button onClick={deleteMine} disabled={deleting || count === 0} className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-500 text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-50">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} حذف محادثاتي مع MUTQAN AI
          </button>
          <p className="text-[10px] text-slate-400 mt-1.5">لحذف حسابك بالكامل استخدم «حسابي» ← إعدادات الحساب.</p>
        </Block>

        {msg && <p className="text-center text-xs font-bold text-sky-700">{msg}</p>}
      </main>
    </div>
  )
}

function Block({ icon: Icon, title, children }) {
  return (
    <section className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm fade-up text-[12px] text-slate-600 leading-relaxed">
      <p className="font-display font-black text-slate-900 text-sm mb-1.5 flex items-center gap-1.5"><Icon size={15} className="text-primary" /> {title}</p>
      {children}
    </section>
  )
}
