import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRisingRepos, getSnapshotDates } from '@/lib/queries'
import type { RisingRepo } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'

export const revalidate = 3600

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWeekLabel(date: string): string {
  const [y, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
}

// Find the closest snapshot date to the requested week date
async function findClosestSnapshotDate(weekDate: string): Promise<string | null> {
  const dates = await getSnapshotDates()
  if (dates.length === 0) return null

  const target = new Date(weekDate).getTime()
  // Find the closest date within 7 days of the target
  let closest: string | null = null
  let closestDiff = Infinity
  for (const d of dates) {
    const diff = Math.abs(new Date(d).getTime() - target)
    if (diff < closestDiff && diff <= 7 * 24 * 60 * 60 * 1000) {
      closest = d
      closestDiff = diff
    }
  }
  return closest
}

interface Props {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  if (!isValidDate(date)) return {}

  const weekLabel = formatWeekLabel(date)
  const url = `https://gitfind.ai/insights/rising-this-week/${date}`

  return {
    title: `Rising This Week: ${weekLabel} — Fastest-Growing Repos on GitHub`,
    description: `The 10 fastest-accelerating GitHub repos for the week of ${weekLabel}, ranked by star velocity with week-over-week momentum signals.`,
    alternates: { canonical: url },
    openGraph: {
      title: `Rising This Week: ${weekLabel} — GitFind Insights`,
      description: `The 10 fastest-accelerating GitHub repos for the week of ${weekLabel}, ranked by 7-day star velocity.`,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Rising This Week: ${weekLabel} — GitFind Insights`,
      description: `The 10 fastest-accelerating GitHub repos for the week of ${weekLabel}, ranked by 7-day star velocity.`,
    },
  }
}

function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatAcceleration(current: number, prev: number): { label: string; positive: boolean } | null {
  if (prev <= 0) return current > 0 ? { label: 'new', positive: true } : null
  const pct = ((current - prev) / prev) * 100
  const sign = pct >= 0 ? '+' : ''
  return {
    label: `${sign}${pct.toFixed(0)}% WoW`,
    positive: pct >= 0,
  }
}

function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 70 ? 'Breakout' : score >= 40 ? 'Hot' : 'Active'
  const color =
    score >= 70
      ? 'text-[var(--badge-breakout)] border-[var(--badge-breakout)]/30 bg-[var(--badge-breakout)]/10'
      : score >= 40
        ? 'text-[var(--badge-hot)] border-[var(--badge-hot)]/30 bg-[var(--badge-hot)]/10'
        : 'text-[var(--badge-active)] border-[var(--badge-active)]/30 bg-[var(--badge-active)]/10'

  return (
    <span className={`inline-flex flex-col items-center rounded-[3px] border px-2 py-0.5 ${color}`}>
      <span className="font-mono text-xs font-bold leading-tight">{score}</span>
      <span className="text-[9px] font-medium leading-tight opacity-80">{tier}</span>
    </span>
  )
}

function RepoRow({ repo, rank }: { repo: RisingRepo; rank: number }) {
  const score = repo.enrichment?.early_signal_score ?? 0
  const accel = formatAcceleration(repo.stars_7d, repo.stars_7d_prev)

  return (
    <article className="group rounded-sm border border-[var(--border)] bg-[var(--background-card)] p-5 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)]">
      <div className="flex items-start gap-4">
        <span className="font-mono text-2xl font-bold text-[var(--foreground-subtle)] w-8 text-right shrink-0 pt-1">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/project/${repo.owner}/${repo.name}`}
                className="font-mono text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
              >
                <span className="text-[var(--foreground-muted)]">{repo.owner}/</span>
                <span>{repo.name}</span>
              </Link>
              {repo.enrichment?.summary && (
                <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
                  {repo.enrichment.summary}
                </p>
              )}
            </div>
            <ScoreBadge score={score} />
          </div>

          {repo.enrichment?.why_it_matters && (
            <div className="mt-3 bg-[var(--accent-subtle)] px-3 py-2">
              <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                <span className="font-mono font-medium text-[var(--accent)]">{'// why it matters '}</span>
                {repo.enrichment.why_it_matters}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-xs text-[var(--score-high)] font-medium">
              +{formatStars(repo.stars_7d)} stars this week
            </span>
            {accel && (
              <span
                className="font-mono text-xs font-medium"
                style={{ color: accel.positive ? 'var(--score-high)' : 'var(--error)' }}
              >
                {accel.label}
              </span>
            )}
            <span className="font-mono text-xs text-[var(--foreground-subtle)]">
              {formatStars(repo.stars)} total stars
            </span>
            <span className="font-mono text-xs text-[var(--foreground-subtle)]">
              {formatStars(repo.forks)} forks
            </span>
            {repo.language && (
              <span className="font-mono text-xs text-[var(--foreground-subtle)]">
                {repo.language}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4">
            {repo.enrichment?.category && (
              <Link
                href={`/category/${repo.enrichment.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                className="text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--accent)]"
              >
                {repo.enrichment.category}
              </Link>
            )}
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground)]"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

function buildJsonLd(repos: RisingRepo[], weekDate: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Rising GitHub Repos — Week of ${formatWeekLabel(weekDate)}`,
    description: `The ${repos.length} fastest-accelerating GitHub repos for the week of ${formatWeekLabel(weekDate)}, ranked by 7-day star velocity.`,
    url: `https://gitfind.ai/insights/rising-this-week/${weekDate}`,
    numberOfItems: repos.length,
    itemListElement: repos.map((repo, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SoftwareSourceCode',
        name: `${repo.owner}/${repo.name}`,
        description: repo.enrichment?.summary ?? repo.description ?? '',
        url: `https://gitfind.ai/project/${repo.owner}/${repo.name}`,
        codeRepository: repo.url,
        programmingLanguage: repo.language ?? undefined,
      },
    })),
  }
}

export default async function RisingThisWeekDatePage({ params }: Props) {
  const { date } = await params

  if (!isValidDate(date)) notFound()

  // Find closest snapshot date to the requested week
  const snapshotDate = await findClosestSnapshotDate(date)
  const repos = snapshotDate ? await getRisingRepos(10, snapshotDate) : []

  const weekLabel = formatWeekLabel(date)

  // Compute prev/next week URLs
  const currentD = new Date(date)
  const prevWeekD = new Date(currentD)
  prevWeekD.setDate(currentD.getDate() - 7)
  const nextWeekD = new Date(currentD)
  nextWeekD.setDate(currentD.getDate() + 7)
  const prevWeek = prevWeekD.toISOString().slice(0, 10)
  const nextWeek = nextWeekD.toISOString().slice(0, 10)
  const isCurrentWeek = nextWeekD > new Date()

  // Summary stats
  const totalStarsGained = repos.reduce((sum, r) => sum + r.stars_7d, 0)
  const withPrev = repos.filter(r => r.stars_7d_prev > 0)
  const avgAccel = withPrev.length > 0
    ? withPrev.reduce((sum, r) => sum + ((r.stars_7d - r.stars_7d_prev) / r.stars_7d_prev) * 100, 0) / withPrev.length
    : 0

  const jsonLd = buildJsonLd(repos, date)

  return (
    <div>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[1400px]">
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <Link href="/insights" className="transition-colors hover:text-[var(--foreground)]">
              Insights
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">Rising This Week</span>
          </nav>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-[3px] border border-[var(--score-high)]/30 bg-[var(--score-high)]/5 px-2.5 py-0.5 font-mono text-[10px] font-medium text-[var(--score-high)]">
                WEEKLY
              </span>
              <span className="font-mono text-[10px] text-[var(--foreground-subtle)]">
                Week of {weekLabel}
              </span>
            </div>
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Link
                href={`/insights/rising-this-week/${prevWeek}`}
                className="rounded-sm border border-[var(--border)] px-2.5 py-1 font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
              >
                ← Prev
              </Link>
              {!isCurrentWeek && (
                <Link
                  href={`/insights/rising-this-week/${nextWeek}`}
                  className="rounded-sm border border-[var(--border)] px-2.5 py-1 font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>

          <h1 className="mt-4 font-mono text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            <span className="text-[var(--accent)]">{'// '}</span>RISING THIS WEEK
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            The {repos.length} fastest-accelerating repos on GitHub for the week of {weekLabel}. Ranked by 7-day star velocity, filtered to projects with enriched context.
          </p>

          {/* Summary KPIs */}
          {repos.length > 0 && (
            <div
              className="mt-6 grid grid-cols-3 rounded-sm border border-[var(--border-subtle)]"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="px-4 py-3 text-center border-r border-[var(--border-subtle)]">
                <div className="font-mono text-lg font-bold text-[var(--foreground)] sm:text-xl">
                  {formatStars(totalStarsGained)}
                </div>
                <div className="font-mono text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">
                  Stars gained
                </div>
              </div>
              <div className="px-4 py-3 text-center border-r border-[var(--border-subtle)]">
                <div className="font-mono text-lg font-bold text-[var(--foreground)] sm:text-xl">
                  {repos.length}
                </div>
                <div className="font-mono text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">
                  Repos ranked
                </div>
              </div>
              <div className="px-4 py-3 text-center">
                <div
                  className="font-mono text-lg font-bold sm:text-xl"
                  style={{ color: avgAccel >= 0 ? 'var(--score-high)' : 'var(--error)' }}
                >
                  {avgAccel >= 0 ? '+' : ''}{avgAccel.toFixed(0)}%
                </div>
                <div className="font-mono text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">
                  Avg WoW accel
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Rankings */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1400px]">
          {repos.length > 0 ? (
            <div className="space-y-4">
              {repos.map((repo, i) => (
                <RepoRow key={repo.id} repo={repo} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-[var(--border)] py-16 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
                No snapshot data available for this week.
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                Try navigating to a different week, or check the latest ranking.
              </p>
              <Link
                href="/insights/rising-this-week"
                className="mt-4 inline-block font-mono text-xs text-[var(--accent)] hover:underline"
              >
                View latest →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1400px]">
          <h2 className="font-mono text-sm font-medium text-[var(--foreground-muted)]">
            Methodology
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-subtle)]">
            Repos are ranked by 7-day star velocity — the number of new stars gained in the last 7 days.
            Only repos with enriched context (Claude-generated summaries and Early Signal Scores) are included.
            Week-over-week acceleration compares this week&apos;s star gain to the previous week&apos;s.
            Data is sourced from daily GitHub API snapshots and refreshed every hour.
          </p>
          <div className="mt-4 flex gap-4">
            <Link
              href="/insights"
              className="font-mono text-xs text-[var(--accent)] transition-colors hover:underline"
            >
              ← All Insights
            </Link>
            <Link
              href="/ai-code-index"
              className="font-mono text-xs text-[var(--accent)] transition-colors hover:underline"
            >
              AI Code Index →
            </Link>
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
