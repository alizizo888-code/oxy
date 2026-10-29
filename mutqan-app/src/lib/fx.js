// Per-specialty visual character: background theme, colours, particle glyph, idle icon animation, tap burst.
const T = {
  ac: ['snow', '#38bdf8', '#e0f2fe', '❄', 'spin'],
  fridge: ['snow', '#22d3ee', '#cffafe', '❄', 'shiver'],
  plumbing: ['bubbles', '#06b6d4', '#cffafe', '', 'drip'],
  tanks: ['bubbles', '#3b82f6', '#dbeafe', '', 'wave'],
  cleaning: ['bubbles', '#10b981', '#d1fae5', '✦', 'twinkle'],
  electric: ['sparks', '#f59e0b', '#fde68a', '⚡', 'flash'],
  general: ['sparks', '#38bdf8', '#e0f2fe', '✦', 'swing'],
  contracting: ['sparks', '#f97316', '#fed7aa', '✦', 'bounce'],
  appliances: ['gears', '#a855f7', '#e9d5ff', '⚙', 'spin'],
  moving: ['gears', '#eab308', '#fef9c3', '▣', 'slide'],
  cameras: ['scan', '#14b8a6', '#99f6e4', '', 'pan'],
  pest: ['scan', '#84cc16', '#d9f99d', '', 'wiggle'],
  satellite: ['scan', '#64748b', '#e2e8f0', '', 'tilt'],
  paint: ['blobs', '#f43f5e', '#fecdd3', '', 'swing'],
  solar: ['rays', '#fbbf24', '#fef3c7', '', 'spin'],
  locks: ['shine', '#6366f1', '#c7d2fe', '', 'shake'],
  corporate: ['shine', '#3b82f6', '#bfdbfe', '', 'bounce'],
  tiling: ['shine', '#fb923c', '#fed7aa', '', 'pulse'],
}
export const fxOf = (id) => {
  const [theme, c1, c2, glyph, idle] = T[id] || T.general
  return { theme, c1, c2, glyph, idle }
}
