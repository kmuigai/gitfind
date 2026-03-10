import type { Metadata } from 'next'
import Link from 'next/link'
import { getAICodeIndexData, getConfigAdoptionData, getSDKAdoptionData, getConfigAdoptionTimeSeries, getSDKAdoptionTimeSeries, getAgentPRData, getAgentPRTimeSeries, getAggregateKPIs, getCommunityBuzzData } from '@/lib/queries'
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

function renderBlockBar(value: number, max: number = 100): string {
  const pct = Math.max(0, Math.min(1, value / max))
  const filled = Math.round(pct * 8)
  return '█'.repeat(filled) + '░'.repeat(8 - filled)
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
  buzzData: Array<{ tool: string; mentions: number }>,
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

    // Signal 5: Community buzz (>10 mentions across HN + Reddit + GH Discussions in 7 days)
    const buzzEntry = buzzData.find((h) => h.tool === tool)
    if (buzzEntry && buzzEntry.mentions >= 10) {
      signals.push(`${buzzEntry.mentions} community mentions (7d)`)
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

  // Aggregate WoW: total commits this week vs last week
  const last7 = data.slice(-7)
  const prior7 = data.slice(-14, -7)
  const toolKeys = Object.keys(TOOL_COLORS)
  const sumWeek = (rows: typeof data) => rows.reduce((sum, row) =>
    sum + toolKeys.reduce((ts, t) => ts + ((row[t] as number) || 0), 0), 0)
  const thisWeekTotal = sumWeek(last7)
  const lastWeekTotal = sumWeek(prior7)
  const overallWoW = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0

  const lastDate = data.length > 0 ? data[data.length - 1].date : null

  // Adoption data — latest + time-series for velocity
  const [configData, sdkData, configTimeSeries, sdkTimeSeries, agentPRData, agentPRTimeSeries, aggregateKPIs, buzzData] = await Promise.all([
    getConfigAdoptionData(),
    getSDKAdoptionData(),
    getConfigAdoptionTimeSeries(),
    getSDKAdoptionTimeSeries(),
    getAgentPRData(),
    getAgentPRTimeSeries(),
    getAggregateKPIs(),
    getCommunityBuzzData(),
  ])
  const hasAdoptionData = configData.length > 0 || sdkData.length > 0

  // Convergence alerts
  const convergenceAlerts = computeConvergenceAlerts(stats, configTimeSeries, agentPRData, buzzData)

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
                  <div className="term-label mb-1">TOTAL_COMMITS</div>
                  <div className="text-base font-semibold text-[var(--foreground)] sm:text-2xl">
                    {formatNumExact(totalCommits)}
                  </div>
                </div>
                <div className="px-1.5 py-3 sm:px-4 sm:py-4" style={{ borderLeft: '1px solid var(--border)' }}>
                  <div className="term-label mb-1">30D_AVG/DAY</div>
                  <div className="text-base font-semibold text-[var(--foreground)] sm:text-2xl">
                    {formatNum(Math.round(totalCommits30d / 30))}
                  </div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5" style={{
                    color: overallWoW > 0.5 ? 'var(--score-high)' : overallWoW < -0.5 ? 'var(--error)' : 'var(--foreground-subtle)',
                  }}>
                    <span className={`status-dot ${overallWoW > 0.5 ? 'status-dot--positive' : overallWoW < -0.5 ? 'status-dot--negative' : 'status-dot--flat'}`} />
                    {formatPct(overallWoW)} WoW
                  </div>
                </div>
                <div className="px-1.5 py-3 sm:px-4 sm:py-4" style={{ borderLeft: '1px solid var(--border)' }}>
                  <div className="term-label mb-1">30D_CHANGE</div>
                  <div className="text-base font-semibold sm:text-2xl" style={{
                    color: overallTrend > 0 ? 'var(--score-high)' : overallTrend < 0 ? 'var(--error)' : 'var(--foreground)',
                  }}>
                    <span className={`status-dot ${overallTrend > 5 ? 'status-dot--positive' : overallTrend < -5 ? 'status-dot--negative' : 'status-dot--flat'}`} />
                    {formatPct(overallTrend)}
                  </div>
                </div>
                <div className="px-1.5 py-3 sm:px-4 sm:py-4" style={{ borderLeft: '1px solid var(--border)' }}>
                  <div className="term-label mb-1">AI_REPOS</div>
                  <div className="text-base font-semibold text-[var(--foreground)] sm:text-2xl">
                    {aggregateKPIs.configAggregate !== null ? formatNum(aggregateKPIs.configAggregate) : '—'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5" style={{
                    color: (aggregateKPIs.configAggregateWoW ?? 0) > 0.5 ? 'var(--score-high)' : (aggregateKPIs.configAggregateWoW ?? 0) < -0.5 ? 'var(--error)' : 'var(--foreground-subtle)',
                  }}>
                    <span className={`status-dot ${(aggregateKPIs.configAggregateWoW ?? 0) > 0.5 ? 'status-dot--positive' : (aggregateKPIs.configAggregateWoW ?? 0) < -0.5 ? 'status-dot--negative' : 'status-dot--flat'}`} />
                    {formatPct(aggregateKPIs.configAggregateWoW ?? 0)} WoW
                  </div>
                </div>
              </div>

              {/* Full-width commit volume table with Score column */}
              <div className="mt-8">
                <div className="mb-1 flex items-baseline justify-between">
                  <div className="term-label">
                    {'// COMMIT_VOLUME'}
                  </div>
                  <span className="font-mono text-[9px] text-[var(--foreground-subtle)] uppercase tracking-widest">
                    {'>'} {byVolume.length} nodes indexed
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th className="text-left">Tool Node</th>
                        <th className="text-right">Latest</th>
                        <th className="text-right">Avg/day</th>
                        <th className="text-right">30d</th>
                        <th className="text-right">WoW</th>
                        <th className="text-right">Share</th>
                        <th className="text-right">Total</th>
                        <th className="text-center">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byVolume.map((tool, i) => {
                        const score = compositeScores.find((s) => s.name === tool.name)
                        return (
                          <tr key={tool.name} className="group" style={{ animation: `row-appear 0.3s ease-out ${i * 50}ms both` }}>
                            <td>
                              <Link
                                href={`/ai-code-index/compare/${TOOL_SLUGS[tool.name]}-vs-${TOOL_SLUGS[byVolume.find((t) => t.name !== tool.name)?.name ?? 'cursor']}`}
                                className="inline-flex items-center gap-1.5 transition-colors group-hover:brightness-125"
                                style={{ color: tool.color }}
                              >
                                <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                                {tool.name}
                              </Link>
                            </td>
                            <td className="text-right text-[var(--foreground)]">
                              {formatNum(tool.latestDaily)}
                            </td>
                            <td className="text-right text-[var(--foreground)]">
                              {formatNum(Math.round(tool.avg30d))}
                            </td>
                            <td className="text-right font-medium" style={{
                              color: tool.trend === 'up' ? 'var(--score-high)' : tool.trend === 'down' ? 'var(--error)' : 'var(--foreground-subtle)',
                            }}>
                              {formatPct(tool.trendPct)}
                            </td>
                            <td className="text-right" style={{
                              color: tool.wowPct > 3 ? 'var(--score-high)' : tool.wowPct < -3 ? 'var(--error)' : 'var(--foreground-subtle)',
                            }}>
                              <span className="font-medium">{formatPct(tool.wowPct)}</span>
                              <span className="ml-0.5 text-[10px]" style={{
                                color: tool.acceleration === 'accel' ? 'var(--score-high)' : tool.acceleration === 'decel' ? 'var(--error)' : 'var(--foreground-subtle)',
                              }}>
                                {tool.acceleration === 'accel' ? '▲' : tool.acceleration === 'decel' ? '▼' : '—'}
                              </span>
                            </td>
                            <td className="text-right text-[var(--foreground-muted)]">
                              {tool.share30d >= 0.1 ? `${tool.share30d.toFixed(1)}%` : '<0.1%'}
                            </td>
                            <td className="text-right text-[var(--foreground-muted)]">
                              {formatNum(tool.totalCommits)}
                            </td>
                            <td className="text-center">
                              {score && (
                                <span className="term-bar">
                                  <span className="term-bar-filled" style={{
                                    color: score.score >= 65 ? 'var(--score-high)' : score.score >= 40 ? 'var(--accent)' : 'var(--foreground-subtle)',
                                  }}>
                                    {renderBlockBar(score.score)}
                                  </span>
                                  {' '}
                                  <span className="font-bold" style={{
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
                <p className="mt-1.5 font-mono text-[9px] text-[var(--foreground-subtle)] tracking-wider">
                  SCORE = VOLUME (35%) · MOMENTUM (25%) · ACCELERATION (20%) · CONSISTENCY (20%)
                </p>
              </div>

              {/* Metric strip — 3 tables in a horizontal band */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Momentum */}
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div className="term-label">{'// MOMENTUM_30D'}</div>
                    <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">{'>'} {byMomentum.length} NODES</span>
                  </div>
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th className="text-left">Tool Node</th>
                        <th className="text-right">30d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMomentum.map((tool, i) => (
                        <tr key={tool.name}>
                          <td>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                              <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                              <span style={{ color: tool.color }}>{tool.name}</span>
                            </span>
                          </td>
                          <td className="text-right font-medium" style={{
                            color: tool.trend === 'up' ? 'var(--score-high)' : tool.trend === 'down' ? 'var(--error)' : 'var(--foreground-subtle)',
                          }}>
                            {formatPct(tool.trendPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Doubling time */}
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div className="term-label">{'// DOUBLING_TIME'}</div>
                    <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">DAYS_TO_2X</span>
                  </div>
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th className="text-left">Tool Node</th>
                        <th className="text-right">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats]
                        .filter((t) => t.doublingDays !== null && t.avg30d > 0)
                        .sort((a, b) => (a.doublingDays ?? Infinity) - (b.doublingDays ?? Infinity))
                        .map((tool, i) => (
                        <tr key={tool.name}>
                          <td>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                              <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                              <span style={{ color: tool.color }}>{tool.name}</span>
                            </span>
                          </td>
                          <td className="text-right font-medium" style={{
                            color: (tool.doublingDays ?? 999) <= 60 ? 'var(--score-high)' : (tool.doublingDays ?? 999) <= 120 ? 'var(--accent)' : 'var(--foreground-muted)',
                          }}>
                            {tool.doublingDays}d
                          </td>
                        </tr>
                      ))}
                      {stats.filter((t) => t.doublingDays === null && t.avg30d > 0).length > 0 && (
                        <tr>
                          <td colSpan={2} className="text-[10px] text-[var(--foreground-subtle)]">
                            {stats.filter((t) => t.doublingDays === null && t.avg30d > 0).map((t) => t.name).join(', ')} — flat/declining
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Market share */}
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div className="term-label">{'// MARKET_SHARE_30D'}</div>
                  </div>
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th className="text-left">Tool Node</th>
                        <th className="text-right">Share</th>
                        <th className="text-center">Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byVolume.filter((t) => t.share30d >= 0.1).map((tool, i) => (
                        <tr key={tool.name}>
                          <td>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                              <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                              <span style={{ color: tool.color }}>{tool.name}</span>
                            </span>
                          </td>
                          <td className="text-right text-[var(--foreground-muted)]">{tool.share30d.toFixed(1)}%</td>
                          <td className="text-center">
                            <span className="term-bar">
                              <span className="term-bar-filled" style={{ color: tool.color }}>{renderBlockBar(tool.share30d)}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chart */}
              <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <div className="mb-1 flex items-baseline justify-between">
                  <div className="term-label">{'// DAILY_COMMIT_VOLUME'}</div>
                  <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">{'>'} {data.length} DAYS INDEXED</span>
                </div>
                <AICodeIndexChart data={data} configTimeSeries={configTimeSeries} agentPRTimeSeries={agentPRTimeSeries} />
              </div>

              {/* Market share over time */}
              <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <div className="mb-1 flex items-baseline justify-between">
                  <div className="term-label">{'// MARKET_SHARE_OVER_TIME'}</div>
                  <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">7D_SMOOTHED</span>
                </div>
                <MarketShareChart data={data} />
              </div>

              {/* AI Agent Activity — PRs created by autonomous AI bots */}
              {agentPRData.length > 0 && (
                <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div className="term-label">{'// AI_AGENT_ACTIVITY'}</div>
                    <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">{'>'} {agentPRData.length} AGENTS TRACKED</span>
                  </div>
                  <p className="mb-2 font-mono text-[9px] text-[var(--foreground-subtle)] tracking-wider">
                    PULL_REQUESTS CREATED AUTONOMOUSLY — NO HUMAN CO-AUTHOR
                  </p>
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th className="text-left">Agent</th>
                        <th className="text-right">PRs/day</th>
                        <th className="text-right">Δ/wk</th>
                        <th className="text-center">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...agentPRData].sort((a, b) => b.count - a.count).map((agent, i) => {
                        const velocity = computeAdoptionVelocity(agentPRTimeSeries, agent.tool)
                        const maxCount = Math.max(...agentPRData.map((a) => a.count))
                        return (
                          <tr key={agent.tool}>
                            <td>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TOOL_COLORS[agent.tool] ?? 'var(--foreground-subtle)' }} />
                                <span style={{ color: TOOL_COLORS[agent.tool] ?? 'var(--foreground)' }}>{agent.tool}</span>
                              </span>
                            </td>
                            <td className="text-right font-bold text-[var(--foreground)]">
                              {formatNum(agent.count)}
                            </td>
                            <td className="text-right" style={{
                              color: velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct > 0.5
                                ? 'var(--score-high)'
                                : velocity.weeklyGrowthPct !== null && velocity.weeklyGrowthPct < -0.5
                                ? 'var(--error)'
                                : 'var(--foreground-subtle)',
                            }}>
                              {velocity.weeklyGrowthPct !== null ? formatPct(velocity.weeklyGrowthPct) : '—'}
                            </td>
                            <td className="text-center">
                              <span className="term-bar">
                                <span className="term-bar-filled" style={{ color: TOOL_COLORS[agent.tool] ?? 'var(--accent)' }}>
                                  {renderBlockBar(agent.count, maxCount)}
                                </span>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Community Pulse — unified buzz across HN, Reddit, GH Discussions */}
              {buzzData.length > 0 && (
                <div className="mt-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div className="term-label">{'// COMMUNITY_PULSE'}</div>
                    <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">{'>'} LAST 7 DAYS</span>
                  </div>
                  <p className="mb-2 font-mono text-[9px] text-[var(--foreground-subtle)] tracking-wider">
                    MENTIONS ACROSS HN, REDDIT, GH_DISCUSSIONS
                  </p>
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th className="text-left">Tool Node</th>
                        <th className="text-right">Total</th>
                        <th className="text-right hidden sm:table-cell">HN</th>
                        <th className="text-right hidden sm:table-cell">Reddit</th>
                        <th className="text-right hidden sm:table-cell">GH Disc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...buzzData]
                        .sort((a, b) => b.mentions - a.mentions)
                        .map((row, i) => (
                          <tr key={row.tool}>
                            <td>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TOOL_COLORS[row.tool] ?? 'var(--foreground-subtle)' }} />
                                <span style={{ color: TOOL_COLORS[row.tool] ?? 'var(--foreground)' }}>{row.tool}</span>
                              </span>
                            </td>
                            <td className="text-right font-bold text-[var(--foreground)]">
                              {row.mentions}
                            </td>
                            <td className="text-right text-[var(--foreground-muted)] hidden sm:table-cell">
                              {row.hn}
                            </td>
                            <td className="text-right text-[var(--foreground-muted)] hidden sm:table-cell">
                              {row.reddit}
                            </td>
                            <td className="text-right text-[var(--foreground-muted)] hidden sm:table-cell">
                              {row.ghDiscussions}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Adoption — config files + SDK dependencies */}
              {hasAdoptionData && (
                <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                  {configData.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <div className="term-label">{'// CONFIG_FILE_ADOPTION'}</div>
                        <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">{'>'} {configData.length} FILES</span>
                      </div>
                      <table className="term-table">
                        <thead>
                          <tr>
                            <th className="text-left">Tool Node</th>
                            <th className="text-right">Repos</th>
                            <th className="text-right">Δ/wk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...configData].sort((a, b) => b.count - a.count).map((row, i) => {
                            const velocity = computeAdoptionVelocity(configTimeSeries, row.tool)
                            return (
                              <tr key={row.tool}>
                                <td>
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                                    <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TOOL_COLORS[row.tool] ?? 'var(--foreground-subtle)' }} />
                                    <span style={{ color: TOOL_COLORS[row.tool] ?? 'var(--foreground)' }}>{row.tool}</span>
                                    <span className="text-[var(--foreground-subtle)] text-[9px]">({CONFIG_FILES[row.tool] ?? ''})</span>
                                  </span>
                                </td>
                                <td className="text-right font-bold text-[var(--foreground)]">
                                  {formatNum(row.count)}
                                </td>
                                <td className="text-right" style={{
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
                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <div className="term-label">{'// SDK_ADOPTION'}</div>
                        <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">{'>'} {sdkData.length} SDKS</span>
                      </div>
                      <table className="term-table">
                        <thead>
                          <tr>
                            <th className="text-left">SDK</th>
                            <th className="text-right">Repos</th>
                            <th className="text-right">Δ/wk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...sdkData].sort((a, b) => b.count - a.count).map((row, i) => {
                            const velocity = computeAdoptionVelocity(sdkTimeSeries, row.tool)
                            return (
                              <tr key={row.tool}>
                                <td>
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="term-idx">[{String(i).padStart(2, '0')}]</span>
                                    <span className="text-[var(--foreground)]">{row.tool}</span>
                                  </span>
                                </td>
                                <td className="text-right font-bold text-[var(--foreground)]">
                                  {formatNum(row.count)}
                                </td>
                                <td className="text-right" style={{
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
                <div className="mb-1 flex items-baseline justify-between">
                  <div className="term-label">{'// INTELLIGENCE_BRIEF'}</div>
                  <span className="font-mono text-[9px] text-[var(--foreground-subtle)] tracking-widest">
                    API:{' '}
                    <Link href="/api/ai-code-index" className="text-[var(--foreground-muted)] transition-colors hover:text-[var(--accent)]">
                      /api/ai-code-index
                    </Link>
                  </span>
                </div>

                {/* Convergence alerts */}
                {convergenceAlerts.length > 0 && (
                  <table className="term-table mt-2 mb-4">
                    <thead>
                      <tr>
                        <th className="text-left">Level</th>
                        <th className="text-left">Tool Node</th>
                        <th className="text-left">Signals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {convergenceAlerts.map((alert) => {
                        const levelConfig = {
                          red: { label: '[CRITICAL]', labelColor: '#ef4444' },
                          orange: { label: '[WARN]', labelColor: '#f59e0b' },
                          yellow: { label: '[INFO]', labelColor: '#06b6d4' },
                        }
                        const config = levelConfig[alert.level]
                        return (
                          <tr key={alert.tool}>
                            <td>
                              <span className="font-bold" style={{ color: config.labelColor }}>
                                {config.label}
                              </span>
                            </td>
                            <td>
                              <span className="font-semibold" style={{ color: TOOL_COLORS[alert.tool] ?? 'var(--foreground)' }}>
                                {alert.tool}
                              </span>
                            </td>
                            <td className="text-[var(--foreground-muted)]">
                              {alert.signals.join(', ')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {/* Context notes */}
                <table className="term-table">
                  <thead>
                    <tr>
                      <th className="text-left">Tag</th>
                      <th className="text-left">Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONTEXT_NOTES.map((item, i) => (
                      <tr key={i}>
                        <td className="font-medium whitespace-nowrap" style={{ color: item.color }}>
                          {item.tag}
                        </td>
                        <td className="text-[var(--foreground-muted)] leading-snug">
                          {item.headline}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
