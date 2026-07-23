'use client'

// Total commit volume with selectable time range: 7d / 1m / 6m / ytd / 1y / all.
// Every range shows daily ticks (the stock-chart volume strip) — no weekly
// aggregation, so every bar is a complete day. The range total is the hero.

import { useMemo, useState } from 'react'
import BarChart from '@/components/charts/BarChart'
import { formatCount } from '@/lib/design'
import {
  RANGE_KEYS,
  RANGE_LABELS,
  sliceRange,
  rangeTotal,
  priorSpanDelta,
  labelEvery,
  type RangeKey,
  type VolumePoint,
} from '@/lib/volume'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

export default function VolumeChart({ data }: { data: VolumePoint[] }) {
  const [range, setRange] = useState<RangeKey>('1m')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const points = useMemo(() => sliceRange(data, range), [data, range])
  const total = useMemo(() => rangeTotal(points), [points])
  const delta = useMemo(() => priorSpanDelta(data, points), [data, points])

  const chartData = points.map((p) => ({ label: shortDate(p.date), value: p.value }))
  const latest = points[points.length - 1]
  const hovered = hoverIdx != null ? points[hoverIdx] : null

  function handlePointer(e: React.PointerEvent<HTMLDivElement>) {
    const svg = e.currentTarget.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const idx = Math.round(x * (points.length - 1))
    setHoverIdx(Math.min(points.length - 1, Math.max(0, idx)))
  }

  return (
    <div>
      {/* Range toggle + hero total */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex font-mono text-[11px]" role="tablist" aria-label="Time range">
          {RANGE_KEYS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={range === k}
              onClick={() => setRange(k)}
              className={`border-2 border-[var(--line)] px-2.5 py-1 font-bold first:border-r-0 [&:not(:first-child)]:border-l-0 ${
                range === k
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'bg-[var(--paper)] text-[var(--muted)] invert-hover'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="font-mono text-[13px] text-[var(--muted)]">
          <b className="text-[15px] text-[var(--ink)]">{formatCount(total)}</b> commits · {RANGE_LABELS[range]}
          {delta != null ? (
            <>
              {' · '}
              <b className="text-[var(--ink)]">
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
              </b>{' '}
              vs prior span
            </>
          ) : null}
        </p>
      </div>

      {/* Hover readout — the day under the pointer, or the latest complete day */}
      <p className="mb-2 font-mono text-[11px] text-[var(--muted)]" aria-live="polite">
        {hovered ? (
          <>
            <b className="text-[var(--ink)]">{shortDate(hovered.date)}</b>
            {' · '}
            <b className="text-[var(--ink)]">{formatCount(hovered.value)}</b> commits
          </>
        ) : latest ? (
          <>
            latest complete day — {shortDate(latest.date)} · {formatCount(latest.value)}
          </>
        ) : null}
      </p>

      <div onPointerMove={handlePointer} onPointerDown={handlePointer} onPointerLeave={() => setHoverIdx(null)}>
        <BarChart
          data={chartData}
          ariaLabel={`Daily AI coding tool commits, ${RANGE_LABELS[range]} — latest complete day ${latest ? shortDate(latest.date) : ''}`}
          labelEvery={labelEvery(points.length)}
        />
      </div>
    </div>
  )
}
