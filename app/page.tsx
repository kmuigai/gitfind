import type { Metadata } from 'next'
import Link from 'next/link'
import { getTopRepos, getTrendingRepos, getToolContributionsByDay } from '@/lib/queries'
import RepoCard from '@/components/RepoCard'
import SearchBar from '@/components/SearchBar'
import NewsletterSignup from '@/components/NewsletterSignup'
import ViewToggle from '@/components/ViewToggle'
import BarChart from '@/components/charts/BarChart'
import Reveal from '@/components/Reveal'
import CountUp from '@/components/CountUp'
import type { RepoWithEnrichment } from '@/lib/database.types'
import type { TrendingRepo } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'GitFind — GitHub, translated.',
  description:
    'The rising projects that matter — before everyone else sees them. Trending repos ranked, scored, and explained in plain English.',
}

// Revalidate every hour — pipeline runs nightly but this keeps data fresh during the day
export const revalidate = 3600

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

export default async function HomePage() {
  const [trendingProjects, topProjects, toolData] = await Promise.all([
    getTrendingRepos(12),
    getTopRepos(12),
    getToolContributionsByDay(),
  ])

  const chartData = toolData.slice(-30).map((d) => ({ label: shortDate(d.date), value: d.claude_code }))
  const latestCommits = chartData.length > 0 ? chartData[chartData.length - 1].value : 0

  return (
    <div>
      {/* Hero */}
      <section className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">
            open source intelligence — updated daily
          </p>
          <h1 className="font-display mt-5 text-[26px] font-bold leading-[1.15] text-[var(--ink)] sm:text-5xl">
            GITHUB,<br />TRANSLATED<span className="blink">_</span>
          </h1>
          <p className="mt-5 max-w-xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            The rising open-source projects that matter, explained in plain
            English. Before everyone else sees them.
          </p>
          <div className="mt-8">
            <SearchBar />
          </div>
          <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
              this week: <b className="text-[var(--ink)]">{trendingProjects.length} movers</b>
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
              ai commits yesterday: <b className="text-[var(--ink)]"><CountUp value={latestCommits} /></b>
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
              scores: <b className="text-[var(--ink)]">out of 100, explained</b>
            </span>
          </div>
        </div>
      </section>

      {/* Movers grid */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Reveal>
          <ViewToggle
            trendingPanel={<ProjectGrid projects={trendingProjects} withDelta />}
            topPanel={<ProjectGrid projects={topProjects} />}
          />
        </Reveal>
      </section>

      {/* AI commit chart */}
      {chartData.length >= 2 && (
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
            <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 2 — machine output</p>
            <Link href="/ai-code-index" className="invert-hover px-1 text-[var(--ink)]">
              see the full ai code index →
            </Link>
          </div>
          <Reveal chart className="mt-5">
            <figure className="border-2 border-[var(--line)] bg-[var(--paper)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
                <p>fig. 01 — claude code commits, daily</p>
                <p>public github, last 30 days</p>
              </div>
              <div className="p-4">
                <BarChart
                  data={chartData}
                  ariaLabel="Bar chart of daily Claude Code commits across public GitHub over the last 30 days"
                  gridValues={[100000, 200000]}
                  labelEvery={10}
                />
              </div>
            </figure>
          </Reveal>
        </section>
      )}

      {/* Newsletter */}
      <Reveal>
        <NewsletterSignup />
      </Reveal>
    </div>
  )
}

function ProjectGrid({
  projects,
  withDelta = false,
}: {
  projects: (RepoWithEnrichment | TrendingRepo)[]
  withDelta?: boolean
}) {
  if (projects.length === 0) return <EmptyState />
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {projects.map((project, i) => {
        const t = project as TrendingRepo
        const pct =
          withDelta && t.stars_7d_prev > 0
            ? Math.round(((t.stars_7d - t.stars_7d_prev) / t.stars_7d_prev) * 100)
            : null
        return (
          <RepoCard
            key={project.id}
            project={project}
            index={i}
            stars7d={withDelta ? t.stars_7d ?? null : null}
            pct7d={pct}
          />
        )
      })}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-[var(--line-soft)] py-16 text-center">
      <p className="font-mono text-sm text-[var(--muted)]">
        no projects yet — the pipeline runs nightly.
      </p>
      <p className="mt-2 font-mono text-xs text-[var(--muted)]">
        run <code className="font-bold text-[var(--ink)]">npx tsx scripts/pipeline.ts</code> locally to seed data.
      </p>
    </div>
  )
}
