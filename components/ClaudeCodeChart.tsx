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

function formatMonth(date: string): string {
  const [, m] = date.split('-')
  return MONTHS[parseInt(m, 10) - 1]
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

  const formatted = data.map((d) => ({
    ...d,
    label: isMobile ? formatMonth(d.date) : formatDate(d.date),
    fullLabel: formatDateFull(d.date),
  }))

  // On mobile: show every other month to avoid crowding
  // On desktop: show ~10 evenly spaced ticks
  const tickIndices: number[] = []
  if (isMobile) {
    let lastMonth = ''
    let monthCount = 0
    formatted.forEach((d, i) => {
      const month = d.date.slice(0, 7)
      if (month !== lastMonth) {
        if (monthCount % 2 === 0) tickIndices.push(i)
        monthCount++
        lastMonth = month
      }
    })
  }
  const tickInterval = isMobile ? undefined : Math.max(1, Math.floor(formatted.length / 10))

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
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--foreground-subtle)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            {...(isMobile
              ? { ticks: tickIndices.map((i) => formatted[i].label), interval: 0, height: 30 }
              : { interval: tickInterval, height: 30 }
            )}
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
