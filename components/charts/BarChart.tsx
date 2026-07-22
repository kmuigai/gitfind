// Server-rendered 1-bit bar chart — solid ink bars, dashed gridlines,
// accent latest bar with direct value label. Bars grow from baseline on
// first view (parent with .is-visible starts the paused animation).

import { formatCount } from '@/lib/design'

interface BarChartProps {
  data: { label: string; value: number }[]
  ariaLabel: string
  gridValues?: number[]
  formatValue?: (n: number) => string
  accentLast?: boolean
  labelEvery?: number
  height?: number
}

export default function BarChart({
  data,
  ariaLabel,
  gridValues,
  formatValue = formatCount,
  accentLast = true,
  labelEvery = 10,
  height = 190,
}: BarChartProps) {
  const W = 680
  const H = height
  const padTop = 8
  const padBottom = 20
  const values = data.map((d) => d.value)
  const max = Math.max(...values, 1)
  const barW = W / data.length
  const last = data.length - 1

  // Auto gridlines at nice round steps when not explicitly provided
  const grids = gridValues ?? (() => {
    const raw = max / 3
    const mag = Math.pow(10, Math.floor(Math.log10(raw)))
    const step = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? 10 * mag
    return [step, step * 2].filter((v) => v < max)
  })()

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
      {grids.map((g) => {
        if (g > max) return null
        const y = H - padBottom - (g / max) * (H - padTop - padBottom)
        return (
          <g key={g}>
            <line x1={0} x2={W} y1={y} y2={y} stroke="var(--ink)" strokeWidth={0.75} strokeDasharray="2 4" opacity={0.35} />
            <text x={0} y={y - 3} fontSize={9} fill="var(--muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
              {formatValue(g)}
            </text>
          </g>
        )
      })}
      {values.map((v, i) => {
        const h = (v / max) * (H - padTop - padBottom)
        const isLast = accentLast && i === last
        return (
          <rect
            key={i}
            className="bar-grow"
            style={{ animationDelay: `${(i / data.length) * 600}ms` }}
            x={i * barW + 1}
            y={H - padBottom - h}
            width={Math.max(barW - 1, 0.5)}
            height={Math.max(h, 1)}
            fill={isLast ? 'var(--accent)' : 'var(--ink)'}
            stroke={isLast ? 'var(--ink)' : 'none'}
            strokeWidth={isLast ? 2 : 0}
          />
        )
      })}
      {accentLast && (
        <text
          x={W - 4}
          y={Math.max(H - padBottom - (values[last] / max) * (H - padTop - padBottom) - 6, 12)}
          textAnchor="end"
          fontSize={11}
          fontWeight="bold"
          fill="var(--ink)"
          stroke="var(--paper)"
          strokeWidth={3.5}
          paintOrder="stroke"
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          {formatValue(values[last])}
        </text>
      )}
      <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--ink)" strokeWidth={2} />
      {data.map((d, i) => {
        const isFinalLabel = i === data.length - 1
        const onCadence = i % labelEvery === 0 && data.length - 1 - i >= labelEvery
        if (!onCadence && !isFinalLabel) return null
        return (
          <text
            key={i}
            x={isFinalLabel ? W - 1 : i * barW + 2}
            y={H - 5}
            textAnchor={isFinalLabel ? 'end' : 'start'}
            fontSize={10}
            fill="var(--muted)"
            fontFamily="var(--font-geist-mono), ui-monospace, monospace"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}
