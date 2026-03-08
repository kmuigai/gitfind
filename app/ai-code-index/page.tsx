import type { Metadata } from 'next'
import Link from 'next/link'
import { getAICodeIndexData, getConfigAdoptionData, getSDKAdoptionData } from '@/lib/queries'
import AICodeIndexChart from '@/components/AICodeIndexChart'
import NewsletterSignup from '@/components/NewsletterSignup'

export const metadata: Metadata = {
  title: 'AI Code Index',
  description:
    'Daily commit counts for Claude Code, Cursor, Copilot, Aider, Gemini CLI, Devin, and Codex across all public GitHub repos. The rise of AI-written code, tracked live.',
  openGraph: {
    title: 'AI Code Index — GitFind',
    description:
      'Daily commit counts for Claude Code, Cursor, Copilot, Aider, Gemini CLI, Devin, and Codex across all public GitHub repos.',
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
const TOTAL_PUBLIC_REPOS = 69_000_000

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
}

function computeToolStats(data: Array<{ date: string; [tool: string]: number | string }>): ToolStats[] {
  const tools = Object.keys(TOOL_COLORS)
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDateShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

// News feed — Bloomberg-style single-line headlines with source tags
const NEWS_FEED: Array<{ tag: string; color: string; headline: string }> = [
  { tag: 'CURSOR', color: TOOL_COLORS['Cursor'], headline: 'Cursor 2.4 silently enables Co-Authored-By for all users — Jan spike is attribution, not usage growth' },
  { tag: 'CURSOR', color: TOOL_COLORS['Cursor'], headline: 'Before Jan 2026 Cursor had zero trackable commits despite being one of the most popular AI editors' },
  { tag: 'CLAUDE', color: TOOL_COLORS['Claude Code'], headline: 'Claude Code accounts for 90%+ of all tracked AI commits — only tool with attribution on by default since day one' },
  { tag: 'CLAUDE', color: TOOL_COLORS['Claude Code'], headline: 'Web launch in Oct 2025 removed CLI-only barrier — daily commits accelerated through Q4' },
  { tag: 'CLAUDE', color: TOOL_COLORS['Claude Code'], headline: 'Claude Code GA in May 2025 is the single largest inflection point on the chart' },
  { tag: 'COPILOT', color: TOOL_COLORS['GitHub Copilot'], headline: 'Copilot coding agent (copilot-swe-agent[bot]) went GA Sep 2025 but barely registers — most usage is inline completions' },
  { tag: 'GEMINI', color: TOOL_COLORS['Gemini CLI'], headline: 'Google open-sourced Gemini CLI Jun 2025 with free tier (1k req/day) — steady growth since launch' },
  { tag: 'CODEX', color: TOOL_COLORS['Codex'], headline: 'Codex CLI open-sourced Apr 2025 but attribution is opt-in — chart understates real usage' },
  { tag: 'DEVIN', color: TOOL_COLORS['Devin'], headline: 'Devin price dropped from $500/mo to $20/mo in Apr 2025 — commit volume didn\'t follow' },
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

  // Adoption data
  const [configData, sdkData] = await Promise.all([
    getConfigAdoptionData(),
    getSDKAdoptionData(),
  ])
  const hasAdoptionData = configData.length > 0 || sdkData.length > 0

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
              AI-authored commits across all public GitHub repos.
              {lastDate && <> Updated {formatDateShort(lastDate)}.</>}
            </p>
          </div>

          {data.length >= 2 ? (
            <>
              {/* Hero metrics — tighter gaps */}
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--accent)]">Total commits</div>
                  <div className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                    {formatNumExact(totalCommits)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--accent)]">30d avg / day</div>
                  <div className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                    {formatNum(Math.round(totalCommits30d / 30))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--accent)]">30d change</div>
                  <div className="text-2xl font-semibold sm:text-3xl" style={{
                    color: overallTrend > 0 ? 'var(--score-high)' : overallTrend < 0 ? 'var(--error)' : 'var(--foreground)',
                  }}>
                    {formatPct(overallTrend)}
                  </div>
                </div>
              </div>

              {/* Two-panel layout — border between panels */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_260px]">

                {/* Panel 1: Commit volume table */}
                <div className="lg:pr-6" style={{ borderRight: '1px solid var(--border-subtle)' }}>
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
                          <th className="px-2 py-1.5 text-right font-medium">Share</th>
                          <th className="px-2 py-1.5 text-right font-medium">Peak</th>
                          <th className="px-2 py-1.5 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byVolume.map((tool) => (
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
                            <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                              {tool.share30d >= 0.1 ? `${tool.share30d.toFixed(1)}%` : '<0.1%'}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                              {formatNum(tool.peakDay.count)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                              {formatNum(tool.totalCommits)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Panel 2: Momentum + Market share */}
                <div className="lg:pl-6 mt-4 lg:mt-0">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Momentum (30d)
                  </div>
                  <div>
                    {byMomentum.map((tool, i) => (
                      <div
                        key={tool.name}
                        className="flex items-center gap-2 px-2 py-1"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <span className="w-3 text-right text-[var(--foreground-subtle)]">{i + 1}</span>
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

                  <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Market share (30d)
                  </div>
                  <div>
                    {byVolume.filter((t) => t.share30d >= 0.1).map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-center gap-2 px-2 py-1"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                        <span className="flex-1 text-xs truncate text-[var(--foreground)]">{tool.name}</span>
                        <span className="text-xs text-[var(--foreground-muted)] w-10 text-right">{tool.share30d.toFixed(1)}%</span>
                        <div className="w-16 h-1" style={{ backgroundColor: 'var(--border)' }}>
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
              </div>

              {/* Chart */}
              <div className="mt-8">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Daily commits
                </div>
                <AICodeIndexChart data={data} />
              </div>

              {/* Adoption — config files + SDK dependencies */}
              {hasAdoptionData && (
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  {configData.length > 0 && (
                    <div className="lg:pr-6" style={{ borderRight: configData.length > 0 && sdkData.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                        Config file adoption
                      </div>
                      <p className="mb-2 text-xs text-[var(--foreground-subtle)]">
                        Repos with tool-specific config files — % of {formatNum(TOTAL_PUBLIC_REPOS)} repos created since Feb 2025
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border)' }}>
                            <th className="px-2 py-1.5 text-left font-medium">Tool</th>
                            <th className="px-2 py-1.5 text-right font-medium">Repos</th>
                            <th className="px-2 py-1.5 text-right font-medium">% GitHub</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...configData].sort((a, b) => b.count - a.count).map((row) => {
                            const pct = (row.count / TOTAL_PUBLIC_REPOS) * 100
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
                                <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                                  {pct >= 0.01 ? `${pct.toFixed(2)}%` : '<0.01%'}
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
                        Repos depending on AI SDKs — % of {formatNum(TOTAL_PUBLIC_REPOS)} repos created since Feb 2025
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border)' }}>
                            <th className="px-2 py-1.5 text-left font-medium">SDK</th>
                            <th className="px-2 py-1.5 text-right font-medium">Repos</th>
                            <th className="px-2 py-1.5 text-right font-medium">% GitHub</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...sdkData].sort((a, b) => b.count - a.count).map((row) => {
                            const pct = (row.count / TOTAL_PUBLIC_REPOS) * 100
                            return (
                              <tr key={row.tool} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td className="px-2 py-1.5 text-[var(--foreground)]">
                                  {row.tool}
                                </td>
                                <td className="px-2 py-1.5 text-right text-[var(--foreground)]">
                                  {formatNum(row.count)}
                                </td>
                                <td className="px-2 py-1.5 text-right text-[var(--foreground-muted)]">
                                  {pct >= 0.01 ? `${pct.toFixed(2)}%` : '<0.01%'}
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

              {/* News feed */}
              <div className="mt-8" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    News
                  </div>
                  <div className="text-xs text-[var(--foreground-subtle)]">
                    API:{' '}
                    <Link href="/api/ai-code-index" className="text-[var(--foreground-muted)] transition-colors hover:text-[var(--accent)]">
                      /api/ai-code-index
                    </Link>
                  </div>
                </div>
                <div>
                  {NEWS_FEED.map((item, i) => (
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
