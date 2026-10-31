import { errText } from '../lib/_api'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, BellRing, Loader2 } from 'lucide-react'
import { useNotifySettings } from '../hooks/useNotifySettings'
import { useTeamRole } from '../hooks/useTeamRole'
import { NOTIFY_EVENTS, HIGH_EVENT_LABELS } from '../notify'
import { TONES, playTone, chime } from '../lib/alert'
import { Play, Volume2 } from 'lucide-react'

// Owner + operations supervisor: switch each notification on/off per recipient,
// and set the distance alerts + "nearby" radius.
const WHO = [
  { k: 'client', l: 'العميل' },
  { k: 'tech', l: 'الفني' },
  { k: 'ops', l: 'العمليات' },
]

export default function NotifySettings() {
  const navigate = useNavigate()
  const { loading: roleLoading, role, isOwner } = useTeamRole()
  const { settings: S, update } = useNotifySettings()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [milestones, setMilestones] = useState(null)
  const canEdit = isOwner || role === 'operations'

  async function save(patch) {
    setSaving(true); setErr('')
    try { await update(patch) } catch (e) { setErr(errText(e, 'تعذر الحفظ — هذه الإعدادات للمالك ومشرف العمليات فقط')) } finally { setSaving(false) }
  }
  const setEvent = (id, patch) => save({ events: { ...S.events, [id]: { ...S.events[id], ...patch } } })

  if (roleLoading) return <div className="h-full flex items-center justify-center bg-[#090c14]"><Loader2 className="animate-spin text-primary" /></div>
  if (!canEdit) return <div className="h-full flex items-center justify-center bg-[#090c14] text-slate-400 text-sm" dir="rtl">هذه الصفحة للمالك ومشرف العمليات فقط</div>

  const msText = milestones ?? S.distanceMilestonesKm.join('، ')

  return (
    <div className="h-full overflow-y-auto pb-16 bg-[#090c14]" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#090c14]/90 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><ChevronRight size={18} className="text-slate-300" /></button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-black text-white flex items-center gap-2"><BellRing size={18} className="text-primary" /> نظام الإشعارات</h1>
            <p className="text-[11px] text-slate-500">كل إشعار يُرسل فقط عند حدث فعلي في الطلب</p>
          </div>
          {saving && <Loader2 size={16} className="animate-spin text-primary" />}
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 pt-5 flex flex-col gap-4">
        {err && <p className="text-rose-400 text-xs font-bold">{err}</p>}

        {isOwner && <SoundPanel sound={S.sound} save={(patch) => save({ sound: { ...S.sound, ...patch } })} />}

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-white font-bold text-sm">تشغيل نظام الإشعارات</p>
            <p className="text-[11px] text-slate-500">عند الإيقاف لا يُرسل أي إشعار من الإشعارات أدناه</p>
          </div>
          <Switch on={S.enabled} onChange={(v) => save({ enabled: v })} />
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-white font-bold text-sm">المسافة والقرب</p>
          <label className="text-[11px] text-slate-400">نطاق «الفني قريب من العميل» (متر)</label>
          <input type="number" defaultValue={S.nearbyMeters} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== S.nearbyMeters) save({ nearbyMeters: v }) }} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
          <label className="text-[11px] text-slate-400">تنبيهات المسافة (كم) — مفصولة بفاصلة، مثال: 3، 1، 0.5</label>
          <input
            value={msText}
            onChange={(e) => setMilestones(e.target.value)}
            onBlur={() => {
              const arr = String(msText).split(/[،,\s]+/).map(Number).filter((n) => n > 0)
              if (arr.length) save({ distanceMilestonesKm: [...new Set(arr)].sort((a, b) => b - a) })
              setMilestones(null)
            }}
            dir="ltr"
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white text-right"
          />
          <p className="text-[10px] text-slate-500 leading-relaxed">المسافة تُحسب من الموقع الفعلي لجهاز الفني أثناء فتحه لشاشة المهمة وهو «في الطريق». لا يوجد تقدير لوقت الوصول.</p>
          <label className="text-[11px] text-slate-400">مدة حفظ الإشعارات في السجل (يوم)</label>
          <input type="number" defaultValue={S.keepDays} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== S.keepDays) save({ keepDays: v }) }} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
        </div>

        <div className="flex flex-col gap-2">
          {NOTIFY_EVENTS.map((e) => {
            const c = S.events[e.id]
            return (
              <div key={e.id} className={`bg-white/[0.04] border rounded-2xl p-3.5 ${c.enabled ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{e.label}</p>
                    <p className="text-[10px] text-slate-500">{e.sub}</p>
                  </div>
                  <Switch on={c.enabled} onChange={(v) => setEvent(e.id, { enabled: v })} />
                </div>
                {c.enabled && (
                  <div className="flex gap-1.5 mt-2.5">
                    {WHO.filter((w) => e.to[w.k] !== undefined).map((w) => (
                      <button key={w.k} onClick={() => setEvent(e.id, { [w.k]: !c[w.k] })} className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold border ${c[w.k] ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                        {c[w.k] ? '✓ ' : ''}{w.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed pb-4">
          إشعارات الجوال تصل لمن فعّلها على التطبيق المنشور (المثبّت على الشاشة الرئيسية في الآيفون). العميل الزائر بدون حساب لا تصله إشعارات. وتبقى كل الإشعارات محفوظة في صفحة «الإشعارات» داخل التطبيق.
        </p>
      </div>
    </div>
  )
}

function Switch({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${on ? 'bg-primary' : 'bg-white/15'}`} aria-pressed={on}>
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${on ? 'right-1' : 'right-6'}`} />
    </button>
  )
}

// Owner-only: ringtone, volume, repeat, vibration, banner time, quiet hours and which events ring as high priority.
function SoundPanel({ sound: s, save }) {
  const [vol, setVol] = useState(null)
  const Tone = ({ field, title }) => (
    <div>
      <p className="text-[11px] font-bold text-slate-400 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(TONES).map(([id, t]) => (
          <span key={id} className={`inline-flex items-center rounded-full border text-[11px] font-bold overflow-hidden ${s[field] === id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-300'}`}>
            <button onClick={() => save({ [field]: id })} className="px-3 py-1.5">{t.label}</button>
            <button onClick={() => playTone(id, { volume: s.volume, repeat: field === 'highTone' ? 1 : 1 })} className="px-2 py-1.5 border-r border-white/10" aria-label="تجربة"><Play size={11} /></button>
          </span>
        ))}
      </div>
    </div>
  )
  const events = Object.keys(HIGH_EVENT_LABELS)
  return (
    <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Volume2 size={18} className="text-primary" />
        <div className="flex-1"><p className="text-white font-bold text-sm">الصوت والرنين</p><p className="text-[11px] text-slate-500">ينطبق على كل أجهزة الفريق</p></div>
        <Switch on={s.enabled} onChange={(v) => save({ enabled: v })} />
      </div>
      <Tone field="normalTone" title="نغمة الإشعارات العادية" />
      <Tone field="highTone" title="نغمة الأولوية العالية (طلب جديد…)" />
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-400">مستوى الصوت: {Math.round((vol ?? s.volume) * 100)}%
          <input type="range" min="0" max="1" step="0.05" value={vol ?? s.volume} onChange={(e) => setVol(Number(e.target.value))} onPointerUp={() => { save({ volume: vol ?? s.volume }); setVol(null) }} onKeyUp={() => { save({ volume: vol ?? s.volume }); setVol(null) }} className="accent-emerald-500" />
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-400">تكرار نغمة الأولوية العالية: {s.highRepeat} مرات
          <input type="range" min="1" max="5" step="1" value={s.highRepeat} onChange={(e) => save({ highRepeat: Number(e.target.value) })} className="accent-emerald-500" />
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-400">مدة ظهور الإشعار العادي: {s.bannerSecs} ثانية
          <input type="range" min="3" max="20" step="1" value={s.bannerSecs} onChange={(e) => save({ bannerSecs: Number(e.target.value) })} className="accent-emerald-500" />
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-400">مدة ظهور إشعار الأولوية العالية: {s.highBannerSecs} ثانية
          <input type="range" min="5" max="60" step="1" value={s.highBannerSecs} onChange={(e) => save({ highBannerSecs: Number(e.target.value) })} className="accent-emerald-500" />
        </label>
      </div>
      <div className="flex items-center gap-3"><p className="flex-1 text-sm text-white font-bold">الاهتزاز</p><Switch on={s.vibrate} onChange={(v) => save({ vibrate: v })} /></div>
      <div className="rounded-xl bg-black/20 p-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-3"><div className="flex-1"><p className="text-sm text-white font-bold">ساعات الهدوء</p><p className="text-[11px] text-slate-500">بدون صوت أو اهتزاز — يبقى الإشعار ظاهرًا</p></div><Switch on={s.quiet.on} onChange={(v) => save({ quiet: { ...s.quiet, on: v } })} /></div>
        {s.quiet.on && <div className="flex items-center gap-2 text-xs text-slate-300">من <input type="time" value={s.quiet.from} onChange={(e) => save({ quiet: { ...s.quiet, from: e.target.value } })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white" /> إلى <input type="time" value={s.quiet.to} onChange={(e) => save({ quiet: { ...s.quiet, to: e.target.value } })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white" /></div>}
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 mb-1.5">الأحداث ذات الأولوية العالية (نغمة أعلى، تكرار، وتبقى على الشاشة)</p>
        <div className="flex flex-wrap gap-1.5">
          {events.map((id) => <button key={id} onClick={() => save({ highEvents: { ...s.highEvents, [id]: !s.highEvents[id] } })} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${s.highEvents[id] ? 'bg-rose-500/20 border-rose-400 text-rose-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{HIGH_EVENT_LABELS[id]}</button>)}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => chime('normal', s)} className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 text-xs font-bold text-slate-200">تجربة إشعار عادي</button>
        <button onClick={() => chime('high', s)} className="flex-1 bg-rose-500/20 border border-rose-400/40 rounded-xl py-2.5 text-xs font-bold text-rose-100">تجربة إشعار أولوية</button>
      </div>
    </section>
  )
}
