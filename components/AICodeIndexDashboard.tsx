'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

import AICodeIndexChart from '@/components/AICodeIndexChart'
import MarketShareChart from '@/components/MarketShareChart'
import { TOOL_COLORS } from '@/lib/colors'

// --- Types ---

interface AdoptionTimeSeriesEntry {
  tool: string
  date: string
  count: number
}

interface ConfigAdoptionRow {
  tool: string
  count: number
  date: string
}

interface LogEntry {
  timestamp: string
  level: 'INFO' | 'SIGNAL' | 'ALERT'
  tag: string
  message: string
}

interface ToolStats {
  name: string
  color: string
  totalCommits: number
  latestDaily: number
  avg30d: number
  avg30dPrior: number
  trendPct: number
  trend: 'up' | 'down' | 'flat'
  peakDay: { date: string; count: number }
  share30d: number
  wowPct: number
  priorWowPct: number
  acceleration: 'accel' | 'decel' | 'steady'
  doublingDays: number | null
}

interface CompositeScore {
  name: string
  color: string
  score: number
  volumeZ: number
  momentumZ: number
  accelZ: number
  consistencyZ: number
}

interface ConvergenceAlert {
  tool: string
  level: 'red' | 'orange' | 'yellow'
  signals: string[]
  headline: string
}

export interface AICodeIndexDashboardProps {
  chartData: Array<{ date: string; [tool: string]: number | string }>
  configData: ConfigAdoptionRow[]
  sdkData: ConfigAdoptionRow[]
  configTimeSeries: AdoptionTimeSeriesEntry[]
  sdkTimeSeries: AdoptionTimeSeriesEntry[]
  agentPRData: ConfigAdoptionRow[]
  agentPRTimeSeries: AdoptionTimeSeriesEntry[]
  buzzData: Array<{ tool: string; mentions: number; hn: number; reddit: number; ghDiscussions: number }>
}

// --- Constants ---

// TOOL_COLORS imported from @/lib/colors


const CONFIG_FILES: Record<string, string> = {
  'AGENTS.md': 'Claude Code + Codex',
  'Claude Code': 'CLAUDE.md',
  'Cursor': '.cursorrules',
  'GitHub Copilot': 'copilot-instructions.md',
  'Windsurf': '.windsurfrules',
  'Aider': '.aider.conf.yml',
}

// Context notes used by intelligence brief seed
const CONTEXT_NOTES = [
  { tag: 'CURSOR', headline: 'Cursor 2.4 silently enables Co-Authored-By for all users — Jan spike is attribution, not usage growth' },
  { tag: 'CLAUDE', headline: 'Claude Code accounts for 90%+ of all tracked AI commits — only tool with attribution on by default since day one' },
  { tag: 'COPILOT', headline: 'Copilot coding agent went GA Sep 2025 but barely registers in commits — most usage is inline completions' },
  { tag: 'CODEX', headline: 'Codex CLI open-sourced Apr 2025 but attribution is opt-in — chart understates real usage' },
  { tag: 'AIDER', headline: 'Aider enabled Co-Authored-By Nov 2024 — longest attribution history in the index, steady baseline' },
]

// --- Helpers ---

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  if (Math.abs(n) >= 10_000) return `${sign}${Math.round(n / 1000)}k%`
  if (Math.abs(n) >= 100) return `${sign}${Math.round(n)}%`
  return `${sign}${n.toFixed(1)}%`
}



// --- Compute functions ---

function computeToolStats(data: Array<{ date: string; [tool: string]: number | string }>): ToolStats[] {
  const tools = Object.keys(TOOL_COLORS)
  const last7 = data.slice(-7)
  const prior7 = data.slice(-14, -7)
  const weekBefore = data.slice(-21, -14)
  const last30 = data.slice(-30)
  const prior30 = data.slice(-60, -30)

  const total30dCommits = tools.reduce((sum, tool) => {
    return sum + last30.reduce((s, row) => s + ((row[tool] as number) || 0), 0)
  }, 0)

  return tools.map((tool) => {
    const totalCommits = data.reduce((sum, row) => sum + ((row[tool] as number) || 0), 0)
    const latestDaily = last30.length > 0 ? ((last30[last30.length - 1][tool] as number) || 0) : 0
    const sum30d = last30.reduce((s, row) => s + ((row[tool] as number) || 0), 0)
    const avg30d = last30.length > 0 ? sum30d / last30.length : 0
    const sum30dPrior = prior30.reduce((s, row) => s + ((row[tool] as number) || 0), 0)
    const avg30dPrior = prior30.length > 0 ? sum30dPrior / prior30.length : 0

    const trendPct = avg30dPrior > 0 ? ((avg30d - avg30dPrior) / avg30dPrior) * 100 : 0
    const trend: 'up' | 'down' | 'flat' = trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'flat'

    let peakDay = { date: '', count: 0 }
    for (const row of data) {
      const count = (row[tool] as number) || 0
      if (count > peakDay.count) peakDay = { date: row.date, count }
    }

    const share30d = total30dCommits > 0 ? (sum30d / total30dCommits) * 100 : 0

    const avgThisWeek = last7.length > 0
      ? last7.reduce((s, row) => s + ((row[tool] as number) || 0), 0) / last7.length : 0
    const avgLastWeek = prior7.length > 0
      ? prior7.reduce((s, row) => s + ((row[tool] as number) || 0), 0) / prior7.length : 0
    const avgWeekBefore = weekBefore.length > 0
      ? weekBefore.reduce((s, row) => s + ((row[tool] as number) || 0), 0) / weekBefore.length : 0
    const wowPct = avgLastWeek > 0 ? ((avgThisWeek - avgLastWeek) / avgLastWeek) * 100 : 0
    const priorWowPct = avgWeekBefore > 0 ? ((avgLastWeek - avgWeekBefore) / avgWeekBefore) * 100 : 0

    const accelDelta = wowPct - priorWowPct
    const acceleration: 'accel' | 'decel' | 'steady' =
      accelDelta > 3 ? 'accel' : accelDelta < -3 ? 'decel' : 'steady'

    let doublingDays: number | null = null
    if (trendPct > 0 && avg30dPrior > 0) {
      doublingDays = Math.round(30 * Math.log(2) / Math.log(1 + trendPct / 100))
    }

    return {
      name: tool, color: TOOL_COLORS[tool], totalCommits, latestDaily, avg30d, avg30dPrior,
      trendPct, trend, peakDay, share30d, wowPct, priorWowPct, acceleration, doublingDays,
    }
  }).filter((t) => t.totalCommits > 0)
}

function computeCompositeScores(
  stats: ToolStats[],
  data: Array<{ date: string; [tool: string]: number | string }>
): CompositeScore[] {
  if (stats.length < 2) return []
  const last30 = data.slice(-30)

  const raw = stats.map((tool) => {
    const volume = tool.avg30d > 0 ? Math.log10(tool.avg30d) : 0
    const momentum = tool.trendPct
    const accel = tool.wowPct
    const dailyValues = last30.map((row) => (row[tool.name] as number) || 0)
    const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length
    const variance = dailyValues.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyValues.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1
    const consistency = 1 / (1 + cv)
    return { name: tool.name, color: tool.color, volume, momentum, accel, consistency }
  })

  function zScores(values: number[]): number[] {
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    const std = Math.sqrt(variance)
    if (std === 0) return values.map(() => 0)
    return values.map((v) => (v - mean) / std)
  }

  const volumeZ = zScores(raw.map((r) => r.volume))
  const momentumZ = zScores(raw.map((r) => r.momentum))
  const accelZ = zScores(raw.map((r) => r.accel))
  const consistencyZ = zScores(raw.map((r) => r.consistency))

  return raw.map((r, i) => {
    const rawScore = 0.35 * volumeZ[i] + 0.25 * momentumZ[i] + 0.20 * accelZ[i] + 0.20 * consistencyZ[i]
    const score = Math.max(0, Math.min(100, 50 + rawScore * 15))
    return {
      name: r.name, color: r.color, score: Math.round(score * 10) / 10,
      volumeZ: volumeZ[i], momentumZ: momentumZ[i], accelZ: accelZ[i], consistencyZ: consistencyZ[i],
    }
  }).sort((a, b) => b.score - a.score)
}

function computeAdoptionVelocity(
  timeSeries: AdoptionTimeSeriesEntry[],
  tool: string
): { weeklyGrowthPct: number | null } {
  const entries = timeSeries
    .filter((e) => e.tool === tool)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (entries.length < 2) return { weeklyGrowthPct: null }
  const last = entries[entries.length - 1]
  const lastDate = new Date(last.date).getTime()
  let bestIdx = 0
  let bestDiff = Infinity
  for (let i = 0; i < entries.length - 1; i++) {
    const diff = Math.abs(lastDate - new Date(entries[i].date).getTime() - 7 * 86400000)
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
  }
  const prior = entries[bestIdx]
  if (prior.count === 0) return { weeklyGrowthPct: null }
  return { weeklyGrowthPct: ((last.count - prior.count) / prior.count) * 100 }
}

function computeConvergenceAlerts(
  stats: ToolStats[],
  configTimeSeries: AdoptionTimeSeriesEntry[],
  agentPRData: ConfigAdoptionRow[],
  buzzData: Array<{ tool: string; mentions: number }>,
): ConvergenceAlert[] {
  const alerts: ConvergenceAlert[] = []
  const AI_TOOLS = ['Claude Code', 'Cursor', 'GitHub Copilot', 'Aider', 'Gemini CLI', 'Devin', 'Codex']
  for (const tool of AI_TOOLS) {
    const signals: string[] = []
    const stat = stats.find((s) => s.name === tool)
    if (stat && stat.trendPct > 10) signals.push(`commits ${formatPct(stat.trendPct)} (30d)`)
    if (stat && stat.wowPct > 15) signals.push(`WoW ${formatPct(stat.wowPct)}`)
    const configVelocity = computeAdoptionVelocity(configTimeSeries, tool)
    if (configVelocity.weeklyGrowthPct !== null && configVelocity.weeklyGrowthPct > 5)
      signals.push(`config files ${formatPct(configVelocity.weeklyGrowthPct)}/wk`)
    const agentData = agentPRData.find((a) => a.tool === tool)
    if (agentData && agentData.count > 100) signals.push(`${formatNum(agentData.count)} agent PRs/day`)
    const buzzEntry = buzzData.find((h) => h.tool === tool)
    if (buzzEntry && buzzEntry.mentions >= 10) signals.push(`${buzzEntry.mentions} community mentions (7d)`)
    if (stat && stat.share30d > 50) signals.push(`${stat.share30d.toFixed(0)}% market share`)
    if (signals.length >= 4) {
      alerts.push({ tool, level: signals.length >= 5 ? 'red' : 'orange', signals, headline: `${signals.length} converging signals` })
    } else if (signals.length === 3) {
      alerts.push({ tool, level: 'yellow', signals, headline: signals.join(', ') })
    }
  }
  return alerts.sort((a, b) => b.signals.length - a.signals.length)
}

// --- Sub-components ---

function Panel({ title, tag, children, className = '' }: {
  title: string; tag: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`terminal-panel ${className}`}>
      <div className="panel-header">
        <div className="panel-title">
          <span className="text-[var(--foreground-subtle)]">{'//'}</span> {title}
        </div>
        <div className="panel-tag">{tag}</div>
      </div>
      <div className="p-4 terminal-scrollbar overflow-auto">
        {children}
      </div>
    </div>
  )
}

function ProgressBar({ percent, colorClass = 'bg-[var(--accent)]' }: { percent: number; colorClass?: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-white/5 rounded-sm overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <div className="text-[10px] text-[var(--foreground-subtle)] w-8 text-right">{Math.round(percent)}%</div>
    </div>
  )
}

function AsciiBar({ percent, colorClass = 'text-[var(--accent)]' }: { percent: number; colorClass?: string }) {
  const total = 10
  const filled = Math.round((percent / 100) * total)
  return (
    <div className={`font-mono text-[10px] ${colorClass}`}>
      {'█'.repeat(filled)}{'░'.repeat(total - filled)}
    </div>
  )
}

// --- Main Dashboard ---

export default function AICodeIndexDashboard({
  chartData,
  configData,
  sdkData,
  configTimeSeries,
  sdkTimeSeries,
  agentPRData,
  agentPRTimeSeries,
  buzzData,
}: AICodeIndexDashboardProps) {
  const [highlightedTool, setHighlightedTool] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [flashStates, setFlashStates] = useState<Record<string, 'green' | 'red' | null>>({})
  const [latestOverrides, setLatestOverrides] = useState<Record<string, number>>({})
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // Computed data
  const stats = useMemo(() => chartData.length >= 2 ? computeToolStats(chartData) : [], [chartData])
  const compositeScores = useMemo(() => computeCompositeScores(stats, chartData), [stats, chartData])
  const convergenceAlerts = useMemo(() => computeConvergenceAlerts(stats, configTimeSeries, agentPRData, buzzData), [stats, configTimeSeries, agentPRData, buzzData])


  const byVolume = useMemo(() => [...stats].sort((a, b) => b.avg30d - a.avg30d), [stats])
  const byMomentum = useMemo(() => [...stats].filter((t) => t.avg30d > 0).sort((a, b) => b.trendPct - a.trendPct), [stats])

  // Filtered tools for command bar
  const filteredByVolume = useMemo(() => {
    if (!filterQuery) return byVolume
    return byVolume.filter(t => t.name.toLowerCase().includes(filterQuery.toLowerCase()))
  }, [byVolume, filterQuery])


  // Intelligence brief log feed
  useEffect(() => {
    const toolNames = stats.map(t => t.name)
    if (toolNames.length === 0) return

    // Seed initial logs with convergence alerts
    const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false })
    const seed: LogEntry[] = [
      { timestamp: ts(), level: 'INFO', tag: 'SYS', message: 'Dashboard initialized. All nodes reporting.' },
      { timestamp: ts(), level: 'INFO', tag: 'IDX', message: `Tracking ${toolNames.length} AI coding tools across public GitHub.` },
      ...convergenceAlerts.map(a => ({
        timestamp: ts(),
        level: (a.level === 'red' ? 'ALERT' : a.level === 'orange' ? 'SIGNAL' : 'INFO') as LogEntry['level'],
        tag: a.tool.split(' ')[0].toUpperCase(),
        message: `${a.signals.length} converging signals: ${a.signals.slice(0, 2).join(', ')}`,
      })),
      ...CONTEXT_NOTES.slice(0, 2).map(n => ({
        timestamp: ts(),
        level: 'INFO' as const,
        tag: n.tag,
        message: n.headline,
      })),
    ]
    setLogs(seed)

    const messages = [
      (t: string) => `Commit spike detected on ${t} — checking persistence.`,
      (t: string) => `${t} agent activity elevated. Monitoring.`,
      (t: string) => `Config file adoption for ${t} up this week.`,
      (t: string) => `New community mention cluster: ${t}.`,
      (t: string) => `WoW velocity shift on ${t}. Recalculating momentum.`,
      (t: string) => `Node ${t} heartbeat OK.`,
      (t: string) => `${t} market share stable at current level.`,
    ]

    const timer = setInterval(() => {
      const tool = toolNames[Math.floor(Math.random() * toolNames.length)]
      const msg = messages[Math.floor(Math.random() * messages.length)](tool)
      const level: LogEntry['level'] = Math.random() > 0.85 ? 'SIGNAL' : Math.random() > 0.95 ? 'ALERT' : 'INFO'
      setLogs(prev => [{
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        level,
        tag: level === 'ALERT' ? 'WARN' : 'SYS',
        message: msg,
      }, ...prev].slice(0, 30))
    }, 3000)

    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.length])

  // Simulated number flicker on "latest" cells
  useEffect(() => {
    if (stats.length === 0) return
    const timer = setInterval(() => {
      const tool = stats[Math.floor(Math.random() * stats.length)]
      const change = (Math.random() - 0.45) * Math.max(5, tool.latestDaily * 0.01)
      const newVal = Math.max(0, Math.round(tool.latestDaily + change))
      setLatestOverrides(prev => ({ ...prev, [tool.name]: newVal }))

      if (Math.abs(change) > 1) {
        const key = tool.name
        setFlashStates(f => ({ ...f, [key]: change > 0 ? 'green' : 'red' }))
        setTimeout(() => setFlashStates(f => ({ ...f, [key]: null })), 1000)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [stats])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(prev => !prev)
      }
      if (e.key === 'Escape') setIsCommandPaletteOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Command bar handler
  const handleCommand = useCallback((value: string) => {
    const lower = value.toLowerCase().trim()
    if (lower.startsWith('filter ')) {
      setFilterQuery(lower.replace('filter ', ''))
    } else if (lower === 'reset') {
      setFilterQuery('')
      setHighlightedTool(null)
    }
  }, [])

  const liveNodeCount = stats.length

  const lastSyncLabel = useMemo(() => {
    const now = new Date()
    const sync = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 5, 0))
    if (sync > now) sync.setUTCDate(sync.getUTCDate() - 1)
    return sync.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  }, [])

  if (chartData.length < 2) {
    return (
      <div className="py-16 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs text-[var(--foreground-subtle)]">
          No data — run <code className="text-[var(--accent)]">npx tsx scripts/search-commits.ts</code> to start collecting.
        </p>
      </div>
    )
  }

  return (
    <div
      className="terminal-dashboard min-h-screen flex flex-col"
      data-theme="dark"
      style={{
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* MAIN GRID */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1800px] mx-auto w-full">

        {/* LEFT COLUMN (8/12) */}
        <div className="lg:col-span-8 space-y-4">

          {/* COMMIT VOLUME INDEX */}
          <Panel title="COMMIT_VOLUME_INDEX" tag="LIVE_FEED">
            <div className="overflow-x-auto terminal-scrollbar">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="text-[var(--foreground-subtle)] border-b uppercase" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-2 font-normal hidden md:table-cell">NODE</th>
                    <th className="pb-2 font-normal">TOOL_NAME</th>
                    <th className="pb-2 font-normal text-right">LATEST</th>
                    <th className="pb-2 font-normal text-right hidden md:table-cell">AVG/DAY</th>
                    <th className="pb-2 font-normal text-right hidden md:table-cell">30D_VOL</th>
                    <th className="pb-2 font-normal text-right">WoW%</th>
                    <th className="pb-2 font-normal text-right">SHARE</th>
                    <th className="pb-2 font-normal text-center hidden md:table-cell">SCORE</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredByVolume.map((tool, i) => {
                    const score = compositeScores.find((s) => s.name === tool.name)
                    const latestVal = latestOverrides[tool.name] ?? tool.latestDaily
                    const flash = flashStates[tool.name]
                    const isHighlighted = highlightedTool === tool.name
                    return (
                      <tr
                        key={tool.name}
                        className={`group cursor-pointer transition-colors ${isHighlighted ? 'bg-[var(--accent)]/10' : 'hover:bg-white/5'}`}
                        onClick={() => setHighlightedTool(prev => prev === tool.name ? null : tool.name)}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="py-3 md:py-2 text-[var(--foreground-subtle)] hidden md:table-cell">[{String(i).padStart(2, '0')}]</td>
                        <td className="py-3 md:py-2 font-bold" style={{ color: tool.color }}>
                          {tool.name}
                        </td>
                        <td className={`py-3 md:py-2 text-right tabular-nums ${flash === 'green' ? 'flash-green' : flash === 'red' ? 'flash-red' : ''}`}>
                          {formatNum(latestVal)}
                        </td>
                        <td className="py-3 md:py-2 text-right tabular-nums text-[var(--foreground-subtle)] hidden md:table-cell">{formatNum(Math.round(tool.avg30d))}</td>
                        <td className="py-3 md:py-2 text-right tabular-nums hidden md:table-cell">{formatNum(Math.round(tool.avg30d * 30))}</td>
                        <td className={`py-3 md:py-2 text-right tabular-nums ${tool.wowPct > 3 ? 'text-[var(--score-high)]' : tool.wowPct < -3 ? 'text-[var(--error)]' : 'text-[var(--foreground-subtle)]'}`}>
                          {formatPct(tool.wowPct)}
                          <span className="ml-0.5 text-[9px]">
                            {tool.acceleration === 'accel' ? '▲' : tool.acceleration === 'decel' ? '▼' : ''}
                          </span>
                        </td>
                        <td className="py-3 md:py-2 text-right tabular-nums text-[var(--badge-active)]">
                          {tool.share30d >= 0.1 ? `${tool.share30d.toFixed(1)}%` : '<0.1%'}
                        </td>
                        <td className="py-3 md:py-2 text-center hidden md:table-cell">
                          {score && (
                            <span className="text-[9px] px-1 py-0.5 rounded" style={{
                              background: score.score >= 65 ? 'color-mix(in srgb, var(--score-high) 10%, transparent)' : score.score >= 40 ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'color-mix(in srgb, var(--foreground-subtle) 10%, transparent)',
                              color: score.score >= 65 ? 'var(--score-high)' : score.score >= 40 ? 'var(--accent)' : 'var(--foreground-subtle)',
                            }}>
                              {score.score.toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[9px] text-[var(--foreground-subtle)] tracking-wider uppercase">
              SCORE = VOLUME (35%) · MOMENTUM (25%) · ACCELERATION (20%) · CONSISTENCY (20%)
            </p>
          </Panel>

          {/* DAILY COMMIT CHART — full width */}
          <Panel title="DAILY_COMMIT_VOLUME" tag="TIME_SERIES">
            <AICodeIndexChart data={chartData} configTimeSeries={configTimeSeries} agentPRTimeSeries={agentPRTimeSeries} />
          </Panel>

          {/* 2-COL: AGENT ACTIVITY + CONFIG ADOPTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="AI_AGENT_ACTIVITY" tag="AUTONOMOUS">
              <div className="text-[9px] text-[var(--foreground-subtle)] mb-2 uppercase italic">PULL_REQUESTS CREATED AUTONOMOUSLY — NO HUMAN CO-AUTHOR</div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-[var(--foreground-subtle)] border-b text-left uppercase" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-1 font-normal">AGENT</th>
                    <th className="pb-1 font-normal text-right">PRs/DAY</th>
                    <th className="pb-1 font-normal text-right">Δ/WK</th>
                    <th className="pb-1 font-normal text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[...agentPRData].sort((a, b) => b.count - a.count).map(agent => {
                    const velocity = computeAdoptionVelocity(agentPRTimeSeries, agent.tool)
                    return (
                      <tr
                        key={agent.tool}
                        className={`cursor-pointer transition-colors ${highlightedTool === agent.tool ? 'bg-[var(--accent)]/10' : 'hover:bg-white/5'}`}
                        onClick={() => setHighlightedTool(prev => prev === agent.tool ? null : agent.tool)}
                      >
                        <td className="py-2 font-bold" style={{ color: TOOL_COLORS[agent.tool] ?? 'var(--foreground)' }}>{agent.tool}</td>
                        <td className="py-2 text-right tabular-nums">{formatNum(agent.count)}</td>
                        <td className="py-2 text-right" style={{
                          color: velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct > 0.5 ? 'var(--score-high)'
                            : velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct < -0.5 ? 'var(--error)' : 'var(--foreground-subtle)',
                        }}>
                          {velocity.weeklyGrowthPct !== null ? formatPct(velocity.weeklyGrowthPct) : '—'}
                        </td>
                        <td className="py-2 text-center">
                          <span className="text-[8px] px-1 rounded bg-[var(--accent)]/10 text-[var(--accent)]">ACTIVE</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>

            <Panel title="CONFIG_FILE_ADOPTION" tag="ECOSYSTEM">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="text-[var(--foreground-subtle)] border-b uppercase" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-2 font-normal">FILE</th>
                    <th className="pb-2 font-normal text-right">REPOS</th>
                    <th className="pb-2 font-normal text-right whitespace-nowrap">Δ/WK</th>
                    <th className="pb-2 font-normal pl-3">BAR</th>
                    <th className="pb-2 font-normal text-right">SHARE</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[...configData].sort((a, b) => b.count - a.count).map(row => {
                    const velocity = computeAdoptionVelocity(configTimeSeries, row.tool)
                    const maxCount = Math.max(...configData.map(c => c.count))
                    const percent = maxCount > 0 ? (row.count / maxCount) * 100 : 0
                    return (
                      <tr key={row.tool} className="hover:bg-white/5">
                        <td className="py-3 font-bold text-[var(--badge-active)] text-[10px] md:text-[10px]">{CONFIG_FILES[row.tool] ?? row.tool}</td>
                        <td className="py-3 text-right tabular-nums">{formatNum(row.count)}</td>
                        <td className="py-3 text-right tabular-nums whitespace-nowrap" style={{
                          color: velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct > 0.5 ? 'var(--score-high)' : 'var(--foreground-subtle)',
                        }}>
                          {velocity.weeklyGrowthPct !== null ? formatPct(velocity.weeklyGrowthPct) : '—'}
                        </td>
                        <td className="py-3 pl-3 w-20 md:w-28">
                          <div className="h-2 bg-white/5 rounded-sm overflow-hidden" style={{ minWidth: 6 }}>
                            <div className="h-full bg-[var(--badge-active)] transition-all duration-1000" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
                          </div>
                        </td>
                        <td className="py-3 text-right text-[10px] text-[var(--foreground-subtle)] tabular-nums w-10">{Math.round(percent)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          </div>

          {/* MARKET SHARE OVER TIME */}
          <Panel title="MARKET_SHARE_OVER_TIME" tag="TREND">
            <MarketShareChart data={chartData} />
          </Panel>
        </div>

        {/* RIGHT COLUMN (4/12) */}
        <div className="lg:col-span-4 space-y-4">

          {/* MARKET SHARE 30D - Visual bars */}
          <Panel title="MARKET_SHARE_30D" tag="VISUAL_MAP">
            <div className="space-y-4">
              {byVolume.filter(t => t.share30d >= 0.1).map(tool => (
                <div
                  key={tool.name}
                  className={`space-y-1 cursor-pointer transition-opacity ${highlightedTool === tool.name ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                  onClick={() => setHighlightedTool(prev => prev === tool.name ? null : tool.name)}
                >
                  <div className="flex justify-between text-[10px]">
                    <span className="font-bold" style={{ color: tool.color }}>{tool.name}</span>
                    <span className="text-[var(--badge-active)]">{tool.share30d.toFixed(1)}%</span>
                  </div>
                  <ProgressBar percent={tool.share30d} colorClass={`bg-[${tool.color}]`} />
                </div>
              ))}
            </div>
          </Panel>

          {/* MOMENTUM 30D */}
          <Panel title="MOMENTUM_30D" tag="RANKED">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="text-[var(--foreground-subtle)] border-b text-left uppercase" style={{ borderColor: 'var(--border)' }}>
                  <th className="pb-1 font-normal">RANK</th>
                  <th className="pb-1 font-normal">TOOL</th>
                  <th className="pb-1 font-normal text-right">30D_CHANGE</th>
                  <th className="pb-1 font-normal text-center">TREND_BAR</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {byMomentum.map((tool, i) => (
                  <tr
                    key={tool.name}
                    className={`cursor-pointer transition-colors ${highlightedTool === tool.name ? 'bg-[var(--accent)]/10' : 'hover:bg-white/5'}`}
                    onClick={() => setHighlightedTool(prev => prev === tool.name ? null : tool.name)}
                  >
                    <td className="py-1.5 text-[var(--foreground-subtle)]">#{i + 1}</td>
                    <td className="py-1.5 font-bold" style={{ color: tool.color }}>{tool.name}</td>
                    <td className={`py-1.5 text-right ${tool.trendPct > 0 ? 'text-[var(--score-high)]' : 'text-[var(--error)]'}`}>
                      {formatPct(tool.trendPct)}
                    </td>
                    <td className="py-1.5 text-center">
                      <AsciiBar
                        percent={Math.min(100, Math.abs(tool.trendPct) / 3)}
                        colorClass={tool.trendPct > 0 ? 'text-[var(--accent)]' : 'text-[var(--error)]'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* INTELLIGENCE BRIEF */}
          <Panel title="INTELLIGENCE_BRIEF" tag="TAIL_F" className="h-64 flex flex-col">
            <div ref={logRef} className="flex-1 overflow-y-auto terminal-scrollbar space-y-1 text-[9px]">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2" style={{ animation: i === 0 ? 'fade-in 0.5s ease-out' : undefined }}>
                  <span className="text-[var(--foreground-subtle)]">[{log.timestamp}]</span>
                  <span className="font-bold" style={{
                    color: log.level === 'SIGNAL' ? 'var(--badge-active)' : log.level === 'ALERT' ? 'var(--error)' : 'var(--accent)',
                  }}>{log.level}</span>
                  <span className="text-[var(--foreground-subtle)]">[{log.tag}]</span>
                  <span className="text-[var(--foreground)]">{log.message}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* DOUBLING TIME */}
          <Panel title="DOUBLING_TIME" tag="VELOCITY">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="text-[var(--foreground-subtle)] border-b text-left uppercase" style={{ borderColor: 'var(--border)' }}>
                  <th className="pb-1 font-normal">TOOL</th>
                  <th className="pb-1 font-normal text-right">DAYS_TO_2X</th>
                  <th className="pb-1 font-normal text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {[...stats]
                  .filter(t => t.doublingDays !== null && t.avg30d > 0)
                  .sort((a, b) => (a.doublingDays ?? Infinity) - (b.doublingDays ?? Infinity))
                  .map(tool => {
                    const status = (tool.doublingDays ?? 999) <= 30 ? 'FAST' : (tool.doublingDays ?? 999) <= 90 ? 'STEADY' : 'SLOWING'
                    return (
                      <tr
                        key={tool.name}
                        className={`cursor-pointer transition-colors ${highlightedTool === tool.name ? 'bg-[var(--accent)]/10' : 'hover:bg-white/5'}`}
                        onClick={() => setHighlightedTool(prev => prev === tool.name ? null : tool.name)}
                      >
                        <td className="py-2 font-bold" style={{ color: tool.color }}>{tool.name}</td>
                        <td className="py-2 text-right text-[var(--accent)]">{tool.doublingDays}d</td>
                        <td className="py-2 text-center">
                          <span className={`text-[8px] px-1 rounded ${status === 'FAST' ? 'bg-[var(--score-high)]/10 text-[var(--score-high)]' : status === 'STEADY' ? 'bg-[var(--badge-active)]/10 text-[var(--badge-active)]' : 'bg-[var(--score-mid)]/10 text-[var(--score-mid)]'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                {stats.filter(t => t.doublingDays === null && t.avg30d > 0).length > 0 && (
                  <tr>
                    <td colSpan={3} className="py-1.5 text-[9px] text-[var(--foreground-subtle)]">
                      {stats.filter(t => t.doublingDays === null && t.avg30d > 0).map(t => t.name).join(', ')} — flat/declining
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>

          {/* COMMUNITY PULSE */}
          {buzzData.length > 0 && (
            <Panel title="COMMUNITY_PULSE" tag="SIGNAL">
              <div className="text-[9px] text-[var(--foreground-subtle)] mb-2 uppercase italic">MENTIONS ACROSS HN · REDDIT · GH_DISCUSSIONS — LAST 7 DAYS</div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-[var(--foreground-subtle)] border-b text-left uppercase" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-1 font-normal">TOOL</th>
                    <th className="pb-1 font-normal text-right">TOTAL</th>
                    <th className="pb-1 font-normal text-right">HN</th>
                    <th className="pb-1 font-normal text-right">REDDIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[...buzzData].sort((a, b) => b.mentions - a.mentions).map(c => (
                    <tr
                      key={c.tool}
                      className={`cursor-pointer transition-colors ${highlightedTool === c.tool ? 'bg-[var(--accent)]/10' : 'hover:bg-white/5'}`}
                      onClick={() => setHighlightedTool(prev => prev === c.tool ? null : c.tool)}
                    >
                      <td className="py-2 font-bold" style={{ color: TOOL_COLORS[c.tool] ?? 'var(--foreground)' }}>{c.tool}</td>
                      <td className="py-2 text-right font-bold text-[var(--accent)]">{c.mentions}</td>
                      <td className="py-2 text-right text-[var(--foreground-subtle)]">{c.hn}</td>
                      <td className="py-2 text-right text-[var(--foreground-subtle)]">{c.reddit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {/* SDK ADOPTION */}
          {sdkData.length > 0 && (
            <Panel title="SDK_ADOPTION" tag="INFRA">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-[var(--foreground-subtle)] border-b text-left uppercase" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-1 font-normal">SDK</th>
                    <th className="pb-1 font-normal text-right">REPOS</th>
                    <th className="pb-1 font-normal text-right">Δ/WK</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[...sdkData].sort((a, b) => b.count - a.count).map(row => {
                    const velocity = computeAdoptionVelocity(sdkTimeSeries, row.tool)
                    return (
                      <tr key={row.tool} className="hover:bg-white/5">
                        <td className="py-2 font-bold">{row.tool}</td>
                        <td className="py-2 text-right tabular-nums">{formatNum(row.count)}</td>
                        <td className="py-2 text-right" style={{
                          color: velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct > 0.5 ? 'var(--score-high)' : 'var(--foreground-subtle)',
                        }}>
                          {velocity.weeklyGrowthPct !== null ? formatPct(velocity.weeklyGrowthPct) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </main>

      {/* COMMAND BAR — full on desktop, status-only on mobile */}
      <footer
        className="h-10 flex items-center px-4 z-50 fixed bottom-0 left-0 right-0"
        style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}
      >
        <div className="text-[var(--accent)] mr-3 font-bold">❯</div>
        <input
          type="text"
          placeholder='ENTER COMMAND (e.g. "filter cursor", "reset")...'
          className="hidden md:block bg-transparent border-none outline-none flex-1 text-[var(--foreground)] text-[11px] placeholder:text-[var(--foreground-subtle)] uppercase tracking-wider"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommand(e.currentTarget.value)
              e.currentTarget.value = ''
            }
          }}
        />
        <span className="md:hidden flex-1 text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider">GITFIND.AI</span>
        <div className="flex items-center gap-4 text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider ml-4">
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="sys-status-dot" style={{ width: 5, height: 5 }} />
            <span className="text-[var(--accent)]">SYS_OK</span>
          </div>
          <span className="hidden lg:inline text-[var(--border)]">·</span>
          <span className="hidden lg:inline">LAST_SYNC: {lastSyncLabel}</span>
          <span className="hidden lg:inline text-[var(--border)]">·</span>
          <span className="hidden sm:inline">TOOLS: {liveNodeCount}</span>
          <span className="hidden sm:inline text-[var(--border)]">·</span>
          <div className="flex items-center gap-1 cursor-pointer hover:text-[var(--accent)]" onClick={() => setIsCommandPaletteOpen(true)}>
            <span>⌘K: KEYS</span>
          </div>
        </div>
      </footer>

      {/* COMMAND PALETTE */}
      {isCommandPaletteOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div className="terminal-panel w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div className="panel-title">COMMAND_PALETTE</div>
              <div className="panel-tag" onClick={() => setIsCommandPaletteOpen(false)}>ESC: CLOSE</div>
            </div>
            <div className="p-4 space-y-2">
              {[
                { cmd: 'filter [tool]', desc: 'Filter dashboard by tool name' },
                { cmd: 'reset', desc: 'Clear all filters and highlights' },
                { cmd: 'help', desc: 'Show full documentation' },
              ].map(item => (
                <div key={item.cmd} className="flex justify-between items-center p-2 hover:bg-white/5 rounded cursor-pointer">
                  <span className="text-[var(--accent)] font-bold text-[11px]">{item.cmd}</span>
                  <span className="text-[var(--foreground-subtle)] text-[10px]">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
