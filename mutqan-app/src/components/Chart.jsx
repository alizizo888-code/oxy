/**
 * Chart — platform SVG chart component for generated apps.
 * Renders a ChartSpec (the same grammar as docs.pdf `{ type: 'chart', chart }`
 * sections) as a responsive vector SVG. Pass DATA — the engine owns the layout
 * (axes, tick density, legends, label truncation), so an illegible chart can't
 * be produced by hand-tuning.
 *
 * @param {object} props
 * @param {object} props.spec - ChartSpec:
 *   { kind: 'bar'|'hbar'|'line'|'pie'|'donut',
 *     series: [{ name?: string, data: number[], color?: '#hex' }],
 *     labels?: string[],
 *     options?: { title?: string, stacked?: boolean, yMax?: number } }
 * @param {string} [props.className] - CSS class for the wrapper div
 * @param {object} [props.style] - Inline styles for the wrapper div
 */

import React, { useMemo } from 'react'
import { chartSvg } from '../lib/svg-charts'

// The engine plots MAGNITUDES: it clamps values to ≥0 (a bar/line can't go
// below the axis) and pie slices can't be negative. So a signed series
// (profit/loss, temperature delta) would render as a confidently-wrong
// flat-zero chart. Detect that and say so instead of drawing a lie. Also cap
// the point count — a runaway series makes a multi-MB SVG (and used to crash
// the engine before the fold-max fix).
const MAX_POINTS = 4000

function specIssue(spec) {
  const series = Array.isArray(spec?.series) ? spec.series : []
  let points = 0
  let hasNegative = false
  for (const s of series) {
    const data = Array.isArray(s?.data) ? s.data : []
    points += data.length
    for (const v of data) { if (Number(v) < 0) { hasNegative = true; break } }
  }
  if (hasNegative) return "This chart shows magnitudes and can't plot negative values — split the sign into a separate field, or show the data in a table."
  if (points > MAX_POINTS) return `Too many points to chart clearly (${points} > ${MAX_POINTS}). Aggregate first (db.groupBy) or chart a summary.`
  return null
}

export default function Chart({ spec, className = '', style = {} }) {
  const issue = useMemo(() => specIssue(spec), [spec])

  // chartSvg XML-escapes every text value (titles, labels, series names) and
  // sanitizes colors to hex literals, so the SVG string is injection-safe by
  // construction — nothing from a spec can break out of the markup.
  const svg = useMemo(() => {
    if (issue) return ''
    try {
      return chartSvg(spec || {})
    } catch {
      return ''
    }
  }, [spec, issue])

  if (issue) {
    return (
      <div className={className} style={{ width: '100%', padding: '12px', fontSize: '13px', color: '#6b7280', textAlign: 'center', ...style }}>
        {issue}
      </div>
    )
  }

  if (!svg) return null

  return (
    <div
      className={className}
      style={{ width: '100%', ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
