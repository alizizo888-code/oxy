import { iconFor } from '../serviceIcons'
import FxIcon from './FxIcon'

// Modern service tile: glass card, gradient icon chip with glow, hover lift.
export default function ServiceTile({ id, label, desc, onClick, delay = 0, compact = false }) {
  const { Icon, g, glow } = iconFor(id)
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`group relative overflow-hidden text-right rounded-2xl bg-white/80 backdrop-blur border border-white shadow-[0_2px_14px_rgba(15,60,120,0.07)] hover:shadow-[0_8px_26px_rgba(15,60,120,0.15)] hover:-translate-y-0.5 active:scale-[0.96] transition-all fade-up ${compact ? 'p-2.5 flex flex-col items-center gap-2' : 'p-4'}`}
    >
      <span className="pointer-events-none absolute -top-8 -left-8 w-20 h-20 rounded-full bg-sky-200/30 group-hover:bg-sky-300/40 transition-colors" />
      <FxIcon id={id} className={`${compact ? 'w-12 h-12' : 'w-12 h-12 mb-3'} rounded-2xl bg-gradient-to-br ${g} text-white shadow-lg ${glow} ring-2 ring-white/70 group-hover:scale-105 transition-transform`}>
        <Icon size={compact ? 22 : 23} strokeWidth={2} />
      </FxIcon>
      <span className="relative block">
        <span className={`block font-display font-black text-slate-900 ${compact ? 'text-[11px] text-center leading-tight' : 'text-sm'}`}>{label}</span>
        {!compact && desc && <span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">{desc}</span>}
      </span>
    </button>
  )
}
