import type { Metadata } from 'next'
import Link from 'next/link'
import { getAICodeIndexData } from '@/lib/queries'
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

export default async function AICodeIndexPage() {
  const data = await getAICodeIndexData()
  const stats = data.length >= 2 ? computeToolStats(data) : []

  const totalCommits = stats.reduce((s, t) => s + t.totalCommits, 0)
  const totalCommits30d = stats.reduce((s, t) => s + t.avg30d * 30, 0)
  const totalCommitsPrior30d = stats.reduce((s, t) => s + t.avg30dPrior * 30, 0)
  const overallTrend = totalCommitsPrior30d > 0
    ? ((totalCommits30d - totalCommitsPrior30d) / totalCommitsPrior30d) * 100
    : 0

  // Growth leaderboard: sort by 30d trend
  const leaderboard = [...stats]
    .filter((t) => t.avg30d > 0)
    .sort((a, b) => b.trendPct - a.trendPct)

  // Market share: sort by 30d share descending
  const marketShare = [...stats]
    .filter((t) => t.share30d > 0)
    .sort((a, b) => b.share30d - a.share30d)

  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">AI Code Index</span>
          </nav>

          <h1 className="font-mono text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            AI Code Index
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm text-[var(--foreground-muted)] leading-relaxed">
            Tracking the rise of AI-written code across 7 tools and all public GitHub repositories.
            Updated daily.
          </p>
        </div>
      </section>

      {data.length >= 2 ? (
        <>
          {/* Hero Metric + Tool Cards */}
          <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-4xl">
              {/* Hero */}
              <div className="mb-8 flex items-baseline gap-4">
                <span className="font-mono text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
                  {formatNum(totalCommits)}
                </span>
                <span className="font-mono text-sm text-[var(--foreground-muted)]">
                  total commits tracked
                </span>
                {overallTrend !== 0 && (
                  <span
                    className="font-mono text-sm font-medium"
                    style={{ color: overallTrend > 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {formatPct(overallTrend)} 30d
                  </span>
                )}
              </div>

              {/* Tool Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {stats.map((tool) => (
                  <Link
                    key={tool.name}
                    href={`/ai-code-index/compare/${TOOL_SLUGS[tool.name]}-vs-${TOOL_SLUGS[stats.find((t) => t.name !== tool.name)?.name ?? 'cursor']}`}
                    className="group rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3 transition-colors hover:border-[var(--accent)]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tool.color }}
                      />
                      <span className="font-mono text-xs text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
                        {tool.name}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-lg font-semibold text-[var(--foreground)]">
                      {formatNum(Math.round(tool.avg30d))}
                      <span className="text-xs font-normal text-[var(--foreground-subtle)]">/day</span>
                    </div>
                    <div className="mt-0.5">
                      <span
                        className="font-mono text-xs font-medium"
                        style={{
                          color: tool.trend === 'up' ? '#22c55e' : tool.trend === 'down' ? '#ef4444' : 'var(--foreground-subtle)',
                        }}
                      >
                        {tool.trend === 'up' ? '▲' : tool.trend === 'down' ? '▼' : '—'}{' '}
                        {formatPct(tool.trendPct)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Chart */}
          <section className="px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto max-w-4xl">
              <AICodeIndexChart data={data} />
            </div>
          </section>

          {/* Growth Leaderboard + Market Share — side by side */}
          <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Growth Leaderboard */}
              <div>
                <h2 className="font-mono text-lg font-semibold text-[var(--foreground)]">
                  Growth (30d)
                </h2>
                <p className="mt-1 font-mono text-xs text-[var(--foreground-subtle)]">
                  Sorted by 30-day momentum
                </p>
                <div className="mt-4 space-y-2">
                  {leaderboard.map((tool, i) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-2.5"
                    >
                      <span className="font-mono text-xs text-[var(--foreground-subtle)] w-4">
                        {i + 1}.
                      </span>
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tool.color }}
                      />
                      <span className="font-mono text-sm text-[var(--foreground)] flex-1">
                        {tool.name}
                      </span>
                      <span className="font-mono text-xs text-[var(--foreground-muted)]">
                        {formatNum(Math.round(tool.avg30d))}/day
                      </span>
                      <span
                        className="font-mono text-xs font-medium w-16 text-right"
                        style={{
                          color: tool.trend === 'up' ? '#22c55e' : tool.trend === 'down' ? '#ef4444' : 'var(--foreground-subtle)',
                        }}
                      >
                        {formatPct(tool.trendPct)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Share */}
              <div>
                <h2 className="font-mono text-lg font-semibold text-[var(--foreground)]">
                  Market share (30d)
                </h2>
                <p className="mt-1 font-mono text-xs text-[var(--foreground-subtle)]">
                  Share of all AI-authored commits
                </p>
                <div className="mt-4 space-y-3">
                  {marketShare.map((tool) => (
                    <div key={tool.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: tool.color }}
                          />
                          <span className="font-mono text-sm text-[var(--foreground)]">
                            {tool.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-[var(--foreground-muted)]">
                          {tool.share30d.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--border)]">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.max(tool.share30d, 0.5)}%`,
                            backgroundColor: tool.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
                No data yet — run{' '}
                <code className="font-mono text-[var(--accent)]">npx tsx scripts/search-commits.ts</code>{' '}
                to start collecting.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Compare */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-mono text-lg font-semibold text-[var(--foreground)]">
            Head-to-head comparisons
          </h2>
          <p className="mt-2 font-mono text-sm text-[var(--foreground-muted)] leading-relaxed">
            Pick any two tools and compare their commit activity, growth trends, and adoption side by side.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { slug: 'claude-code-vs-cursor', label: 'Claude Code vs Cursor', colors: ['#6c6af6', '#f59e0b'] },
              { slug: 'claude-code-vs-copilot', label: 'Claude Code vs Copilot', colors: ['#6c6af6', '#3b82f6'] },
              { slug: 'cursor-vs-copilot', label: 'Cursor vs Copilot', colors: ['#f59e0b', '#3b82f6'] },
              { slug: 'claude-code-vs-gemini-cli', label: 'Claude Code vs Gemini CLI', colors: ['#6c6af6', '#ef4444'] },
              { slug: 'claude-code-vs-aider', label: 'Claude Code vs Aider', colors: ['#6c6af6', '#22c55e'] },
              { slug: 'cursor-vs-gemini-cli', label: 'Cursor vs Gemini CLI', colors: ['#f59e0b', '#ef4444'] },
            ].map(({ slug, label, colors }) => (
              <Link
                key={slug}
                href={`/ai-code-index/compare/${slug}`}
                className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3 transition-colors hover:border-[var(--accent)]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[0] }} />
                  <span className="font-mono text-xs text-[var(--foreground-muted)]">vs</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[1] }} />
                </div>
                <span className="font-mono text-sm text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
                  {label}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link
              href="/ai-code-index/compare/claude-code-vs-devin"
              className="font-mono text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--accent)]"
            >
              View all 21 comparisons →
            </Link>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-mono text-lg font-semibold text-[var(--foreground)]">
            How we track this
          </h2>
          <p className="mt-2 font-mono text-sm text-[var(--foreground-muted)] leading-relaxed">
            We query the GitHub Search API daily for commit signatures left by each tool.
            Claude Code, Cursor, Aider, and Codex add Co-Authored-By trailers. Copilot&apos;s coding
            agent commits as a bot account. Devin uses a distinct author email. These are
            public commits only — the true volume is higher.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { tool: 'Claude Code', method: 'Co-Authored-By trailer', color: '#6c6af6' },
              { tool: 'Cursor', method: 'Co-Authored-By trailer', color: '#f59e0b' },
              { tool: 'GitHub Copilot', method: 'Bot committer account', color: '#3b82f6' },
              { tool: 'Aider', method: 'Co-Authored-By trailer', color: '#22c55e' },
              { tool: 'Gemini CLI', method: 'Co-Authored-By trailer', color: '#ef4444' },
              { tool: 'Devin', method: 'Bot author email', color: '#a855f7' },
              { tool: 'Codex', method: 'Co-Authored-By trailer', color: '#10b981' },
            ].map(({ tool, method, color }) => (
              <div
                key={tool}
                className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3"
              >
                <div className="flex items-center gap-2 font-mono text-sm font-medium text-[var(--foreground)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {tool}
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--foreground-muted)]">
                  {method}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
