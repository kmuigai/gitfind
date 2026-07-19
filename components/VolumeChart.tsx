'use client'

// Total commit volume with selectable time range: 7d / 1m / 6m / ytd / 1y / all.
// Daily bars for short ranges, weekly buckets for long ones. SSR renders 1m.

import { useMemo, useState } from 'react'
import BarChart from '@/components/charts/BarChart'
import { formatCount } from '@/lib/design'

export interface VolumePoint {
  date: string // YYYY-MM-DD, ascending
  value: number
}

const RANGES = [
  { key: '7d', label: '7d' },
  { key: '1m', label: '1m' },
  { key: '6m', label: '6m' },
  { key: 'ytd', label: 'ytd' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'all' },
] as const

type RangeKey = (typeof RANGES)[number]['key']

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

function sliceRange(data: VolumePoint[], key: RangeKey): VolumePoint[] {
  if (data.length === 0) return data
  const end = new Date(`${data[data.length - 1].date}T00:00:00Z`)
  const daysAgo = (n: number) => {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - n + 1)
    return d.toISOString().slice(0, 10)
  }
  switch (key) {
    case '7d':
      return data.filter((p) => p.date >= daysAgo(7))
    case '1m':
      return data.filter((p) => p.date >= daysAgo(30))
    case '6m':
      return data.filter((p) => p.date >= daysAgo(182))
    case 'ytd':
      return data.filter((p) => p.date >= `${end.getUTCFullYear()}-01-01`)
    case '1y':
      return data.filter((p) => p.date >= daysAgo(365))
    case 'all':
      return data
  }
}

function aggregateWeekly(data: VolumePoint[]): VolumePoint[] {
  const weeks: VolumePoint[] = []
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7)
    weeks.push({ date: chunk[0].date, value: chunk.reduce((s, p) => s + p.value, 0) })
  }
  return weeks
}

export default function VolumeChart({ data }: { data: VolumePoint[] }) {
  const [range, setRange] = useState<RangeKey>('1m')

  const daily = useMemo(() => sliceRange(data, range), [data, range])
  const weekly = range === '7d' || range === '1m' ? daily : aggregateWeekly(daily)
  const isWeekly = weekly !== daily

  const chartData = weekly.map((p) => ({ label: shortDate(p.date), value: p.value }))
  const total = daily.reduce((s, p) => s + p.value, 0)

  // Delta vs the immediately preceding span of equal length (on daily values)
  const prevStart = data.length - daily.length * 2
  const prevEnd = data.length - daily.length
  const prevTotal =
    prevStart >= 0
      ? data.slice(prevStart, prevEnd).reduce((s, p) => s + p.value, 0)
      : null
  const deltaPct =
    prevTotal != null && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null

  const labelEvery = Math.max(1, Math.floor(chartData.length / 8))
  const rangeLabel = range === 'ytd' ? 'ytd' : range === 'all' ? 'all time' : `last ${range}`

  return (
    <div>
      {/* Range toggle + period readout */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex font-mono text-[11px]" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`border-2 border-[var(--line)] px-2.5 py-1 font-bold first:border-r-0 [&:not(:first-child)]:border-l-0 ${
                range === r.key
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'bg-[var(--paper)] text-[var(--muted)] invert-hover'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-[var(--muted)]">
          <b className="text-[var(--ink)]">{formatCount(total)}</b> commits · {rangeLabel}
          {isWeekly ? ' · weekly · this week in progress' : ''}
          {deltaPct != null ? (
            <>
              {' · '}
              <b className="text-[var(--ink)]">
                {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}%
              </b>{' '}
              vs prior span
            </>
          ) : null}
        </p>
      </div>

      <BarChart
        data={chartData}
        ariaLabel={`Bar chart of total daily AI coding tool commits, ${rangeLabel}`}
        labelEvery={labelEvery}
      />
    </div>
  )
}
