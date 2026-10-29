import { Star } from 'lucide-react'

export default function RatingStars({ value = 0, onChange, size = 20, readOnly = false }) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(s)}
          className={readOnly ? 'cursor-default' : 'active:scale-90 transition-transform'}
        >
          <Star
            size={size}
            className={s <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
          />
        </button>
      ))}
    </div>
  )
}
