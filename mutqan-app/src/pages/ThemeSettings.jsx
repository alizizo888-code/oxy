import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Moon, Sun, Palette, Users } from 'lucide-react'
import { THEMES, THEME_IDS, applyPalette, useAppTheme } from '../lib/appTheme'
import { useTheme } from '../lib/theme'
import { useTeamRole } from '../hooks/useTeamRole'

// قوالب الألوان: معاينة فورية، ثم زر «تفعيل» لحفظ الاختيار. المالك/المشرف يقدر يعتمد قالباً افتراضياً للجميع.
export default function ThemeSettings({ staff = false }) {
  const nav = useNavigate()
  const { role } = useTeamRole()
  const { active, mine, shared, choose, setShared } = useAppTheme()
  const [dark, toggleDark] = useTheme()
  const [pick, setPick] = useState(active)
  const [msg, setMsg] = useState('')
  const canShare = ['owner', 'operations', 'supervisor'].includes(role)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const preview = (id) => { setPick(id); applyPalette(id) }
  const activate = () => { choose(pick === shared ? '' : pick); applyPalette(pick); flash('تم تفعيل القالب ✓') }
  const cancel = () => { setPick(active); applyPalette(active) }
  const makeDefault = async () => { try { await setShared(pick); choose(''); flash('تم اعتماد القالب للجميع ✓') } catch { flash('تعذّر الاعتماد — تحقق من الصلاحية') } }
  const dirty = pick !== active
  const card = staff ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-sky-100 text-slate-800'
  return (
    <div dir="rtl" className={`min-h-screen ${staff ? 'text-slate-100' : 'text-slate-800'} p-4 pb-32 max-w-3xl mx-auto`}>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => nav(-1)} aria-label="رجوع" className="w-9 h-9 rounded-full border border-slate-300/40 flex items-center justify-center"><ArrowRight size={18} /></button>
        <h1 className="text-lg font-black flex items-center gap-2"><Palette size={20} className="text-primary" />قوالب المظهر</h1>
      </div>
      <p className="text-xs opacity-70 mb-4">اختر قالباً لمعاينته مباشرة، ثم اضغط «تفعيل القالب». القالب الحالي: <b>{THEMES[active]?.name}</b>{mine ? ' (اختيارك)' : ' (افتراضي التطبيق)'}.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEME_IDS.map((id) => {
          const t = THEMES[id]; const sel = pick === id
          const c = t.sky ? [t.sky[400], t.sky[600], t.blue[900]] : ['#3cc0b6', '#0e8f88', '#0f3d5e']
          return (
            <button key={id} onClick={() => preview(id)} data-keep-colors className={`relative rounded-2xl border-2 p-3 text-right transition-all active:scale-95 ${card} ${sel ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}>
              <div className="flex gap-1 mb-2">{c.map((x, i) => <span key={i} className="h-7 flex-1 rounded-lg" style={{ background: x }} />)}</div>
              <p className="font-black text-sm">{t.icon} {t.name}</p>
              <p className="text-[11px] opacity-60">{t.hint}</p>
              {id === active && <span className="absolute top-2 left-2 text-[10px] bg-emerald-500 text-white rounded-full px-2 py-0.5 font-bold">مفعّل</span>}
              {id === shared && id !== active && <span className="absolute top-2 left-2 text-[10px] bg-slate-500 text-white rounded-full px-2 py-0.5 font-bold">افتراضي</span>}
              {sel && <Check size={16} className="absolute bottom-2 left-2 text-primary" />}
            </button>
          )
        })}
      </div>
      {!staff && (
        <button onClick={toggleDark} className={`mt-4 w-full rounded-2xl border p-3 flex items-center gap-3 font-bold text-sm ${card}`}>
          {dark === 'dark' ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}<span className="flex-1 text-right">{dark === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
        </button>
      )}
      <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-black/30 to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-keep-colors>
        <div className="max-w-3xl mx-auto grid gap-2">
          {msg && <p className="text-center text-xs font-bold bg-emerald-600 text-white rounded-full py-1.5">{msg}</p>}
          <div className="flex gap-2">
            <button disabled={!dirty} onClick={activate} className="flex-1 rounded-full bg-primary text-white font-black py-3 disabled:opacity-40 active:scale-95 transition-transform">تفعيل القالب</button>
            {dirty && <button onClick={cancel} className="rounded-full bg-white/90 text-slate-700 font-bold px-5 border border-slate-300">إلغاء</button>}
          </div>
          {canShare && pick !== shared && (
            <button onClick={makeDefault} className="rounded-full bg-slate-800 text-white font-bold py-2.5 text-sm flex items-center justify-center gap-2 active:scale-95"><Users size={15} />اعتماد هذا القالب لجميع المستخدمين</button>
          )}
        </div>
      </div>
    </div>
  )
}
