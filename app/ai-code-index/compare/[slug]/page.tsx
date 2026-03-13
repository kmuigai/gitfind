import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAICodeIndexData } from '@/lib/queries'
import AICodeIndexChart from '@/components/AICodeIndexChart'

export const revalidate = 3600

const TOOLS = [
  { name: 'Claude Code', slug: 'claude-code', color: '#6c6af6' },
  { name: 'Cursor', slug: 'cursor', color: '#f59e0b' },
  { name: 'GitHub Copilot', slug: 'copilot', color: '#3b82f6' },
  { name: 'Aider', slug: 'aider', color: '#22c55e' },
  { name: 'Gemini CLI', slug: 'gemini-cli', color: '#ef4444' },
  { name: 'Devin', slug: 'devin', color: '#a855f7' },
  { name: 'Codex', slug: 'codex', color: '#10b981' },
] as const

type Tool = (typeof TOOLS)[number]

function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

/** Generate all 15 pairwise combinations at build time */
export function generateStaticParams() {
  const params: Array<{ slug: string }> = []
  for (let i = 0; i < TOOLS.length; i++) {
    for (let j = i + 1; j < TOOLS.length; j++) {
      params.push({ slug: `${TOOLS[i].slug}-vs-${TOOLS[j].slug}` })
    }
  }
  return params
}

function parseSlug(slug: string): { toolA: Tool; toolB: Tool } | null {
  const parts = slug.split('-vs-')
  if (parts.length !== 2) return null
  const toolA = getToolBySlug(parts[0])
  const toolB = getToolBySlug(parts[1])
  if (!toolA || !toolB) return null
  return { toolA, toolB }
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const parsed = parseSlug(slug)
  if (!parsed) return { title: 'Comparison Not Found' }

  const { toolA, toolB } = parsed
  const title = `${toolA.name} vs ${toolB.name} — AI Coding Tool Comparison`
  const description = `Compare ${toolA.name} and ${toolB.name} side by side. Daily commit counts, growth trends, and adoption data across all public GitHub repositories.`
  const url = `https://gitfind.ai/ai-code-index/compare/${slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | GitFind`,
      description,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | GitFind`,
      description,
    },
  }
}

interface ToolStats {
  totalCommits: number
  avg30d: number
  peakDay: { date: string; count: number }
  trend: 'up' | 'down' | 'flat'
  trendPct: number
}

function computeStats(
  data: Array<{ date: string; [tool: string]: number | string }>,
  toolName: string
): ToolStats {
  const totalCommits = data.reduce((sum, row) => sum + ((row[toolName] as number) || 0), 0)

  const last30 = data.slice(-30)
  const avg30d = last30.length > 0
    ? Math.round(last30.reduce((sum, row) => sum + ((row[toolName] as number) || 0), 0) / last30.length)
    : 0

  let peakDay = { date: '', count: 0 }
  for (const row of data) {
    const count = (row[toolName] as number) || 0
    if (count > peakDay.count) {
      peakDay = { date: row.date, count }
    }
  }

  // Trend: compare last 30d avg to prior 30d avg
  const prior30 = data.slice(-60, -30)
  const priorAvg = prior30.length > 0
    ? prior30.reduce((sum, row) => sum + ((row[toolName] as number) || 0), 0) / prior30.length
    : 0

  let trend: 'up' | 'down' | 'flat' = 'flat'
  let trendPct = 0
  if (priorAvg > 0) {
    trendPct = Math.round(((avg30d - priorAvg) / priorAvg) * 100)
    if (trendPct > 5) trend = 'up'
    else if (trendPct < -5) trend = 'down'
  } else if (avg30d > 0) {
    trend = 'up'
    trendPct = 100
  }

  return { totalCommits, avg30d, peakDay, trend, trendPct }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatDate(date: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [year, m, d] = date.split('-')
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${year}`
}

function buildVerdict(
  toolA: Tool,
  toolB: Tool,
  statsA: ToolStats,
  statsB: ToolStats
): string {
  const parts: string[] = []

  // Volume comparison
  if (statsA.avg30d > 0 && statsB.avg30d > 0) {
    const ratio = statsA.avg30d / statsB.avg30d
    if (ratio > 1.2) {
      parts.push(
        `${toolA.name} averages ${ratio.toFixed(1)}x more daily commits than ${toolB.name} over the last 30 days.`
      )
    } else if (ratio < 0.8) {
      const inv = statsB.avg30d / statsA.avg30d
      parts.push(
        `${toolB.name} averages ${inv.toFixed(1)}x more daily commits than ${toolA.name} over the last 30 days.`
      )
    } else {
      parts.push(
        `${toolA.name} and ${toolB.name} are neck and neck in daily commit volume over the last 30 days.`
      )
    }
  } else if (statsA.avg30d > 0) {
    parts.push(`${toolA.name} is actively generating commits while ${toolB.name} has minimal recent activity.`)
  } else if (statsB.avg30d > 0) {
    parts.push(`${toolB.name} is actively generating commits while ${toolA.name} has minimal recent activity.`)
  }

  // Growth comparison
  if (statsA.trend === 'up' && statsB.trend !== 'up') {
    parts.push(`${toolA.name} is on an upward trend (+${statsA.trendPct}%) while ${toolB.name} is ${statsB.trend === 'down' ? 'declining' : 'holding steady'}.`)
  } else if (statsB.trend === 'up' && statsA.trend !== 'up') {
    parts.push(`${toolB.name} is on an upward trend (+${statsB.trendPct}%) while ${toolA.name} is ${statsA.trend === 'down' ? 'declining' : 'holding steady'}.`)
  } else if (statsA.trend === 'up' && statsB.trend === 'up') {
    if (statsA.trendPct > statsB.trendPct + 10) {
      parts.push(`Both are growing, but ${toolA.name} is accelerating faster (+${statsA.trendPct}% vs +${statsB.trendPct}%).`)
    } else if (statsB.trendPct > statsA.trendPct + 10) {
      parts.push(`Both are growing, but ${toolB.name} is accelerating faster (+${statsB.trendPct}% vs +${statsA.trendPct}%).`)
    } else {
      parts.push(`Both tools are growing at a similar pace.`)
    }
  }

  return parts.join(' ') || `Compare ${toolA.name} and ${toolB.name} commit activity in the chart above.`
}

function getOtherComparisons(toolA: Tool, toolB: Tool): Array<{ slug: string; label: string }> {
  const comparisons: Array<{ slug: string; label: string }> = []
  for (let i = 0; i < TOOLS.length; i++) {
    for (let j = i + 1; j < TOOLS.length; j++) {
      const slug = `${TOOLS[i].slug}-vs-${TOOLS[j].slug}`
      if (
        (TOOLS[i].slug === toolA.slug && TOOLS[j].slug === toolB.slug) ||
        (TOOLS[i].slug === toolB.slug && TOOLS[j].slug === toolA.slug)
      ) continue
      if (
        TOOLS[i].slug === toolA.slug ||
        TOOLS[j].slug === toolA.slug ||
        TOOLS[i].slug === toolB.slug ||
        TOOLS[j].slug === toolB.slug
      ) {
        comparisons.push({ slug, label: `${TOOLS[i].name} vs ${TOOLS[j].name}` })
      }
    }
  }
  return comparisons
}

export default async function ComparePage({ params }: Props) {
  const { slug } = await params
  const parsed = parseSlug(slug)
  if (!parsed) notFound()

  const { toolA, toolB } = parsed
  const allData = await getAICodeIndexData()

  // Filter data to only include the two tools
  const data = allData.map((row) => ({
    date: row.date,
    [toolA.name]: row[toolA.name] ?? 0,
    [toolB.name]: row[toolB.name] ?? 0,
  }))

  const statsA = computeStats(allData, toolA.name)
  const statsB = computeStats(allData, toolB.name)
  const verdict = buildVerdict(toolA, toolB, statsA, statsB)
  const otherComparisons = getOtherComparisons(toolA, toolB)

  const trendIcon = (trend: 'up' | 'down' | 'flat') => {
    if (trend === 'up') return '↑'
    if (trend === 'down') return '↓'
    return '→'
  }

  const trendColor = (trend: 'up' | 'down' | 'flat') => {
    if (trend === 'up') return 'text-[var(--score-high)]'
    if (trend === 'down') return 'text-[var(--error)]'
    return 'text-[var(--foreground-muted)]'
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${toolA.name} vs ${toolB.name} — AI Coding Tool Comparison`,
    description: `Compare ${toolA.name} and ${toolB.name} side by side. Daily commit counts, growth trends, and adoption data.`,
    url: `https://gitfind.ai/ai-code-index/compare/${slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'GitFind',
      url: 'https://gitfind.ai',
    },
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1400px]">
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <Link href="/ai-code-index" className="transition-colors hover:text-[var(--foreground)]">
              AI Code Index
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">Compare</span>
          </nav>

          <h1 className="font-mono text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            <span style={{ color: toolA.color }}>{toolA.name}</span>
            <span className="text-[var(--foreground-muted)]"> vs </span>
            <span style={{ color: toolB.color }}>{toolB.name}</span>
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm text-[var(--foreground-muted)] leading-relaxed">
            Head-to-head comparison based on daily public GitHub commit data.
          </p>
        </div>
      </section>

      {/* Chart */}
      <section className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[1400px]">
          {data.length >= 2 ? (
            <AICodeIndexChart data={data} />
          ) : (
            <div className="border border-dashed border-[var(--border)] py-16 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">Not enough data to display a chart yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Stats comparison */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[1400px]">
          <h2 className="mb-6 font-mono text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
            By the numbers
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Tool headers */}
            <div className="flex items-center gap-2 font-mono text-sm font-semibold" style={{ color: toolA.color }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: toolA.color }} />
              {toolA.name}
            </div>
            <div className="flex items-center gap-2 font-mono text-sm font-semibold" style={{ color: toolB.color }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: toolB.color }} />
              {toolB.name}
            </div>

            {/* Total commits */}
            {[statsA, statsB].map((stats, i) => (
              <div key={`total-${i}`} className="rounded-sm border border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">Total commits</div>
                <div className="mt-1 font-mono text-lg font-semibold text-[var(--foreground)]">{formatNumber(stats.totalCommits)}</div>
              </div>
            ))}

            {/* Avg daily (30d) */}
            {[statsA, statsB].map((stats, i) => (
              <div key={`avg-${i}`} className="rounded-sm border border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">Avg daily (30d)</div>
                <div className="mt-1 font-mono text-lg font-semibold text-[var(--foreground)]">{formatNumber(stats.avg30d)}</div>
              </div>
            ))}

            {/* Peak day */}
            {[statsA, statsB].map((stats, i) => (
              <div key={`peak-${i}`} className="rounded-sm border border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">Peak day</div>
                <div className="mt-1 font-mono text-lg font-semibold text-[var(--foreground)]">{formatNumber(stats.peakDay.count)}</div>
                {stats.peakDay.date && (
                  <div className="font-mono text-[10px] text-[var(--foreground-subtle)]">{formatDate(stats.peakDay.date)}</div>
                )}
              </div>
            ))}

            {/* Trend */}
            {[statsA, statsB].map((stats, i) => (
              <div key={`trend-${i}`} className="rounded-sm border border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">30d trend</div>
                <div className={`mt-1 font-mono text-lg font-semibold ${trendColor(stats.trend)}`}>
                  {trendIcon(stats.trend)} {stats.trendPct > 0 ? '+' : ''}{stats.trendPct}%
                </div>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div className="mt-8 rounded-sm border border-[var(--accent)]/20 bg-[var(--accent-subtle)] p-5">
            <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
              What the data says
            </h3>
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
              {verdict}
            </p>
          </div>
        </div>
      </section>

      {/* Other comparisons */}
      {otherComparisons.length > 0 && (
        <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-[1400px]">
            <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
              More comparisons
            </h2>
            <div className="flex flex-wrap gap-2">
              {otherComparisons.map((comp) => (
                <Link
                  key={comp.slug}
                  href={`/ai-code-index/compare/${comp.slug}`}
                  className="rounded-sm border border-[var(--border)] px-3 py-1.5 font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {comp.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
