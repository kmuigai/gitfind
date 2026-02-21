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

interface AICodeIndexChartProps {
  data: Array<{ date: string; [tool: string]: number | string }>
}

const TOOL_COLORS: Record<string, string> = {
  'Claude Code': '#6c6af6',
  'Cursor': '#f59e0b',
  'GitHub Copilot': '#3b82f6',
  'Aider': '#22c55e',
  'Gemini CLI': '#ef4444',
  'Devin': '#a855f7',
}

const TOOL_KEYS = Object.keys(TOOL_COLORS)

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

function getTickIndices(data: Array<{ date: string }>): number[] {
  const len = data.length
  if (len <= 7) {
    return len >= 2 ? [0, len - 1] : [0]
  }
  if (len <= 30) {
    const ticks: number[] = []
    for (let i = 0; i < len; i += 7) ticks.push(i)
    if (ticks[ticks.length - 1] !== len - 1) ticks.push(len - 1)
    return ticks
  }
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

function formatTick(date: string, dataLength: number): string {
  if (dataLength <= 30) return formatDate(date)
  return formatMonthYear(date)
}

export default function AICodeIndexChart({ data }: AICodeIndexChartProps) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const [range, setRange] = useState<TimeRange>('ALL')
  const [hiddenTools, setHiddenTools] = useState<Set<string>>(new Set())
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

  // Determine which tools actually have data
  const activeTools = useMemo(() => {
    return TOOL_KEYS.filter((tool) =>
      filtered.some((row) => (row[tool] as number) > 0)
    )
  }, [filtered])

  const visibleTools = useMemo(() => {
    return activeTools.filter((t) => !hiddenTools.has(t))
  }, [activeTools, hiddenTools])

  const toggleTool = (tool: string) => {
    setHiddenTools((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) next.delete(tool)
      else next.add(tool)
      return next
    })
  }

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
      {/* Range selector */}
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
      </div>

      {/* Chart */}
      <div className="h-72 w-full sm:h-96">
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
              width={48}
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
                padding: '8px 12px',
              }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload as { fullLabel?: string } | undefined
                return item?.fullLabel ?? String(_label)
              }}
              formatter={(value: number | undefined, name?: string) => [
                (value ?? 0).toLocaleString(),
                name ?? '',
              ]}
            />
            {visibleTools.map((tool) => (
              <Line
                key={tool}
                type="stepAfter"
                dataKey={tool}
                name={tool}
                stroke={TOOL_COLORS[tool]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: TOOL_COLORS[tool], stroke: 'none' }}
                isAnimationActive={hasAnimated}
                animationBegin={0}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {activeTools.map((tool) => {
          const hidden = hiddenTools.has(tool)
          return (
            <button
              key={tool}
              onClick={() => toggleTool(tool)}
              className="flex items-center gap-1.5 text-xs transition-opacity"
              style={{
                fontFamily: MONO,
                opacity: hidden ? 0.35 : 1,
                color: 'var(--foreground-muted)',
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: TOOL_COLORS[tool] }}
              />
              {tool}
            </button>
          )
        })}
      </div>
    </div>
  )
}
