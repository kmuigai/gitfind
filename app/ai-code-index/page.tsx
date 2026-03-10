import type { Metadata } from 'next'
import Link from 'next/link'
import { getAICodeIndexData, getConfigAdoptionData, getSDKAdoptionData, getConfigAdoptionTimeSeries, getSDKAdoptionTimeSeries, getAgentPRData, getAgentPRTimeSeries, getAggregateKPIs, getHNBuzzData } from '@/lib/queries'
import type { AdoptionTimeSeriesEntry } from '@/lib/queries'
import AICodeIndexChart from '@/components/AICodeIndexChart'
import MarketShareChart from '@/components/MarketShareChart'
import NewsletterSignup from '@/components/NewsletterSignup'

export const metadata: Metadata = {
  title: 'AI Code Index — AI Coding Tool Adoption Tracker | GitFind',
  description:
    'Track which AI coding tools developers actually use. Daily commit volume, market share, and adoption data for Claude Code, Cursor, Copilot, and more.',
  openGraph: {
    title: 'AI Code Index — GitFind',
    description:
      'Which AI coding tool is winning? Live commit data across 7 tools on all public GitHub repos.',
    url: 'https://gitfind.ai/ai-code-index',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Code Index — GitFind',
    description:
      'The rise of AI-written code, tracked live across 7 tools.',
  },
}

export const revalidate = 3600

const TOOL_COLORS: Record<string, string> = {
  'Claude Code': '#6c6af6',
  'Cursor': '#f59e0b',
  'GitHub Copilot': '#3b82f6',
  'Aider': '#22c55e',
  'Gemini CLI': '#ef4444',
  'Devin': '#a855f7',
  'Codex': '#10b981',
  'CodeRabbit': '#f97316',
  'Sweep': '#ec4899',
  'Windsurf': '#06b6d4',
}

const TOOL_SLUGS: Record<string, string> = {
  'Claude Code': 'claude-code',
  'Cursor': 'cursor',
  'GitHub Copilot': 'copilot',
  'Aider': 'aider',
  'Gemini CLI': 'gemini-cli',
  'Devin': 'devin',
  'Codex': 'codex',
}

// Repos created since Claude Code launch (Feb 24 2025), via GitHub Search API (Mar 2026)

const CONFIG_FILES: Record<string, string> = {
  'AGENTS.md': 'Claude Code + Codex',
  'Claude Code': 'CLAUDE.md',
  'Cursor': '.cursorrules',
  'GitHub Copilot': 'copilot-instructions.md',
  'Windsurf': '.windsurfrules',
  'Aider': '.aider.conf.yml',
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
  // WoW + acceleration
  wowPct: number
  priorWowPct: number
  acceleration: 'accel' | 'decel' | 'steady'
  // Doubling time (days at current 30d growth rate)
  doublingDays: number | null
}

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
      if (count > peakDay.count) {
        peakDay = { date: row.date, count }
      }
    }

    const share30d = total30dCommits > 0 ? (sum30d / total30dCommits) * 100 : 0

    // WoW: this week avg vs last week avg
    const avgThisWeek = last7.length > 0
      ? last7.reduce((s, row) => s + ((row[tool] as number) || 0), 0) / last7.length
      : 0
    const avgLastWeek = prior7.length > 0
      ? prior7.reduce((s, row) => s + ((row[tool] as number) || 0), 0) / prior7.length
      : 0
    const avgWeekBefore = weekBefore.length > 0
      ? weekBefore.reduce((s, row) => s + ((row[tool] as number) || 0), 0) / weekBefore.length
      : 0
    const wowPct = avgLastWeek > 0 ? ((avgThisWeek - avgLastWeek) / avgLastWeek) * 100 : 0
    const priorWowPct = avgWeekBefore > 0 ? ((avgLastWeek - avgWeekBefore) / avgWeekBefore) * 100 : 0

    // Acceleration: is WoW growth speeding up or slowing down?
    const accelDelta = wowPct - priorWowPct
    const acceleration: 'accel' | 'decel' | 'steady' =
      accelDelta > 3 ? 'accel' : accelDelta < -3 ? 'decel' : 'steady'

    // Doubling time at current 30d growth rate
    // If 30d avg grew X% over 30 days, doubling time = 30 * ln(2) / ln(1 + X/100)
    let doublingDays: number | null = null
    if (trendPct > 0 && avg30dPrior > 0) {
      const growthRate = trendPct / 100
      doublingDays = Math.round(30 * Math.log(2) / Math.log(1 + growthRate))
    }

    return {
      name: tool,
      color: TOOL_COLORS[tool],
      totalCommits,
      latestDaily,
      avg30d,
      avg30dPrior,
      trendPct,
      trend,
      peakDay,
      share30d,
      wowPct,
      priorWowPct,
      acceleration,
      doublingDays,
    }
  }).filter((t) => t.totalCommits > 0)
}

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

function formatNumExact(n: number): string {
  return n.toLocaleString()
}

// Compute actual week-over-week adoption change
function computeAdoptionVelocity(
  timeSeries: AdoptionTimeSeriesEntry[],
  tool: string
): { weeklyGrowthPct: number | null; dataPoints: number } {
  const entries = timeSeries
    .filter((e) => e.tool === tool)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (entries.length < 2) return { weeklyGrowthPct: null, dataPoints: entries.length }

  const last = entries[entries.length - 1]
  const lastDate = new Date(last.date).getTime()

  // Find the entry closest to 7 days before the latest
  let bestIdx = 0
  let bestDiff = Infinity
  for (let i = 0; i < entries.length - 1; i++) {
    const diff = Math.abs(lastDate - new Date(entries[i].date).getTime() - 7 * 86400000)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = i
    }
  }

  const prior = entries[bestIdx]
  if (prior.count === 0) return { weeklyGrowthPct: null, dataPoints: entries.length }

  const weeklyGrowthPct = ((last.count - prior.count) / prior.count) * 100

  return { weeklyGrowthPct, dataPoints: entries.length }
}

// Composite AI Code Index Score — z-score weighted across 4 dimensions
interface CompositeScore {
  name: string
  color: string
  score: number
  volumeZ: number
  momentumZ: number
  accelZ: number
  consistencyZ: number
}

function computeCompositeScores(
  stats: ToolStats[],
  data: Array<{ date: string; [tool: string]: number | string }>
): CompositeScore[] {
  if (stats.length < 2) return []

  const last30 = data.slice(-30)

  // Compute raw values for each dimension
  const raw = stats.map((tool) => {
    // Volume: log scale of avg30d to compress dominance
    const volume = tool.avg30d > 0 ? Math.log10(tool.avg30d) : 0

    // Momentum: 30d trend %
    const momentum = tool.trendPct

    // Acceleration: WoW %
    const accel = tool.wowPct

    // Consistency: inverse coefficient of variation over last 30d
    const dailyValues = last30.map((row) => (row[tool.name] as number) || 0)
    const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length
    const variance = dailyValues.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyValues.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 1
    const consistency = 1 / (1 + cv)

    return { name: tool.name, color: tool.color, volume, momentum, accel, consistency }
  })

  // Z-score normalize each dimension
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

  // Weighted composite: volume 35%, momentum 25%, acceleration 20%, consistency 20%
  const composites = raw.map((r, i) => {
    const rawScore = 0.35 * volumeZ[i] + 0.25 * momentumZ[i] + 0.20 * accelZ[i] + 0.20 * consistencyZ[i]
    // Map to 0-100 scale (z-scores roughly -2 to +2, so multiply by 15 and center at 50)
    const score = Math.max(0, Math.min(100, 50 + rawScore * 15))
    return {
      name: r.name,
      color: r.color,
      score: Math.round(score * 10) / 10,
      volumeZ: volumeZ[i],
      momentumZ: momentumZ[i],
      accelZ: accelZ[i],
      consistencyZ: consistencyZ[i],
    }
  })

  return composites.sort((a, b) => b.score - a.score)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDateShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

// Convergence detection — when multiple signals spike for the same tool
interface ConvergenceAlert {
  tool: string
  level: 'red' | 'orange' | 'yellow'
  signals: string[]
  headline: string
}

function computeConvergenceAlerts(
  stats: ReturnType<typeof computeToolStats>,
  configTimeSeries: AdoptionTimeSeriesEntry[],
  agentPRData: Array<{ tool: string; count: number; date: string }>,
  hnBuzzData: Array<{ tool: string; mentions: number; points: number }>,
): ConvergenceAlert[] {
  const alerts: ConvergenceAlert[] = []

  const AI_TOOLS = ['Claude Code', 'Cursor', 'GitHub Copilot', 'Aider', 'Gemini CLI', 'Devin', 'Codex']

  for (const tool of AI_TOOLS) {
    const signals: string[] = []

    // Signal 1: Commit volume trending up (30d)
    const stat = stats.find((s) => s.name === tool)
    if (stat && stat.trendPct > 10) {
      signals.push(`commits ${formatPct(stat.trendPct)} (30d)`)
    }

    // Signal 2: WoW acceleration
    if (stat && stat.wowPct > 15) {
      signals.push(`WoW ${formatPct(stat.wowPct)}`)
    }

    // Signal 3: Config adoption growing
    const configVelocity = computeAdoptionVelocity(configTimeSeries, tool)
    if (configVelocity.weeklyGrowthPct !== null && configVelocity.weeklyGrowthPct > 5) {
      signals.push(`config files ${formatPct(configVelocity.weeklyGrowthPct)}/wk`)
    }

    // Signal 4: High agent PR volume (>100/day)
    const agentData = agentPRData.find((a) => a.tool === tool)
    if (agentData && agentData.count > 100) {
      signals.push(`${formatNum(agentData.count)} agent PRs/day`)
    }

    // Signal 5: HN buzz (>5 stories in 7 days)
    const hnData = hnBuzzData.find((h) => h.tool === tool)
    if (hnData && hnData.mentions >= 5) {
      signals.push(`${hnData.mentions} HN stories (7d)`)
    }

    // Signal 6: Market share dominance (>50%)
    if (stat && stat.share30d > 50) {
      signals.push(`${stat.share30d.toFixed(0)}% market share`)
    }

    if (signals.length >= 4) {
      const level = signals.length >= 5 ? 'red' : 'orange'
      alerts.push({
        tool,
        level,
        signals,
        headline: `${signals.length} converging signals — ${signals.slice(0, 3).join(', ')}`,
      })
    } else if (signals.length === 3) {
      alerts.push({
        tool,
        level: 'yellow',
        signals,
        headline: `${signals.join(', ')}`,
      })
    }
  }

  return alerts.sort((a, b) => b.signals.length - a.signals.length)
}

// Static context notes for the news feed
const CONTEXT_NOTES: Array<{ tag: string; color: string; headline: string }> = [
  { tag: 'CURSOR', color: TOOL_COLORS['Cursor'], headline: 'Cursor 2.4 silently enables Co-Authored-By for all users — Jan spike is attribution, not usage growth' },
  { tag: 'CLAUDE', color: TOOL_COLORS['Claude Code'], headline: 'Claude Code accounts for 90%+ of all tracked AI commits — only tool with attribution on by default since day one' },
  { tag: 'COPILOT', color: TOOL_COLORS['GitHub Copilot'], headline: 'Copilot coding agent (copilot-swe-agent[bot]) went GA Sep 2025 but barely registers in commits — most usage is inline completions' },
  { tag: 'CODEX', color: TOOL_COLORS['Codex'], headline: 'Codex CLI open-sourced Apr 2025 but attribution is opt-in — chart understates real usage' },
  { tag: 'AIDER', color: TOOL_COLORS['Aider'], headline: 'Aider enabled Co-Authored-By Nov 2024 — longest attribution history in the index, steady baseline' },
]

export default async function AICodeIndexPage() {
  const data = await getAICodeIndexData()
  const stats = data.length >= 2 ? computeToolStats(data) : []

  const totalCommits = stats.reduce((s, t) => s + t.totalCommits, 0)
  const totalCommits30d = stats.reduce((s, t) => s + t.avg30d * 30, 0)
  const totalCommitsPrior30d = stats.reduce((s, t) => s + t.avg30dPrior * 30, 0)
  const overallTrend = totalCommitsPrior30d > 0
    ? ((totalCommits30d - totalCommitsPrior30d) / totalCommitsPrior30d) * 100
    : 0

  const lastDate = data.length > 0 ? data[data.length - 1].date : null

  // Adoption data — latest + time-series for velocity
  const [configData, sdkData, configTimeSeries, sdkTimeSeries, agentPRData, agentPRTimeSeries, aggregateKPIs, hnBuzzData] = await Promise.all([
    getConfigAdoptionData(),
    getSDKAdoptionData(),
    getConfigAdoptionTimeSeries(),
    getSDKAdoptionTimeSeries(),
    getAgentPRData(),
    getAgentPRTimeSeries(),
    getAggregateKPIs(),
    getHNBuzzData(),
  ])
  const hasAdoptionData = configData.length > 0 || sdkData.length > 0

  // Convergence alerts
  const convergenceAlerts = computeConvergenceAlerts(stats, configTimeSeries, agentPRData, hnBuzzData)

  // Composite scores
  const compositeScores = computeCompositeScores(stats, data)

  // Sort by avg30d descending for commit table
  const byVolume = [...stats].sort((a, b) => b.avg30d - a.avg30d)
  // Sort by trend for momentum panel
  const byMomentum = [...stats].filter((t) => t.avg30d > 0).sort((a, b) => b.trendPct - a.trendPct)

  return (
    <div className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div className="px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">

          {/* Header */}
          <div className="pt-8 pb-6 sm:pt-10">
            <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--foreground-subtle)]">
              <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
                GitFind
              </Link>
              <span>/</span>
              <span className="text-[var(--foreground-muted)]">AI Code Index</span>
            </nav>

            <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              AI Code Index
            </h1>
            <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
              Which AI coding tools are developers actually using? Live data from all public GitHub repos.
              {lastDate && <> Updated {formatDateShort(lastDate)}.</>}
            </p>
          </div>

          {data.length >= 2 ? (
            <>
              {/* Hero KPI bar — segmented dark strip */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4 text-center"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                }}
              >
                <div className="px-1.5 py-3 sm:px-4 sm:py-4">
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1">Total commits</div>
                  <div className="text-base font-semibold text-[var(--foreground)] sm:text-2xl">
                    {formatNumExact(totalCommits)}
                  </div>
                </div>
                <div className="px-1.5 py-3 sm:px-4 sm:py-4" style={{ borderLeft: '1px solid var(--border)' }}>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1">30d avg / day</div>
                  <div className="text-base font-semibold text-[var(--foreground)] sm:text-2xl">
                    {formatNum(Math.round(totalCommits30d / 30))}
                  </div>
                </div>
                <div className="px-1.5 py-3 sm:px-4 sm:py-4" style={{ borderLeft: '1px solid var(--border)' }}>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1">30d change</div>
                  <div className="text-base font-semibold sm:text-2xl" style={{
                    color: overallTrend > 0 ? 'var(--score-high)' : overallTrend < 0 ? 'var(--error)' : 'var(--foreground)',
                  }}>
                    {formatPct(overallTrend)}
                  </div>
                </div>
                <div className="px-1.5 py-3 sm:px-4 sm:py-4" style={{ borderLeft: '1px solid var(--border)' }}>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1">AI Repos</div>
                  <div className="text-base font-semibold text-[var(--foreground)] sm:text-2xl">
                    {aggregateKPIs.configAggregate !== null ? formatNum(aggregateKPIs.configAggregate) : '—'}
                  </div>
                  <div className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">AI config files detected</div>
                </div>
              </div>

              {/* Full-width commit volume table with Score column */}
              <div className="mt-8">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Commit volume
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="px-2 py-1.5 text-left font-medium">Tool</th>
                        <th className="px-2 py-1.5 text-right font-medium">Latest</th>
                        <th className="px-2 py-1.5 text-right font-medium">Avg/day</th>
                        <th className="px-2 py-1.5 text-right font-medium">30d</th>
                        <th className="px-2 py-1.5 text-right font-medium">WoW</th>
                        <th className="px-2 py-1.5 text-right font-medium">Share</th>
                        <th className="px-2 py-1.5 text-right font-medium">Total</th>
                        <th className="px-2 py-1.5 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byVolume.map((tool) => {
                        const score = compositeScores.find((s) => s.name === tool.name)
                        return (
                          <tr key={tool.name} className="group" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-2 py-1.5">
                              <Link
                                href={`/ai-code-index/compare/${TOOL_SLUGS[tool.name]}-vs-${TOOL_SLUGS[byVolume.find((t) => t.name !== tool.name)?.name ?? 'cursor']}`}
                                className="inline-flex items-center gap-1.5 transition-colors group-hover:brightness-125"
                                style={{ color: tool.color }}
                              >
                                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                                {tool.name}
                                <span className="text-[var(--foreground-subtle)] opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">↔</span>
                              </Link>
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                              {formatNum(tool.latestDaily)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                              {formatNum(Math.round(tool.avg30d))}
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium" style={{
                              color: tool.trend === 'up' ? 'var(--score-high)' : tool.trend === 'down' ? 'var(--error)' : 'var(--foreground-subtle)',
                            }}>
                              {formatPct(tool.trendPct)}
                            </td>
                            <td className="px-2 py-1.5 text-right" style={{
                              color: tool.wowPct > 3 ? 'var(--score-high)' : tool.wowPct < -3 ? 'var(--error)' : 'var(--foreground-subtle)',
                            }}>
                              <span className="font-medium">{formatPct(tool.wowPct)}</span>
                              <span className="ml-0.5 text-[10px]" style={{
                                color: tool.acceleration === 'accel' ? 'var(--score-high)' : tool.acceleration === 'decel' ? 'var(--error)' : 'var(--foreground-subtle)',
                              }}>
                                {tool.acceleration === 'accel' ? '▲' : tool.acceleration === 'decel' ? '▼' : '—'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                              {tool.share30d >= 0.1 ? `${tool.share30d.toFixed(1)}%` : '<0.1%'}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                              {formatNum(tool.totalCommits)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              {score && (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-10 h-1 inline-block" style={{ backgroundColor: 'var(--border)' }}>
                                    <span
                                      className="block h-1"
                                      style={{
                                        width: `${score.score}%`,
                                        backgroundColor: score.score >= 65 ? 'var(--score-high)' : score.score >= 40 ? 'var(--accent)' : 'var(--foreground-subtle)',
                                      }}
                                    />
                                  </span>
                                  <span className="font-medium w-6 text-right" style={{
                                    color: score.score >= 65 ? 'var(--score-high)' : score.score >= 40 ? 'var(--accent)' : 'var(--foreground-muted)',
                                  }}>
                                    {score.score.toFixed(0)}
                                  </span>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">
                  Score = Volume (35%) · Momentum (25%) · Acceleration (20%) · Consistency (20%)
                </p>
              </div>

              {/* Metric strip — 3 panels in a horizontal band */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-0" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                {/* Momentum */}
                <div className="py-3 px-1 sm:pr-4" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Momentum (30d)
                  </div>
                  {byMomentum.map((tool, i) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-2 px-1 py-0.5"
                    >
                      <span className="w-3 text-right text-[var(--foreground-subtle)] text-[10px]">{i + 1}</span>
                      <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                      <span className="flex-1 text-xs truncate text-[var(--foreground)]">{tool.name}</span>
                      <span className="text-xs font-medium" style={{
                        color: tool.trend === 'up' ? 'var(--score-high)' : tool.trend === 'down' ? 'var(--error)' : 'var(--foreground-subtle)',
                      }}>
                        {formatPct(tool.trendPct)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Doubling time */}
                <div className="py-3 px-1 sm:px-4" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Doubling time
                  </div>
                  <p className="mb-1 text-[10px] text-[var(--foreground-subtle)]">
                    Days to 2× at current rate
                  </p>
                  {[...stats]
                    .filter((t) => t.doublingDays !== null && t.avg30d > 0)
                    .sort((a, b) => (a.doublingDays ?? Infinity) - (b.doublingDays ?? Infinity))
                    .map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-2 px-1 py-0.5"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                      <span className="flex-1 text-xs truncate text-[var(--foreground)]">{tool.name}</span>
                      <span className="text-xs font-medium" style={{
                        color: (tool.doublingDays ?? 999) <= 60 ? 'var(--score-high)' : (tool.doublingDays ?? 999) <= 120 ? 'var(--accent)' : 'var(--foreground-muted)',
                      }}>
                        {tool.doublingDays}d
                      </span>
                    </div>
                  ))}
                  {stats.filter((t) => t.doublingDays === null && t.avg30d > 0).length > 0 && (
                    <div className="px-1 py-0.5 text-[10px] text-[var(--foreground-subtle)]">
                      {stats.filter((t) => t.doublingDays === null && t.avg30d > 0).map((t) => t.name).join(', ')} — flat/declining
                    </div>
                  )}
                </div>

                {/* Market share */}
                <div className="py-3 px-1 sm:pl-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Market share (30d)
                  </div>
                  {byVolume.filter((t) => t.share30d >= 0.1).map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-2 px-1 py-0.5"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                      <span className="flex-1 text-xs truncate text-[var(--foreground)]">{tool.name}</span>
                      <span className="text-xs text-[var(--foreground-muted)] w-10 text-right">{tool.share30d.toFixed(1)}%</span>
                      <div className="w-14 h-1" style={{ backgroundColor: 'var(--border)' }}>
                        <div
                          className="h-1"
                          style={{
                            width: `${Math.min(tool.share30d, 100)}%`,
                            backgroundColor: tool.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="mt-10">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Daily commit volume
                </div>
                <AICodeIndexChart data={data} configTimeSeries={configTimeSeries} agentPRTimeSeries={agentPRTimeSeries} />
              </div>

              {/* Market share over time */}
              <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Market share over time
                </div>
                <p className="mb-2 text-xs text-[var(--foreground-subtle)]">
                  Each tool&apos;s share of total AI-authored commits, 7d smoothed
                </p>
                <MarketShareChart data={data} />
              </div>

              {/* AI Agent Activity — PRs created by autonomous AI bots */}
              {agentPRData.length > 0 && (
                <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    AI Agent Activity
                  </div>
                  <p className="mb-3 text-xs text-[var(--foreground-subtle)]">
                    Pull requests created autonomously by AI agents — no human co-author
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[...agentPRData].sort((a, b) => b.count - a.count).map((agent) => {
                      const velocity = computeAdoptionVelocity(agentPRTimeSeries, agent.tool)
                      return (
                        <div
                          key={agent.tool}
                          className="rounded-md px-3 py-2.5"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div className="text-[10px] uppercase tracking-wider text-[var(--foreground-muted)] mb-1">
                            {agent.tool}
                          </div>
                          <div className="text-lg font-semibold text-[var(--foreground)]">
                            {formatNum(agent.count)}
                          </div>
                          <div className="text-[10px] text-[var(--foreground-subtle)]">
                            PRs / day
                          </div>
                          {velocity.weeklyGrowthPct !== null && (
                            <div className="mt-1 text-[10px]" style={{
                              color: velocity.weeklyGrowthPct > 0.5
                                ? 'var(--score-high)'
                                : velocity.weeklyGrowthPct < -0.5
                                ? 'var(--error)'
                                : 'var(--foreground-subtle)',
                            }}>
                              {formatPct(velocity.weeklyGrowthPct)} /wk
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Community Pulse — HN buzz per tool */}
              {hnBuzzData.length > 0 && hnBuzzData.some((t) => t.mentions > 0) && (
                <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Community pulse
                  </div>
                  <p className="mb-3 text-xs text-[var(--foreground-subtle)]">
                    Hacker News stories mentioning each tool — last 7 days
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="px-2 py-1.5 text-left font-medium">Tool</th>
                        <th className="px-2 py-1.5 text-right font-medium">Stories</th>
                        <th className="px-2 py-1.5 text-right font-medium">Total points</th>
                        <th className="px-2 py-1.5 text-right font-medium">Avg engagement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...hnBuzzData]
                        .filter((t) => t.mentions > 0)
                        .sort((a, b) => b.points - a.points)
                        .map((row) => (
                          <tr key={row.tool} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-2 py-1.5">
                              <span className="inline-flex items-center gap-1.5" style={{ color: TOOL_COLORS[row.tool] ?? 'var(--foreground)' }}>
                                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TOOL_COLORS[row.tool] ?? 'var(--foreground-subtle)' }} />
                                {row.tool}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                              {row.mentions}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                              {formatNum(row.points)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                              {row.mentions > 0 ? Math.round(row.points / row.mentions) : 0} pts/story
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Adoption — config files + SDK dependencies */}
              {hasAdoptionData && (
                <div className="mt-10 grid grid-cols-1 lg:grid-cols-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                  {configData.length > 0 && (
                    <div className="lg:pr-6" style={{ borderRight: configData.length > 0 && sdkData.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                        Config file adoption
                      </div>
                      <p className="mb-2 text-xs text-[var(--foreground-subtle)]">
                        Repos with AI tool config files
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border)' }}>
                            <th className="px-2 py-1.5 text-left font-medium">Tool</th>
                            <th className="px-2 py-1.5 text-right font-medium">Repos</th>
                            <th className="px-2 py-1.5 text-right font-medium">Δ/wk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...configData].sort((a, b) => b.count - a.count).map((row) => {
                            const velocity = computeAdoptionVelocity(configTimeSeries, row.tool)
                            return (
                              <tr key={row.tool} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td className="px-2 py-1.5">
                                  <span className="inline-flex items-center gap-1.5" style={{ color: TOOL_COLORS[row.tool] ?? 'var(--foreground)' }}>
                                    <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TOOL_COLORS[row.tool] ?? 'var(--foreground-subtle)' }} />
                                    {row.tool}
                                    <span className="text-[var(--foreground-subtle)] font-normal">({CONFIG_FILES[row.tool] ?? ''})</span>
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                                  {formatNum(row.count)}
                                </td>
                                <td className="px-2 py-1.5 text-right" style={{
                                  color: velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct > 0.5
                                    ? 'var(--score-high)'
                                    : velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct < -0.5
                                    ? 'var(--error)'
                                    : 'var(--foreground-subtle)',
                                }}>
                                  {velocity.weeklyGrowthPct !== null
                                    ? formatPct(velocity.weeklyGrowthPct)
                                    : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {sdkData.length > 0 && (
                    <div className={configData.length > 0 ? 'lg:pl-6 mt-4 lg:mt-0' : ''}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                        SDK adoption
                      </div>
                      <p className="mb-2 text-xs text-[var(--foreground-subtle)]">
                        Repos with AI SDK dependencies
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border)' }}>
                            <th className="px-2 py-1.5 text-left font-medium">SDK</th>
                            <th className="px-2 py-1.5 text-right font-medium">Repos</th>
                            <th className="px-2 py-1.5 text-right font-medium">Δ/wk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...sdkData].sort((a, b) => b.count - a.count).map((row) => {
                            const velocity = computeAdoptionVelocity(sdkTimeSeries, row.tool)
                            return (
                              <tr key={row.tool} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td className="px-2 py-1.5 text-[var(--foreground)]">
                                  {row.tool}
                                </td>
                                <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                                  {formatNum(row.count)}
                                </td>
                                <td className="px-2 py-1.5 text-right" style={{
                                  color: velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct > 0.5
                                    ? 'var(--score-high)'
                                    : velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct < -0.5
                                    ? 'var(--error)'
                                    : 'var(--foreground-subtle)',
                                }}>
                                  {velocity.weeklyGrowthPct !== null
                                    ? formatPct(velocity.weeklyGrowthPct)
                                    : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Intelligence Brief — convergence alerts + context */}
              <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Intelligence brief
                  </div>
                  <div className="text-xs text-[var(--foreground-subtle)]">
                    API:{' '}
                    <Link href="/api/ai-code-index" className="text-[var(--foreground-muted)] transition-colors hover:text-[var(--accent)]">
                      /api/ai-code-index
                    </Link>
                  </div>
                </div>

                {/* Convergence alerts */}
                {convergenceAlerts.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {convergenceAlerts.map((alert) => {
                      const levelColors = {
                        red: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', badge: 'var(--badge-breakout)', label: 'BREAKOUT' },
                        orange: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', badge: 'var(--badge-hot)', label: 'HOT' },
                        yellow: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.25)', badge: 'var(--badge-active)', label: 'ACTIVE' },
                      }
                      const colors = levelColors[alert.level]
                      return (
                        <div
                          key={alert.tool}
                          className="rounded-md px-3 py-2"
                          style={{
                            backgroundColor: colors.bg,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                              style={{ backgroundColor: colors.badge, color: '#fff' }}
                            >
                              {colors.label}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: TOOL_COLORS[alert.tool] ?? 'var(--foreground)' }}>
                              {alert.tool}
                            </span>
                            <span className="text-[10px] text-[var(--foreground-subtle)]">
                              {alert.signals.length} signals
                            </span>
                          </div>
                          <div className="text-xs text-[var(--foreground-muted)] leading-snug">
                            {alert.headline}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Context notes */}
                <div>
                  {CONTEXT_NOTES.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-0 py-[3px]"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <span
                        className="w-[72px] flex-shrink-0 text-xs font-medium"
                        style={{ color: item.color }}
                      >
                        {item.tag}
                      </span>
                      <span className="text-xs text-[var(--foreground-muted)] leading-snug">
                        {item.headline}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pb-8" />
            </>
          ) : (
            <div className="py-16 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs text-[var(--foreground-muted)]">
                No data — run{' '}
                <code className="text-[var(--accent)]">npx tsx scripts/search-commits.ts</code>{' '}
                to start collecting.
              </p>
            </div>
          )}

        </div>
      </div>

      <NewsletterSignup />
    </div>
  )
}
