import type { Metadata } from 'next'
import Link from 'next/link'
import { getRisingRepos } from '@/lib/queries'
import Reveal from '@/components/Reveal'
import { formatCount } from '@/lib/design'

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

      {/* Spec header */}
      <section className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-12">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">insights</span>
          </nav>

          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            INSIGHTS
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Data-driven intelligence from every public GitHub repo. Weekly rankings,
            breakout signals, and trend analysis — so you see what’s moving before
            everyone else.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              week of {weekLabel}
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              updated daily
            </span>
          </div>
        </div>
      </section>

      {/* Featured report */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
          § 1 — featured report
        </p>
        <Reveal className="mt-5">
          <Link
            href={`/insights/rising-this-week/${weekDate}`}
            className="press block border-2 border-[var(--line)] bg-[var(--paper)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
              <p>fig. 01 — weekly ranking</p>
              <p>week of {weekLabel}</p>
            </div>

            <div className="p-4 sm:p-6">
              <h2 className="font-display text-lg font-bold text-[var(--ink)] sm:text-2xl">
                RISING THIS WEEK
              </h2>
              <p className="mt-2 max-w-xl font-mono text-[13px] leading-[1.8] text-[var(--body)]">
                The 10 fastest-accelerating repos on GitHub right now, ranked by
                7-day star velocity with week-over-week momentum.
              </p>

              {/* Preview of top 3 */}
              {rising.length > 0 && (
                <div className="mt-5 border-2 border-[var(--line)]">
                  {rising.map((repo, i) => (
                    <div
                      key={repo.id}
                      className="flex items-center gap-3 border-b-2 border-[var(--line)] px-3 py-2.5 last:border-0"
                    >
                      <span className="w-7 shrink-0 text-right font-mono text-[12px] font-bold text-[var(--muted)]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] font-bold text-[var(--ink)]">
                          <span className="font-normal text-[var(--muted)]">{repo.owner}/</span>
                          {repo.name}
                        </p>
                        {repo.enrichment?.summary && (
                          <p className="truncate font-mono text-[11.5px] text-[var(--muted)]">
                            {repo.enrichment.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]">
                        <span className="hidden text-[var(--muted)] sm:inline">
                          {formatCount(repo.stars)}★ total
                        </span>
                        <span className="border-2 border-[var(--line)] bg-[var(--accent)] px-1.5 py-0.5 font-bold text-[var(--ink)]">
                          +{formatCount(repo.stars_7d)}★ this week
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 font-mono text-[12px] font-bold text-[var(--ink)]">
                open the full ranking →
              </p>
            </div>
          </Link>
        </Reveal>
      </section>

      {/* Forthcoming */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <p className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
          § 2 — forthcoming
        </p>
        <Reveal className="mt-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'breakout repos',
                description: 'Projects that crossed critical thresholds this month — from unknown to 1k stars, from 1k to 10k.',
              },
              {
                title: 'monthly ai code report',
                description: 'Deep-dive into AI coding tool adoption, market share shifts, and what the commit data reveals.',
              },
              {
                title: 'category movers',
                description: 'Which categories are heating up and which are cooling down, backed by aggregate signal data.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border-2 border-dashed border-[var(--line-soft)] p-4"
              >
                <h3 className="font-mono text-[13px] font-bold text-[var(--ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 font-mono text-[12px] leading-[1.75] text-[var(--muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </div>
  )
}
