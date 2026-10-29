import { STATUS_META } from '../constants'

export default function StatusBadge({ status, size = 'md', dark = false, inhouse = false }) {
  const meta = (inhouse && STATUS_META.inhouse) || STATUS_META[status] || STATUS_META.new
  const sizing = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  if (dark) {
    return <span className={`${sizing} rounded-full font-bold shrink-0 ${meta.bg} ${meta.text}`}>{meta.label}</span>
  }
  return (
    <span
      className={`${sizing} rounded-full font-bold shrink-0`}
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      {meta.label}
    </span>
  )
}
