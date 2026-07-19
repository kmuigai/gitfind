// 100% segmented share bar — hatch pattern per segment (print-style),
// halo'd in-bar labels for wide segments, legend with values below.

import { ChartPatterns, patternForRank, patternUrl } from './Patterns'

interface ShareSegment {
  label: string
  value: number
}

interface ShareBarProps {
  segments: ShareSegment[] // pre-sorted desc; leader gets the solid ink pattern
  ariaLabel: string
  formatPct?: (pct: number) => string
}

export default function ShareBar({ segments, ariaLabel, formatPct = (p) => (p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`) }: ShareBarProps) {
  const W = 680
  const H = 64
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const withGeo = segments.map((s, i) => {
    const pct = (s.value / total) * 100
    const x = segments.slice(0, i).reduce((sum, p) => sum + (p.value / total) * W, 0)
    return { ...s, pct, x, w: (s.value / total) * W, pat: patternForRank(i) }
  })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        <ChartPatterns prefix="share" />
        {withGeo.map((s) => (
          <g key={s.label}>
            <rect x={s.x} y={0} width={s.w} height={H} fill={patternUrl('share', s.pat)} stroke="var(--ink)" strokeWidth="1.5" />
            {s.pct > 7 && (
              <text
                x={s.x + s.w / 2}
                y={H / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight="bold"
                fill={s.pat === 'solid' ? 'var(--paper)' : 'var(--ink)'}
                stroke={s.pat === 'solid' ? 'none' : 'var(--paper)'}
                strokeWidth={s.pat === 'solid' ? 0 : 3}
                paintOrder="stroke"
                fontFamily="var(--font-geist-mono), ui-monospace, monospace"
              >
                {s.pct.toFixed(0)}%
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-[var(--body)]">
        {withGeo.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <ChartPatterns prefix={`lg-${s.pat}`} />
              <rect width="14" height="14" fill={patternUrl(`lg-${s.pat}`, s.pat)} stroke="var(--ink)" strokeWidth="1.5" />
            </svg>
            {s.label} <b className="text-[var(--ink)]">{formatPct(s.pct)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
