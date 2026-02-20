'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ChartData {
  date: string
  claude_code: number
}

interface ClaudeCodeChartProps {
  data: ChartData[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type TimeRange = '1W' | '1M' | '3M' | '1Y' | 'ALL'
const RANGES: TimeRange[] = ['1W', '1M', '3M', '1Y', 'ALL']

const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  'ALL': null,
}

const MONO = 'var(--font-geist-mono), ui-monospace, monospace'

function formatDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

function formatDateFull(date: string): string {
  const [year, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${year}`
}

function formatMonthYear(date: string): string {
  const [year, m] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} '${year.slice(2)}`
}

// Pick tick positions based on data length
function getTickIndices(data: Array<{ date: string }>): number[] {
  const len = data.length
  if (len <= 7) {
    // 1W: show first and last
    return len >= 2 ? [0, len - 1] : [0]
  }
  if (len <= 30) {
    // 1M: show every ~7 days
    const ticks: number[] = []
    for (let i = 0; i < len; i += 7) ticks.push(i)
    if (ticks[ticks.length - 1] !== len - 1) ticks.push(len - 1)
    return ticks
  }
  // 3M+ : mid-month ticks, skip every other for large ranges
  const monthGroups = new Map<string, number[]>()
  data.forEach((d, i) => {
    const key = d.date.slice(0, 7)
    const group = monthGroups.get(key)
    if (group) group.push(i)
    else monthGroups.set(key, [i])
  })
  const everyOther = monthGroups.size > 6
  const ticks: number[] = []
  let count = 0
  for (const [, indices] of monthGroups) {
    if (!everyOther || count % 2 === 0) {
      ticks.push(indices[Math.floor(indices.length / 2)])
    }
    count++
  }
  return ticks
}

// Format tick label based on range context
function formatTick(date: string, dataLength: number): string {
  if (dataLength <= 30) return formatDate(date)
  return formatMonthYear(date)
}

export default function ClaudeCodeChart({ data }: ClaudeCodeChartProps) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const [range, setRange] = useState<TimeRange>('ALL')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasAnimated])

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range]
    if (!days) return data
    return data.slice(-days)
  }, [data, range])

  const metric = useMemo(() => {
    if (filtered.length < 2) return null
    if (range === 'ALL') {
      const total = filtered.reduce((sum, d) => sum + d.claude_code, 0)
      if (total >= 1_000_000) return { label: `${(total / 1_000_000).toFixed(1)}M commits`, type: 'total' as const }
      if (total >= 1_000) return { label: `${(total / 1_000).toFixed(1)}k commits`, type: 'total' as const }
      return { label: `${total.toLocaleString()} commits`, type: 'total' as const }
    }
    const first = filtered[0].claude_code
    const last = filtered[filtered.length - 1].claude_code
    if (first === 0) return null
    const pct = ((last - first) / first) * 100
    const sign = pct >= 0 ? '+' : ''
    const formatted = Math.abs(pct) >= 10_000
      ? `${sign}${Math.round(pct / 1000)}k`
      : Math.abs(pct) >= 1_000
        ? `${sign}${(pct / 1000).toFixed(1)}k`
        : `${sign}${pct.toFixed(1)}`
    return { label: `${formatted}%`, type: 'pct' as const, positive: pct >= 0 }
  }, [filtered, range])

  if (data.length < 2) return null

  const formatted = filtered.map((d, i) => ({
    ...d,
    idx: i,
    label: formatDate(d.date),
    fullLabel: formatDateFull(d.date),
  }))

  const ticks = getTickIndices(filtered)

  return (
    <div ref={containerRef}>
      {/* Range selector + growth metric */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1" style={{ fontFamily: MONO }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1 text-xs transition-colors"
              style={{
                fontFamily: MONO,
                borderRadius: '2px',
                border: range === r ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: range === r ? 'var(--accent)' : 'transparent',
                color: range === r ? '#fff' : 'var(--foreground-subtle)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
        {metric && (
          <span
            className="text-sm"
            style={{
              fontFamily: MONO,
              color: metric.type === 'total'
                ? 'var(--foreground-muted)'
                : metric.positive ? 'var(--score-high)' : '#ef4444',
            }}
          >
            {metric.label}
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="var(--border)"
              strokeOpacity={0.4}
              vertical={false}
            />
            <XAxis
              dataKey="idx"
              type="number"
              domain={[0, formatted.length - 1]}
              ticks={ticks}
              tickFormatter={(idx: number) => {
                const d = formatted[idx]
                return d ? formatTick(d.date, formatted.length) : ''
              }}
              tick={{ fontSize: 11, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              height={30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background-card)',
                border: '1px solid var(--border)',
                borderRadius: '0px',
                fontSize: '12px',
                fontFamily: MONO,
                color: 'var(--foreground)',
                padding: '6px 10px',
              }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload as { fullLabel?: string } | undefined
                return item?.fullLabel ?? String(_label)
              }}
              formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), 'commits']}
            />
            <Line
              type="stepAfter"
              dataKey="claude_code"
              stroke="var(--chart-line)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: 'var(--chart-line)', stroke: 'none' }}
              isAnimationActive={hasAnimated}
              animationBegin={0}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
