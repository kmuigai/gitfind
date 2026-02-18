import type { Metadata } from 'next'
import Link from 'next/link'
import { getTopRepos } from '@/lib/queries'
import HeroAnimation from '@/components/HeroAnimation'
import ProjectCard from '@/components/ProjectCard'
import SearchBar from '@/components/SearchBar'
import NewsletterSignup from '@/components/NewsletterSignup'
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
  const topProjects = await getTopRepos(6)

  return (
    <div>
      {/* Hero */}
      <section className="relative border-b border-[var(--border)] px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-4xl">
          {/* OpenClaw proof point — small callout */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[var(--accent-subtle)] px-3 py-1.5 text-xs text-[var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            OpenClaw hit 200K stars. GitFind subscribers knew at 9K.
          </div>

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

          {/* Category links */}
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
              >
                {cat.emoji} {cat.name}
              </Link>
            ))}
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

      {/* Categories overview */}
      <section className="border-t border-[var(--border)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 text-lg font-semibold text-[var(--foreground)]">
            Browse by category
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-card)] px-4 py-4 transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)]"
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-sm font-medium text-[var(--foreground)]">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
