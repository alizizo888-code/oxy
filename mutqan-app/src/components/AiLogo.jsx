// Simple, clean MUTQAN AI mark — a rounded blue tile with a white spark and "AI".
// Pure vector: always sharp, never fails to load.
export default function AiLogo({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`shrink-0 ${className}`} role="img" aria-label="MUTQAN AI">
      <defs>
        <linearGradient id="mqai-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#mqai-g)" />
      <path d="M17 11 C18 17 19.5 18.5 25.5 19.5 C19.5 20.5 18 22 17 28 C16 22 14.5 20.5 8.5 19.5 C14.5 18.5 16 17 17 11 Z" fill="#fff" />
      <circle cx="31" cy="13" r="2" fill="#fff" opacity=".85" />
      <text x="34" y="37" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="13" fill="#fff">AI</text>
    </svg>
  )
}
