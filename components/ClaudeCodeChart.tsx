'use client'

import { useState, useEffect } from 'react'
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

function formatDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

function formatDateFull(date: string): string {
  const [year, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${year}`
}

// Get "Jan '25" style label for a date string
function formatMonthYear(date: string): string {
  const [year, m] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} '${year.slice(2)}`
}

// Find the index at the middle of each month's data, optionally skipping every other month
function getMidMonthTicks(data: Array<{ date: string }>, everyOther: boolean): number[] {
  const monthGroups = new Map<string, number[]>()
  data.forEach((d, i) => {
    const key = d.date.slice(0, 7) // "2025-01"
    const group = monthGroups.get(key)
    if (group) group.push(i)
    else monthGroups.set(key, [i])
  })

  const ticks: number[] = []
  let count = 0
  for (const [, indices] of monthGroups) {
    if (!everyOther || count >= 2 && count % 2 === 0) {
      ticks.push(indices[Math.floor(indices.length / 2)])
    }
    count++
  }
  return ticks
}

export default function ClaudeCodeChart({ data }: ClaudeCodeChartProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (data.length < 2) return null

  const formatted = data.map((d, i) => ({
    ...d,
    idx: i,
    label: formatDate(d.date),
    fullLabel: formatDateFull(d.date),
  }))

  // Both mobile and desktop: every other month, centered on ~15th
  const ticks = getMidMonthTicks(data, true)

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="idx"
            type="number"
            domain={[0, formatted.length - 1]}
            ticks={ticks}
            tickFormatter={(idx: number) => {
              const d = formatted[idx]
              return d ? formatMonthYear(d.date) : ''
            }}
            tick={{ fontSize: 11, fill: 'var(--foreground-subtle)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            height={30}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--foreground-subtle)' }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--background-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--foreground)',
              padding: '8px 12px',
            }}
            labelFormatter={(_label, payload) => {
              const item = payload?.[0]?.payload as { fullLabel?: string } | undefined
              return item?.fullLabel ?? String(_label)
            }}
            formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), 'Commits with Claude Code']}
          />
          <Line
            type="monotone"
            dataKey="claude_code"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
