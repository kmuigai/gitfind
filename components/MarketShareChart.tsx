'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MarketShareChartProps {
  data: Array<{ date: string; [tool: string]: number | string }>
}

const TOOL_COLORS: Record<string, string> = {
  'Claude Code': '#6c6af6',
  'Cursor': '#f59e0b',
  'GitHub Copilot': '#3b82f6',
  'Aider': '#22c55e',
  'Gemini CLI': '#ef4444',
  'Devin': '#a855f7',
  'Codex': '#10b981',
}

const TOOL_KEYS = Object.keys(TOOL_COLORS)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type TimeRange = '1M' | '3M' | '1Y' | 'ALL'
const RANGES: TimeRange[] = ['1M', '3M', '1Y', 'ALL']

const RANGE_DAYS: Record<TimeRange, number | null> = {
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

export default function MarketShareChart({ data }: MarketShareChartProps) {
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

  // Compute 7d MA of market share to smooth out daily noise
  const shareData = useMemo(() => {
    // First compute raw daily shares
    const rawShares = filtered.map((row) => {
      const total = TOOL_KEYS.reduce((sum, tool) => sum + ((row[tool] as number) || 0), 0)
      const entry: Record<string, number | string> = { date: row.date }
      for (const tool of TOOL_KEYS) {
        entry[tool] = total > 0 ? ((row[tool] as number) || 0) / total * 100 : 0
      }
      return entry
    })

    // Apply 7d moving average to smooth
    return rawShares.map((row, i) => {
      const smoothed: Record<string, number | string> = { date: row.date }
      for (const tool of TOOL_KEYS) {
        let sum = 0
        let count = 0
        for (let j = Math.max(0, i - 6); j <= i; j++) {
          sum += (rawShares[j][tool] as number) || 0
          count++
        }
        smoothed[tool] = count > 0 ? sum / count : 0
      }
      return smoothed
    })
  }, [filtered])

  // Determine which tools have meaningful share (>0.1% at any point)
  const activeTools = useMemo(() => {
    return TOOL_KEYS.filter((tool) =>
      shareData.some((row) => (row[tool] as number) > 0.1)
    )
  }, [shareData])

  // Reverse so the dominant tool is at the bottom (largest area)
  const stackOrder = useMemo(() => {
    // Sort by average share ascending — smallest on top, largest at bottom
    const avgShares = activeTools.map((tool) => {
      const avg = shareData.reduce((sum, row) => sum + ((row[tool] as number) || 0), 0) / shareData.length
      return { tool, avg }
    })
    avgShares.sort((a, b) => a.avg - b.avg)
    return avgShares.map((s) => s.tool)
  }, [activeTools, shareData])

  if (data.length < 7) return null

  const formatted = shareData.map((d, i) => ({
    ...d,
    idx: i,
  }))

  // Tick logic
  const len = formatted.length
  let ticks: number[]
  if (len <= 30) {
    ticks = []
    for (let i = 0; i < len; i += 7) ticks.push(i)
    if (ticks[ticks.length - 1] !== len - 1) ticks.push(len - 1)
  } else {
    const monthGroups = new Map<string, number[]>()
    shareData.forEach((d, i) => {
      const key = String(d.date).slice(0, 7)
      const group = monthGroups.get(key)
      if (group) group.push(i)
      else monthGroups.set(key, [i])
    })
    const everyOther = monthGroups.size > 6
    ticks = []
    let count = 0
    for (const [, indices] of monthGroups) {
      if (!everyOther || count % 2 === 0) {
        ticks.push(indices[Math.floor(indices.length / 2)])
      }
      count++
    }
  }

  return (
    <div ref={containerRef}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1" style={{ fontFamily: MONO }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1 text-xs transition-colors"
              style={{
                fontFamily: MONO,
                borderRadius: '6px',
                border: range === r ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: range === r ? 'var(--accent)' : 'transparent',
                color: range === r ? 'var(--on-accent)' : 'var(--foreground-subtle)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[var(--foreground-subtle)]" style={{ fontFamily: MONO }}>
          7d smoothed
        </span>
      </div>

      <div className="h-48 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 30, left: -8, bottom: 0 }}>
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
                const d = shareData[idx]
                if (!d) return ''
                const date = String(d.date)
                return len <= 30 ? formatDate(date) : formatMonthYear(date)
              }}
              tick={{ fontSize: 11, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              height={30}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: MONO,
                color: 'var(--foreground)',
                padding: '8px 12px',
              }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload as { date?: string } | undefined
                return item?.date ? formatDateFull(String(item.date)) : String(_label)
              }}
              formatter={(value: number | undefined, name?: string) => [
                `${(value ?? 0).toFixed(1)}%`,
                name ?? '',
              ]}
            />
            {stackOrder.map((tool) => (
              <Area
                key={tool}
                type="monotone"
                dataKey={tool}
                name={tool}
                stackId="1"
                fill={TOOL_COLORS[tool]}
                fillOpacity={0.7}
                stroke={TOOL_COLORS[tool]}
                strokeWidth={0.5}
                isAnimationActive={hasAnimated}
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
