import type { Metadata } from 'next'
import Link from 'next/link'
import { getRisingRepos } from '@/lib/queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Insights — Data-Driven Open Source Intelligence',
  description:
    'Weekly rankings, trend analysis, and breakout signals from every public GitHub repo. Powered by GitFind data.',
  alternates: { canonical: 'https://gitfind.ai/insights' },
  openGraph: {
    title: 'Insights — GitFind',
    description:
      'Weekly rankings, trend analysis, and breakout signals from every public GitHub repo.',
    url: 'https://gitfind.ai/insights',
  },
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function getCurrentWeekDate(): string {
  const now = new Date()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - now.getDay())
  const y = sunday.getFullYear()
  const m = String(sunday.getMonth() + 1).padStart(2, '0')
  const d = String(sunday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function InsightsPage() {
  const rising = await getRisingRepos(3)
  const weekDate = getCurrentWeekDate()

  const [, m, d] = weekDate.split('-')
  const weekLabel = `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${weekDate.slice(0, 4)}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'GitFind Insights',
    description: 'Data-driven intelligence from every public GitHub repo. Weekly rankings, breakout signals, and trend analysis.',
    url: 'https://gitfind.ai/insights',
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
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[1400px]">
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">Insights</span>
          </nav>

          <h1 className="font-mono text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            <span className="text-[var(--accent)]">{'// '}</span>INSIGHTS
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Data-driven intelligence from every public GitHub repo. Weekly rankings, breakout signals, and trend analysis — so you see what&apos;s moving before everyone else.
          </p>
        </div>
      </section>

      {/* Featured: Rising This Week */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1400px]">
          <Link
            href={`/insights/rising-this-week/${weekDate}`}
            className="group block rounded-sm border border-[var(--border)] bg-[var(--background-card)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)]"
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="rounded-[3px] border border-[var(--score-high)]/30 bg-[var(--score-high)]/5 px-2.5 py-0.5 font-mono text-[10px] font-medium text-[var(--score-high)]">
                  WEEKLY
                </span>
                <span className="font-mono text-[10px] text-[var(--foreground-subtle)]">
                  Week of {weekLabel}
                </span>
              </div>

              <h2 className="mt-4 font-mono text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                RISING THIS WEEK
              </h2>
              <div className="term-label mt-1">{'// WEEKLY_RANKING'}</div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--foreground-muted)]">
                The 10 fastest-accelerating repos on GitHub right now, ranked by 7-day star velocity with week-over-week momentum.
              </p>

              {/* Preview of top 3 */}
              {rising.length > 0 && (
                <div className="mt-6 space-y-3">
                  {rising.map((repo, i) => (
                    <div
                      key={repo.id}
                      className="flex items-center gap-4 bg-[rgba(255,255,255,0.03)] px-4 py-3"
                    >
                      <span className="font-mono text-lg font-bold text-[var(--foreground-subtle)] w-6 text-right">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-sm font-medium text-[var(--foreground)]">
                          <span className="text-[var(--foreground-muted)]">{repo.owner}/</span>
                          {repo.name}
                        </span>
                        {repo.enrichment?.summary && (
                          <p className="mt-0.5 text-xs text-[var(--foreground-muted)] truncate">
                            {repo.enrichment.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-3 shrink-0">
                        <span className="font-mono text-xs text-[var(--score-high)]">
                          +{formatStars(repo.stars_7d)} stars
                        </span>
                        <span className="font-mono text-xs text-[var(--foreground-subtle)]">
                          {formatStars(repo.stars)} total
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="font-mono text-xs text-[var(--accent)] group-hover:underline">
                    View full ranking →
                  </p>
                </div>
              )}
            </div>
          </Link>
        </div>
      </section>

      {/* Coming soon */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="term-label mb-4">
            {'// COMING_SOON'}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Breakout Repos',
                description: 'Projects that crossed critical thresholds this month — from unknown to 1k stars, from 1k to 10k.',
              },
              {
                title: 'Monthly AI Code Report',
                description: 'Deep-dive into AI coding tool adoption, market share shifts, and what the commit data reveals.',
              },
              {
                title: 'Category Movers',
                description: 'Which categories are heating up and which are cooling down, backed by aggregate signal data.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border border-dashed border-[var(--border)] p-5"
              >
                <h3 className="font-mono text-sm font-medium text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
