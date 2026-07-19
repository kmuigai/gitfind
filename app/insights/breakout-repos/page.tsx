import type { Metadata } from 'next'
import Link from 'next/link'
import { getBreakoutRepos } from '@/lib/queries'
import type { BreakoutRepo } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import RepoCard from '@/components/RepoCard'
import Reveal from '@/components/Reveal'
import { formatCount } from '@/lib/design'

// force-dynamic: skip build-time generation — queries are too slow until Supabase region is aligned with Vercel
// TODO: revert to `export const revalidate = 3600` once region latency is fixed
export const dynamic = 'force-dynamic'

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

function formatThreshold(t: number): string {
  if (t >= 1000) return `${t / 1000}k`
  return String(t)
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

  // Repos arrive sorted threshold DESC, then stars DESC — group contiguously
  // so each milestone tier gets its own catalog section.
  const groups: { threshold: number; repos: BreakoutRepo[] }[] = []
  for (const r of repos) {
    const last = groups[groups.length - 1]
    if (last && last.threshold === r.threshold) {
      last.repos.push(r)
    } else {
      groups.push({ threshold: r.threshold, repos: [r] })
    }
  }

  const jsonLd = buildJsonLd(repos)

  return (
    <div>
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
            <span className="text-[var(--ink)]">breakout repos</span>
          </nav>

          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            BREAKOUT REPOS
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Projects that crossed major star milestones in the last 30 days — from
            unknown to 1k, from 1k to 10k, and beyond. These are the repos that
            just hit escape velocity.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              monthly report
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              {monthLabel}
            </span>
          </div>

          {/* Summary KPIs */}
          {repos.length > 0 && (
            <div className="mt-6 grid grid-cols-3 border-2 border-[var(--line)] bg-[var(--paper)]">
              <div className="border-r-2 border-[var(--line)] px-4 py-3 text-center">
                <p className="font-mono text-lg font-bold text-[var(--ink)] sm:text-xl">
                  {repos.length}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  breakouts
                </p>
              </div>
              <div className="border-r-2 border-[var(--line)] px-4 py-3 text-center">
                <p className="font-mono text-lg font-bold text-[var(--ink)] sm:text-xl">
                  {formatCount(totalGained)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  stars gained
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-mono text-lg font-bold text-[var(--ink)] sm:text-xl">
                  {Array.from(thresholdCounts.keys()).length}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  tiers crossed
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Entries by milestone tier */}
      {repos.length > 0 ? (
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          {groups.map((group, gi) => (
            <section key={group.threshold} className={gi > 0 ? 'mt-10' : ''}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
                <p className="font-bold tracking-[0.2em] text-[var(--ink)]">
                  § {gi + 1} — crossed {formatThreshold(group.threshold)}★
                </p>
                <p>{group.repos.length} {group.repos.length === 1 ? 'entry' : 'entries'}</p>
              </div>
              <Reveal className="mt-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {group.repos.map((repo, i) => (
                    <RepoCard key={repo.id} project={repo} index={i} />
                  ))}
                </div>
              </Reveal>
            </section>
          ))}
        </div>
      ) : (
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="border-2 border-dashed border-[var(--line-soft)] py-16 text-center">
            <p className="font-mono text-sm text-[var(--muted)]">
              No breakout repos detected in the last 30 days.
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">
              This report requires at least 30 days of snapshot data to compare milestones.
            </p>
          </div>
        </section>
      )}

      {/* Methodology */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
          § {groups.length + 1} — methodology
        </h2>
        <p className="mt-3 max-w-2xl border-l-2 border-[var(--line)] pl-4 font-mono text-[13px] leading-[1.8] text-[var(--body)]">
          A breakout is defined as a repo whose star count crossed a major threshold
          (1k, 5k, 10k, 25k, 50k, or 100k) within the last 30 days.
          Only repos with enriched context are included. Each repo is tagged with
          the highest threshold crossed.
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
            href="/insights/rising-this-week"
            className="invert-hover border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]"
          >
            rising this week →
          </Link>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
