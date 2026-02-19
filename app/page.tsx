import type { Metadata } from 'next'
import Link from 'next/link'
import { getTopRepos, getToolContributionsByMonth } from '@/lib/queries'
import HeroAnimation from '@/components/HeroAnimation'
import ProjectCard from '@/components/ProjectCard'
import SearchBar from '@/components/SearchBar'
import NewsletterSignup from '@/components/NewsletterSignup'
import ClaudeCodeChart from '@/components/ClaudeCodeChart'
export const metadata: Metadata = {
  title: 'GitFind — Rising GitHub Projects for Product People',
  description:
    'Find the next OpenClaw before it hits 150K stars. GitFind surfaces rising GitHub projects with plain-English context for PMs, founders, and investors.',
}

// Revalidate every hour — pipeline runs nightly but this keeps data fresh during the day
export const revalidate = 3600

const CATEGORIES = [
  { name: 'AI / Machine Learning', slug: 'ai-ml', emoji: '🤖' },
  { name: 'Developer Tools', slug: 'developer-tools', emoji: '🛠️' },
  { name: 'Security', slug: 'security', emoji: '🔐' },
  { name: 'Data & Analytics', slug: 'data-analytics', emoji: '📊' },
  { name: 'Web Frameworks', slug: 'web-frameworks', emoji: '🌐' },
  { name: 'Infrastructure & DevOps', slug: 'infrastructure-devops', emoji: '⚙️' },
  { name: 'Mobile', slug: 'mobile', emoji: '📱' },
  { name: 'Open Source Utilities', slug: 'open-source-utilities', emoji: '🔧' },
]

export default async function HomePage() {
  const [topProjects, toolData] = await Promise.all([
    getTopRepos(6),
    getToolContributionsByMonth(),
  ])

  return (
    <div>
      {/* Hero */}
      <section className="relative border-b border-[var(--border)] px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-7xl">
          {/* Animated headline */}
          <HeroAnimation />

          {/* Subheadline */}
          <p className="mt-6 max-w-2xl text-lg text-[var(--foreground-muted)] leading-relaxed">
            Open source intelligence for product people.{' '}
            <span className="text-[var(--foreground)]">GitHub, translated.</span> Rising projects
            ranked by Early Signal Score — before they go mainstream.
          </p>

          {/* Search */}
          <div className="mt-8">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Top Projects */}
      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Highest Early Signal Score
              </h2>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                Projects most likely to blow up — ranked by GitFind&apos;s algorithm
              </p>
            </div>
          </div>

          {topProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <section className="border-t border-[var(--border)] px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              AI is writing more code every month
            </h2>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Claude Code contributions across tracked repositories
            </p>
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
    <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
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
