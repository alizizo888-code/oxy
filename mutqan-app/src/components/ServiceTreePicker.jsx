import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, HelpCircle, Shuffle } from 'lucide-react'
import AiLogo from './AiLogo'
import FxIcon from './FxIcon'
import { branchesFor, selectionSummary, randomQuestions } from '../serviceTree'
import { specialtyLabel } from '../constants'

// Inside a specialty: pick the branch (غسيل / صيانة / تركيب / بيع وشراء …), then each
// step (unit type → fault …). An in-page MUTQAN AI button + rotating suggested questions.
export default function ServiceTreePicker({ specialtyId, value, onChange }) {
  const navigate = useNavigate()
  const branches = branchesFor(specialtyId)
  const branch = branches.find((b) => b.id === value?.branchId) || null
  const choices = value?.choices || {}
  const [seed, setSeed] = useState(0)
  const questions = useMemo(() => randomQuestions(branch?.ai || branches.flatMap((b) => b.ai || []), 3), [branch, specialtyId, seed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!branches.length) return null

  const setBranch = (b) => onChange({ branchId: b.id, choices: {} })
  const setChoice = (key, v) => {
    // changing a step clears the steps after it
    const idx = branch.steps.findIndex((s) => s.key === key)
    const next = {}
    branch.steps.forEach((s, i) => { if (i < idx && choices[s.key]) next[s.key] = choices[s.key] })
    next[key] = v
    onChange({ branchId: branch.id, choices: next })
  }

  const context = () => {
    const sum = selectionSummary(specialtyId, value)
    return `${specialtyLabel(specialtyId)}${sum ? ` — ${sum}` : ''}`
  }
  const askAi = (q) => navigate(`/ai?q=${encodeURIComponent(q ? `${q} (${context()})` : `أحتاج مساعدة في ${context()}`)}`)

  // Only show each step once the previous one is answered
  const visibleSteps = []
  if (branch) {
    for (const s of branch.steps) {
      visibleSteps.push(s)
      if (!choices[s.key]) break
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5">اختر الخدمة</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranch(b)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-2 border text-xs font-black transition-all active:scale-95 ${
                branch?.id === b.id ? 'bg-primary text-white border-primary shadow-md shadow-primary/25' : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:border-primary/40'
              }`}
            >
              <FxIcon id={specialtyId} className="text-xl">{b.icon}</FxIcon>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {visibleSteps.map((s) => (
        <div key={s.key} className="fade-up">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">{s.label}</label>
          <div className="flex flex-wrap gap-1.5">
            {s.options.map((o) => (
              <button
                key={o}
                onClick={() => setChoice(s.key, o)}
                className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold border transition-colors ${
                  choices[s.key] === o ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'
                }`}
              >
                {choices[s.key] === o && <Check size={12} />} {o}
              </button>
            ))}
            {s.allowUnknown && (
              <button onClick={() => askAi(`لا أعرف العطل بالضبط`)} className="flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold border border-dashed border-sky-300 text-sky-700 bg-sky-50">
                <HelpCircle size={12} /> لا أعرف العطل — اسأل AI
              </button>
            )}
          </div>
        </div>
      ))}

      {/* In-page MUTQAN AI */}
      <div className="rounded-2xl bg-gradient-to-l from-sky-50 to-blue-50 border border-sky-100 p-3">
        <div className="flex items-center gap-2.5">
          <AiLogo size={36} />
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-slate-900 text-sm">اسأل MUTQAN AI</p>
            <p className="text-[10px] text-slate-500 truncate">عن {context()}</p>
          </div>
          <button onClick={() => askAi('')} className="shrink-0 bg-gradient-to-l from-sky-500 to-blue-600 text-white rounded-full px-3.5 py-2 text-[11px] font-black active:scale-95 transition-transform">
            ابدأ المحادثة
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {questions.map((q) => (
            <button key={q} onClick={() => askAi(q)} className="bg-white border border-sky-100 rounded-full px-3 py-1.5 text-[10px] font-bold text-sky-700 active:scale-95 transition-transform hover:border-sky-300">
              {q}
            </button>
          ))}
          <button onClick={() => setSeed((x) => x + 1)} aria-label="أسئلة أخرى" className="w-7 h-7 rounded-full bg-white border border-sky-100 flex items-center justify-center">
            <Shuffle size={12} className="text-sky-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
