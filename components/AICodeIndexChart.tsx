'use client'

import { useState, useEffect, useRef, useMemo, useCallback, type MouseEvent } from 'react'
import { track } from '@vercel/analytics'
import { TOOL_COLORS } from '@/lib/colors'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface TimeSeriesEntry {
  tool: string
  date: string
  count: number
}

interface AICodeIndexChartProps {
  data: Array<{ date: string; [tool: string]: number | string }>
  configTimeSeries?: TimeSeriesEntry[]
  agentPRTimeSeries?: TimeSeriesEntry[]
}

// TOOL_COLORS imported from @/lib/colors

const TOOL_KEYS = Object.keys(TOOL_COLORS)

// Extended colors for config/agent layers (some tools differ from commit tools)
const LAYER_COLORS: Record<string, string> = {
  ...TOOL_COLORS,
  'AGENTS.md': '#8b5cf6',
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

type LayerKey = 'config' | 'agentPR'

const LAYER_LABELS: Record<LayerKey, string> = {
  config: 'Config Files',
  agentPR: 'Agent PRs',
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

// Parse active layers from URL hash (e.g. #layers=config,agentPR)
function parseLayersFromHash(): Set<LayerKey> {
  if (typeof window === 'undefined') return new Set()
  const hash = window.location.hash
  const match = hash.match(/layers=([^&]+)/)
  if (!match) return new Set()
  const keys = match[1].split(',').filter((k): k is LayerKey => k === 'config' || k === 'agentPR')
  return new Set(keys)
}

function updateHashLayers(layers: Set<LayerKey>) {
  if (typeof window === 'undefined') return
  if (layers.size === 0) {
    // Remove hash if no layers
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  } else {
    window.history.replaceState(null, '', `#layers=${[...layers].join(',')}`)
  }
}

// Build overlay chart data from time-series entries, filtered to the same date range
function buildLayerData(
  entries: TimeSeriesEntry[],
  dateRange: { start: string; end: string },
): { dates: string[]; tools: string[]; rows: Array<Record<string, number | string>> } {
  if (entries.length === 0) return { dates: [], tools: [], rows: [] }

  // Filter to date range
  const filtered = entries.filter((e) => e.date >= dateRange.start && e.date <= dateRange.end)
  if (filtered.length === 0) return { dates: [], tools: [], rows: [] }

  // Pivot: date → { tool: count }
  const tools = [...new Set(filtered.map((e) => e.tool))].sort()
  const dateMap = new Map<string, Record<string, number>>()
  for (const e of filtered) {
    const row = dateMap.get(e.date) ?? {}
    row[e.tool] = e.count
    dateMap.set(e.date, row)
  }

  const dates = [...dateMap.keys()].sort()
  const rows = dates.map((date, i) => {
    const row: Record<string, number | string> = { date, idx: i, label: formatDate(date), fullLabel: formatDateFull(date) }
    const vals = dateMap.get(date) ?? {}
    for (const tool of tools) {
      row[tool] = vals[tool] ?? 0
    }
    return row
  })

  return { dates, tools, rows }
}

export default function AICodeIndexChart({ data, configTimeSeries, agentPRTimeSeries }: AICodeIndexChartProps) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const [range, setRange] = useState<TimeRange>('ALL')
  const [hiddenTools, setHiddenTools] = useState<Set<string>>(new Set())
  const [tooltipActive, setTooltipActive] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [showMA, setShowMA] = useState(false)
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(() => parseLayersFromHash())
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  // Sync hash on mount (for SSR hydration)
  useEffect(() => {
    setActiveLayers(parseLayersFromHash())
  }, [])

  const toggleLayer = useCallback((layer: LayerKey) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      updateHashLayers(next)
      return next
    })
  }, [])

  // Which layers have data
  const availableLayers = useMemo(() => {
    const available: LayerKey[] = []
    if (configTimeSeries && configTimeSeries.length > 0) available.push('config')
    if (agentPRTimeSeries && agentPRTimeSeries.length > 0) available.push('agentPR')
    return available
  }, [configTimeSeries, agentPRTimeSeries])

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

  // Date range for overlay filtering
  const dateRange = useMemo(() => {
    if (filtered.length === 0) return { start: '', end: '' }
    return { start: filtered[0].date, end: filtered[filtered.length - 1].date }
  }, [filtered])

  // Determine which tools actually have data
  const activeTools = useMemo(() => {
    return TOOL_KEYS.filter((tool) =>
      filtered.some((row) => (row[tool] as number) > 0)
    )
  }, [filtered])

  const visibleTools = useMemo(() => {
    return activeTools.filter((t) => !hiddenTools.has(t))
  }, [activeTools, hiddenTools])

  // Build overlay data for active layers
  const configLayerData = useMemo(() => {
    if (!activeLayers.has('config') || !configTimeSeries) return null
    return buildLayerData(configTimeSeries, dateRange)
  }, [activeLayers, configTimeSeries, dateRange])

  const agentPRLayerData = useMemo(() => {
    if (!activeLayers.has('agentPR') || !agentPRTimeSeries) return null
    return buildLayerData(agentPRTimeSeries, dateRange)
  }, [activeLayers, agentPRTimeSeries, dateRange])

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

      // Read theme colors from computed styles
      const rootStyles = getComputedStyle(document.documentElement)
      const bgColor = rootStyles.getPropertyValue('--background').trim() || '#0a0a0f'
      const fgColor = rootStyles.getPropertyValue('--foreground').trim() || '#e8e8f0'
      const mutedColor = rootStyles.getPropertyValue('--foreground-muted').trim() || '#8a8aaa'

      // Background
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvasW, canvasH)

      // Watermark header
      ctx.font = '600 14px ui-monospace, monospace'
      ctx.fillStyle = fgColor
      ctx.fillText('AI Code Index', pad, pad + 14)
      ctx.font = '14px ui-monospace, monospace'
      ctx.fillStyle = mutedColor
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
        ctx.fillStyle = mutedColor
        ctx.fillText(tool, legendX + 14, legendY + 8)
        legendX += 14 + ctx.measureText(tool).width + 24
      }

      // Download — use navigator.share on mobile, link.click on desktop
      const fileName = `ai-code-index-${range.toLowerCase()}.png`
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return

      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        const file = new File([blob], fileName, { type: 'image/png' })
        try {
          await navigator.share({ files: [file] })
        } catch {
          // User cancelled share — not an error
        }
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = fileName
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
      }
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
      {/* Range selector + MA toggle + layer toggles + download */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 items-center" style={{ fontFamily: MONO }}>
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
          {availableLayers.length > 0 && (
            <>
              <span className="mx-1 text-[var(--border)]">|</span>
              {availableLayers.map((layer) => {
                const isActive = activeLayers.has(layer)
                return (
                  <button
                    key={layer}
                    onClick={() => toggleLayer(layer)}
                    className="px-3 py-1 text-xs transition-colors"
                    style={{
                      fontFamily: MONO,
                      borderRadius: '6px',
                      border: isActive ? '1px solid var(--score-high)' : '1px solid var(--border)',
                      background: isActive ? 'color-mix(in srgb, var(--score-high) 15%, transparent)' : 'transparent',
                      color: isActive ? 'var(--score-high)' : 'var(--foreground-subtle)',
                    }}
                  >
                    {LAYER_LABELS[layer]}
                  </button>
                )
              })}
            </>
          )}
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

      {/* Signal Layer: Config File Adoption */}
      {configLayerData && configLayerData.rows.length > 0 && (
        <div className="mt-6" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--score-high)]">
              Layer
            </span>
            <span className="text-xs text-[var(--foreground-muted)]" style={{ fontFamily: MONO }}>
              Config file adoption over time (repos)
            </span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={configLayerData.rows}
                margin={{ top: 4, right: 30, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="var(--border)"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={[0, Math.max(configLayerData.rows.length - 1, 1)]}
                  ticks={getTickIndices(configLayerData.rows as Array<{ date: string }>)}
                  tickFormatter={(idx: number) => {
                    const d = configLayerData.rows[idx]
                    return d ? formatTick(String(d.date), configLayerData.rows.length) : ''
                  }}
                  tick={{ fontSize: 10, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  height={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: MONO,
                    color: 'var(--foreground)',
                    padding: '6px 10px',
                  }}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload as { fullLabel?: string } | undefined
                    return item?.fullLabel ?? String(_label)
                  }}
                  formatter={(value: number | undefined, name?: string) => [
                    `${(value ?? 0).toLocaleString()} repos`,
                    name ?? '',
                  ]}
                />
                {configLayerData.tools.map((tool) => (
                  <Line
                    key={tool}
                    type="monotone"
                    dataKey={tool}
                    name={tool}
                    stroke={LAYER_COLORS[tool] ?? 'var(--foreground-subtle)'}
                    strokeWidth={1.5}
                    dot={{ r: 4, fill: LAYER_COLORS[tool] ?? 'var(--foreground-subtle)', stroke: 'none' }}
                    activeDot={{ r: 5, fill: LAYER_COLORS[tool] ?? 'var(--foreground-subtle)', stroke: 'none' }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {configLayerData.tools.map((tool) => (
              <span key={tool} className="flex items-center gap-1.5 text-[10px]" style={{ fontFamily: MONO, color: 'var(--foreground-muted)' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: LAYER_COLORS[tool] ?? 'var(--foreground-subtle)' }} />
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Signal Layer: Agent PRs */}
      {agentPRLayerData && agentPRLayerData.rows.length > 0 && (
        <div className="mt-6" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--score-high)]">
              Layer
            </span>
            <span className="text-xs text-[var(--foreground-muted)]" style={{ fontFamily: MONO }}>
              Autonomous agent PRs per day
            </span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={agentPRLayerData.rows}
                margin={{ top: 4, right: 30, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="var(--border)"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={[0, Math.max(agentPRLayerData.rows.length - 1, 1)]}
                  ticks={getTickIndices(agentPRLayerData.rows as Array<{ date: string }>)}
                  tickFormatter={(idx: number) => {
                    const d = agentPRLayerData.rows[idx]
                    return d ? formatTick(String(d.date), agentPRLayerData.rows.length) : ''
                  }}
                  tick={{ fontSize: 10, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  height={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--foreground-subtle)', fontFamily: MONO }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: MONO,
                    color: 'var(--foreground)',
                    padding: '6px 10px',
                  }}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload as { fullLabel?: string } | undefined
                    return item?.fullLabel ?? String(_label)
                  }}
                  formatter={(value: number | undefined, name?: string) => [
                    `${(value ?? 0).toLocaleString()} PRs`,
                    name ?? '',
                  ]}
                />
                {agentPRLayerData.tools.map((tool) => (
                  <Line
                    key={tool}
                    type="monotone"
                    dataKey={tool}
                    name={tool}
                    stroke={LAYER_COLORS[tool] ?? 'var(--foreground-subtle)'}
                    strokeWidth={1.5}
                    dot={{ r: 4, fill: LAYER_COLORS[tool] ?? 'var(--foreground-subtle)', stroke: 'none' }}
                    activeDot={{ r: 5, fill: LAYER_COLORS[tool] ?? 'var(--foreground-subtle)', stroke: 'none' }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {agentPRLayerData.tools.map((tool) => (
              <span key={tool} className="flex items-center gap-1.5 text-[10px]" style={{ fontFamily: MONO, color: 'var(--foreground-muted)' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LAYER_COLORS[tool] ?? 'var(--foreground-subtle)' }} />
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
