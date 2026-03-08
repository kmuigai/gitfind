'use client'

import { useState, useEffect, useRef, useMemo, useCallback, type MouseEvent } from 'react'
import { track } from '@vercel/analytics'
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
  'Codex': '#10b981',
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
  const [tooltipActive, setTooltipActive] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [showMA, setShowMA] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

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

  // On touch: show tooltip, then auto-hide after 2s
  const handleTouchTooltip = useCallback(() => {
    setTooltipActive(true)
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    fadeTimer.current = setTimeout(() => setTooltipActive(false), 2000)
  }, [])

  useEffect(() => {
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }
  }, [])

  const toggleTool = (tool: string) => {
    setHiddenTools((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) next.delete(tool)
      else next.add(tool)
      return next
    })
  }

  const handleDownload = useCallback(async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const source = chartRef.current
    if (!source || downloading) return
    setDownloading(true)
    track('png_download', { chart: 'ai-code-index', range })

    try {
      // Grab the live SVG rendered by Recharts
      const svgEl = source.querySelector('svg.recharts-surface')
      if (!svgEl) return

      // Clone SVG and resolve CSS variables from computed styles
      const svgClone = svgEl.cloneNode(true) as SVGSVGElement
      const resolveVars = (src: Element, cln: Element) => {
        const computed = getComputedStyle(src)
        if (cln instanceof SVGElement) {
          for (const attr of ['stroke', 'fill']) {
            const val = cln.getAttribute(attr)
            if (val?.includes('var(')) {
              cln.setAttribute(attr, computed.getPropertyValue(attr))
            }
          }
          for (const prop of Array.from(cln.style)) {
            if (cln.style.getPropertyValue(prop).includes('var(')) {
              cln.style.setProperty(prop, computed.getPropertyValue(prop))
            }
          }
          // Replace CSS variable fonts with system monospace
          const fontAttr = cln.getAttribute('font-family')
          if (fontAttr?.includes('var(')) {
            cln.setAttribute('font-family', 'ui-monospace, monospace')
          }
          if (cln.style.fontFamily?.includes('var(')) {
            cln.style.fontFamily = 'ui-monospace, monospace'
          }
        }
        const srcKids = Array.from(src.children)
        const clnKids = Array.from(cln.children)
        for (let i = 0; i < clnKids.length && i < srcKids.length; i++) {
          resolveVars(srcKids[i], clnKids[i])
        }
      }
      resolveVars(svgEl, svgClone)

      // Read dimensions from the live SVG
      const rect = svgEl.getBoundingClientRect()
      const svgW = Math.round(rect.width)
      const svgH = Math.round(rect.height)
      svgClone.setAttribute('width', String(svgW))
      svgClone.setAttribute('height', String(svgH))
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

      // Canvas layout
      const pad = 48
      const headerH = 40
      const legendH = 44
      const canvasW = svgW + pad * 2
      const canvasH = headerH + svgH + legendH + pad * 2
      const scale = 2

      const canvas = document.createElement('canvas')
      canvas.width = canvasW * scale
      canvas.height = canvasH * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)

      // Background
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, canvasW, canvasH)

      // Watermark header
      ctx.font = '600 14px ui-monospace, monospace'
      ctx.fillStyle = '#e4e4e7'
      ctx.fillText('AI Code Index', pad, pad + 14)
      ctx.font = '14px ui-monospace, monospace'
      ctx.fillStyle = '#a1a1aa'
      const tagline = 'gitfind.ai'
      ctx.fillText(tagline, canvasW - pad - ctx.measureText(tagline).width, pad + 14)

      // Render SVG to canvas via Image
      const svgString = new XMLSerializer().serializeToString(svgClone)
      const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
      const img = new Image()

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, pad, pad + headerH, svgW, svgH)
          resolve()
        }
        img.onerror = reject
        img.src = svgDataUrl
      })

      // Legend
      const legendY = pad + headerH + svgH + 20
      let legendX = pad
      ctx.font = '12px ui-monospace, monospace'
      for (const tool of visibleTools) {
        ctx.fillStyle = TOOL_COLORS[tool]
        ctx.beginPath()
        ctx.arc(legendX + 4, legendY + 4, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#a1a1aa'
        ctx.fillText(tool, legendX + 14, legendY + 8)
        legendX += 14 + ctx.measureText(tool).width + 24
      }

      // Download
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `ai-code-index-${range.toLowerCase()}.png`
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (err) {
      console.error('PNG export failed:', err)
    } finally {
      setDownloading(false)
    }
  }, [downloading, range, visibleTools])

  if (data.length < 2) return null

  const formatted = filtered.map((d, i) => {
    const row: Record<string, number | string> = {
      ...d,
      idx: i,
      label: formatDate(d.date),
      fullLabel: formatDateFull(d.date),
    }
    // Compute 7d moving averages
    if (showMA) {
      for (const tool of TOOL_KEYS) {
        let sum = 0
        let count = 0
        for (let j = Math.max(0, i - 6); j <= i; j++) {
          const val = (filtered[j][tool] as number) || 0
          sum += val
          count++
        }
        row[`${tool}_ma7`] = count > 0 ? Math.round(sum / count) : 0
      }
    }
    return row
  })

  const ticks = getTickIndices(filtered)

  return (
    <div ref={containerRef}>
      {/* Range selector + MA toggle + download */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 items-center" style={{ fontFamily: MONO }}>
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
          <span className="mx-1 text-[var(--border)]">|</span>
          <button
            onClick={() => setShowMA((v) => !v)}
            className="px-3 py-1 text-xs transition-colors"
            style={{
              fontFamily: MONO,
              borderRadius: '6px',
              border: showMA ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: showMA ? 'var(--accent)' : 'transparent',
              color: showMA ? 'var(--on-accent)' : 'var(--foreground-subtle)',
            }}
          >
            7d MA
          </button>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1 text-xs transition-colors"
          style={{
            fontFamily: MONO,
            borderRadius: '6px',
            border: '1px solid var(--border)',
            color: 'var(--foreground-subtle)',
            opacity: downloading ? 0.5 : 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? 'Exporting…' : 'PNG'}
        </button>
      </div>

      {/* Chart + legend (ref used for PNG export) */}
      <div ref={chartRef}>
        <div className="h-72 w-full sm:h-96" onTouchStart={handleTouchTooltip}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted} margin={{ top: 8, right: 30, left: -8, bottom: 0 }}>
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
                  return d ? formatTick(String(d.date), formatted.length) : ''
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
                active={tooltipActive ? undefined : false}
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
                  strokeWidth={showMA ? 0.8 : 1.5}
                  strokeOpacity={showMA ? 0.3 : 1}
                  dot={false}
                  activeDot={showMA ? false : { r: 3, fill: TOOL_COLORS[tool], stroke: 'none' }}
                  isAnimationActive={hasAnimated}
                  animationBegin={0}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              ))}
              {showMA && visibleTools.map((tool) => (
                <Line
                  key={`${tool}_ma7`}
                  type="monotone"
                  dataKey={`${tool}_ma7`}
                  name={`${tool} (7d MA)`}
                  stroke={TOOL_COLORS[tool]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: TOOL_COLORS[tool], stroke: 'none' }}
                  isAnimationActive={false}
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
    </div>
  )
}
