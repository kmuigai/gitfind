import type { Metadata } from 'next'
import Link from 'next/link'
import { getBreakoutRepos } from '@/lib/queries'
import type { BreakoutRepo } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Breakout Repos — Projects Crossing Star Milestones',
  description:
    'GitHub repos that crossed major star milestones (1k, 5k, 10k, 25k, 50k, 100k) in the last 30 days. Powered by GitFind data.',
  alternates: { canonical: 'https://gitfind.ai/insights/breakout-repos' },
  openGraph: {
    title: 'Breakout Repos — GitFind Insights',
    description:
      'GitHub repos that crossed major star milestones in the last 30 days.',
    url: 'https://gitfind.ai/insights/breakout-repos',
  },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatThreshold(t: number): string {
  if (t >= 1000) return `${t / 1000}k`
  return String(t)
}

function thresholdColor(t: number): string {
  if (t >= 100_000) return '#f59e0b'
  if (t >= 50_000) return '#f59e0b'
  if (t >= 25_000) return '#6c6af6'
  if (t >= 10_000) return '#6c6af6'
  if (t >= 5_000) return '#22c55e'
  return '#22c55e'
}

function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 70 ? 'Trending' : score >= 40 ? 'Rising' : 'Watch'
  const color =
    score >= 70
      ? 'text-[var(--score-high)] border-[var(--score-high)]/30 bg-[var(--score-high)]/5'
      : score >= 40
        ? 'text-[var(--score-mid)] border-[var(--score-mid)]/30 bg-[var(--score-mid)]/5'
        : 'text-[var(--score-low)] border-[var(--score-low)]/30 bg-[var(--score-low)]/5'

  return (
    <span className={`inline-flex flex-col items-center rounded-full border px-2 py-0.5 ${color}`}>
      <span className="font-mono text-xs font-bold leading-tight">{score}</span>
      <span className="text-[9px] font-medium leading-tight opacity-80">{tier}</span>
    </span>
  )
}

function RepoRow({ repo }: { repo: BreakoutRepo }) {
  const score = repo.enrichment?.early_signal_score ?? 0
  const gained = repo.stars_now - repo.stars_30d_ago
  const color = thresholdColor(repo.threshold)

  return (
    <article className="group rounded-lg border border-[var(--border)] bg-[var(--background-card)] p-5 transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)]">
      <div className="flex items-start gap-4">
        {/* Threshold badge */}
        <div className="shrink-0 pt-1">
          <span
            className="inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-sm font-bold"
            style={{
              color,
              borderColor: `${color}33`,
              backgroundColor: `${color}0d`,
            }}
          >
            {formatThreshold(repo.threshold)}★
          </span>
        </div>

        {/* Content */}
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
            <div className="mt-3 rounded-md bg-[var(--accent-subtle)] px-3 py-2">
              <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                <span className="font-mono font-medium text-[var(--accent)]">{'// why it matters '}</span>
                {repo.enrichment.why_it_matters}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-xs font-medium" style={{ color }}>
              Crossed {formatThreshold(repo.threshold)} stars
            </span>
            <span className="font-mono text-xs text-[var(--score-high)] font-medium">
              +{formatStars(gained)} in 30d
            </span>
            <span className="font-mono text-xs text-[var(--foreground-subtle)]">
              {formatStars(repo.stars_now)} total
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

function buildJsonLd(repos: BreakoutRepo[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Breakout GitHub Repos — Projects Crossing Star Milestones',
    description: `${repos.length} GitHub repos that crossed major star milestones in the last 30 days.`,
    url: 'https://gitfind.ai/insights/breakout-repos',
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

export default async function BreakoutReposPage() {
  const repos = await getBreakoutRepos()

  const now = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  // Group by threshold for summary
  const thresholdCounts = new Map<number, number>()
  for (const r of repos) {
    thresholdCounts.set(r.threshold, (thresholdCounts.get(r.threshold) ?? 0) + 1)
  }

  const totalGained = repos.reduce((sum, r) => sum + (r.stars_now - r.stars_30d_ago), 0)

  const jsonLd = buildJsonLd(repos)

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <Link href="/insights" className="transition-colors hover:text-[var(--foreground)]">
              Insights
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">Breakout Repos</span>
          </nav>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-2.5 py-0.5 font-mono text-[10px] font-medium text-[var(--accent)]">
              MONTHLY
            </span>
            <span className="font-mono text-[10px] text-[var(--foreground-subtle)]">
              {monthLabel}
            </span>
          </div>

          <h1 className="mt-4 font-mono text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            Breakout Repos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Projects that crossed major star milestones in the last 30 days — from unknown to 1k, from 1k to 10k, and beyond. These are the repos that just hit escape velocity.
          </p>

          {/* Summary KPIs */}
          {repos.length > 0 && (
            <div
              className="mt-6 grid grid-cols-3 rounded-lg border border-[var(--border-subtle)]"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="px-4 py-3 text-center border-r border-[var(--border-subtle)]">
                <div className="font-mono text-lg font-bold text-[var(--foreground)] sm:text-xl">
                  {repos.length}
                </div>
                <div className="font-mono text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">
                  Breakouts
                </div>
              </div>
              <div className="px-4 py-3 text-center border-r border-[var(--border-subtle)]">
                <div className="font-mono text-lg font-bold text-[var(--foreground)] sm:text-xl">
                  {formatStars(totalGained)}
                </div>
                <div className="font-mono text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">
                  Stars gained
                </div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="font-mono text-lg font-bold text-[var(--foreground)] sm:text-xl">
                  {Array.from(thresholdCounts.keys()).length}
                </div>
                <div className="font-mono text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">
                  Tiers crossed
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Rankings */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          {repos.length > 0 ? (
            <div className="space-y-4">
              {repos.map((repo) => (
                <RepoRow key={repo.id} repo={repo} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
                No breakout repos detected in the last 30 days.
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                This report requires at least 30 days of snapshot data to compare milestones.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-mono text-sm font-medium text-[var(--foreground-muted)]">
            Methodology
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-subtle)]">
            A breakout is defined as a repo whose star count crossed a major threshold (1k, 5k, 10k, 25k, 50k, or 100k) within the last 30 days.
            Only repos with enriched context are included. Each repo is tagged with the highest threshold crossed.
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
              href="/insights/rising-this-week"
              className="font-mono text-xs text-[var(--accent)] transition-colors hover:underline"
            >
              Rising This Week →
            </Link>
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
