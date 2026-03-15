import type { Metadata } from 'next'
import Link from 'next/link'
import { getTopRepos, getTrendingRepos, getToolContributionsByDay } from '@/lib/queries'
import HeroAnimation from '@/components/HeroAnimation'
import ProjectCard from '@/components/ProjectCard'
import SearchBar from '@/components/SearchBar'
import NewsletterSignup from '@/components/NewsletterSignup'
import ClaudeCodeChart from '@/components/ClaudeCodeChart'
import TrendingTabs from '@/components/TrendingTabs'
import { Suspense } from 'react'
export const metadata: Metadata = {
  title: 'GitFind — GitHub, translated.',
  description:
    'The rising projects that matter — before everyone else sees them. Trending repos ranked, scored, and explained in plain English.',
}

// Revalidate every hour — pipeline runs nightly but this keeps data fresh during the day
export const revalidate = 3600


interface HomePageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const view = params.view === 'top' ? 'top' : 'trending'

  const [topProjects, toolData] = await Promise.all([
    view === 'trending' ? getTrendingRepos(12) : getTopRepos(12),
    getToolContributionsByDay(),
  ])

  return (
    <div>
      {/* Hero */}
      <section
        className="relative border-b border-[var(--border)] px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-16"
      >
        <div className="mx-auto max-w-[1400px]">
          {/* Animated headline */}
          <HeroAnimation />

          {/* Subheadline */}
          <p className="mt-6 max-w-3xl text-lg text-[var(--foreground-muted)] leading-relaxed">
            <span className="text-[var(--foreground)]">GitHub, translated.</span> The rising
            projects that matter — before everyone else sees them.
          </p>

          {/* Search */}
          <div className="mt-8">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Top Projects */}
      <section className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="term-label">
                {view === 'trending'
                  ? '// THIS_WEEKS_MOVERS'
                  : '// TOP_RANKED'}
              </h2>
              <p className="mt-1 font-mono text-sm text-[var(--foreground-muted)]">
                {view === 'trending'
                  ? 'The projects gaining the most traction right now'
                  : 'Scored by velocity, community growth, and cross-platform buzz'}
              </p>
            </div>
            <Suspense>
              <TrendingTabs />
            </Suspense>
          </div>

          {topProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </section>


      {/* Claude Code Growth Chart */}
      {toolData.length >= 2 && (
        <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="term-label">
                  {'// AI_COMMIT_TRACKING'}
                </h2>
                <p className="mt-1 font-mono text-sm text-[var(--foreground-muted)]">
                  Claude Code commits across public GitHub repositories, tracked daily since 2025.
                </p>
              </div>
              <Link
                href="/ai-code-index"
                className="font-mono text-xs text-[var(--accent)] transition-opacity hover:opacity-80"
              >
                See all tools →
              </Link>
            </div>
            <div className="mt-6">
              <ClaudeCodeChart data={toolData} />
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <NewsletterSignup />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-dashed border-[var(--border)] py-16 text-center">
      <p className="text-sm text-[var(--foreground-muted)]">
        No projects yet — the pipeline runs nightly.
      </p>
      <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
        Run{' '}
        <code className="font-mono text-[var(--accent)]">npx tsx scripts/pipeline.ts</code> locally to seed data.
      </p>
    </div>
  )
}
