import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRisingRepos, getSnapshotDates } from '@/lib/queries'
import type { RisingRepo } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import RepoCard from '@/components/RepoCard'
import Reveal from '@/components/Reveal'
import { formatCount } from '@/lib/design'

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

      {/* Spec header */}
      <section className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-12">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <Link href="/insights" className="invert-hover px-1">insights</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">rising this week</span>
          </nav>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-4xl">
              RISING THIS WEEK
            </h1>
            {/* Week navigation */}
            <div className="flex items-center gap-2 font-mono text-[11.5px]">
              <Link
                href={`/insights/rising-this-week/${prevWeek}`}
                className="invert-hover border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]"
              >
                ← prev week
              </Link>
              {!isCurrentWeek && (
                <Link
                  href={`/insights/rising-this-week/${nextWeek}`}
                  className="invert-hover border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]"
                >
                  next week →
                </Link>
              )}
            </div>
          </div>

          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            The {repos.length} fastest-accelerating repos on GitHub for the week of {weekLabel}.
            Ranked by 7-day star velocity, filtered to projects with enriched context.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              week of {weekLabel}
            </span>
          </div>

          {/* Summary KPIs */}
          {repos.length > 0 && (
            <div className="mt-6 grid grid-cols-3 border-2 border-[var(--line)] bg-[var(--paper)]">
              <div className="border-r-2 border-[var(--line)] px-4 py-3 text-center">
                <p className="font-mono text-lg font-bold text-[var(--ink)] sm:text-xl">
                  {formatCount(totalStarsGained)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  stars gained
                </p>
              </div>
              <div className="border-r-2 border-[var(--line)] px-4 py-3 text-center">
                <p className="font-mono text-lg font-bold text-[var(--ink)] sm:text-xl">
                  {repos.length}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  repos ranked
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className={`font-mono text-lg font-bold sm:text-xl ${avgAccel >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                  {avgAccel >= 0 ? '+' : ''}{avgAccel.toFixed(0)}%
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  avg wow accel
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Rankings */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 1 — the ranking</p>
          <p>{repos.length} entries</p>
        </div>
        {repos.length > 0 ? (
          <Reveal className="mt-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {repos.map((repo, i) => (
                <RepoCard
                  key={repo.id}
                  project={repo}
                  index={i}
                  stars7d={repo.stars_7d}
                  pct7d={
                    repo.stars_7d_prev > 0
                      ? Math.round(((repo.stars_7d - repo.stars_7d_prev) / repo.stars_7d_prev) * 100)
                      : null
                  }
                />
              ))}
            </div>
          </Reveal>
        ) : (
          <div className="mt-5 border-2 border-dashed border-[var(--line-soft)] py-16 text-center">
            <p className="font-mono text-sm text-[var(--muted)]">
              No snapshot data available for this week.
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">
              Try navigating to a different week, or check the latest ranking.
            </p>
            <Link
              href="/insights/rising-this-week"
              className="invert-hover mt-5 inline-block border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--body)]"
            >
              view latest →
            </Link>
          </div>
        )}
      </section>

      {/* Methodology */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
          § 2 — methodology
        </h2>
        <p className="mt-3 max-w-2xl border-l-2 border-[var(--line)] pl-4 font-mono text-[13px] leading-[1.8] text-[var(--body)]">
          Repos are ranked by 7-day star velocity — the number of new stars gained in the last 7 days.
          Only repos with enriched context (Claude-generated summaries and Early Signal Scores) are included.
          Week-over-week acceleration compares this week’s star gain to the previous week’s.
          Data is sourced from daily GitHub API snapshots and refreshed every hour.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 font-mono text-[11.5px]">
          <Link
            href="/insights"
            className="invert-hover border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]"
          >
            ← all insights
          </Link>
          <Link
            href="/ai-code-index"
            className="invert-hover border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]"
          >
            ai code index →
          </Link>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
