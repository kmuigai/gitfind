import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRepo, getPackageDownloads } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import ScoreBreakdown from '@/components/ScoreBreakdown'

export const revalidate = 3600

interface Props {
  params: Promise<{ owner: string; repo: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params
  const project = await getRepo(owner, repo)

  if (!project) {
    return { title: 'Project Not Found' }
  }

  const title = `${owner}/${repo}`
  const description =
    project.enrichment?.summary ??
    project.description ??
    `${owner}/${repo} on GitFind — Early Signal Score: ${project.enrichment?.early_signal_score ?? 0}`

  return {
    title,
    description,
    openGraph: {
      title: `${title} — GitFind`,
      description,
      url: `https://gitfind.ai/project/${owner}/${repo}`,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: `${title} — GitFind`,
      description,
    },
  }
}

interface ScoreBreakdownData {
  star_velocity_score: number
  contributor_ratio_score: number
  fork_velocity_score: number
  mention_velocity_score: number
  commit_frequency_score: number
  manipulation_penalty: number
  raw_score: number
  final_score: number
}

function parseBreakdown(raw: unknown): ScoreBreakdownData | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.star_velocity_score !== 'number') return null
  return obj as unknown as ScoreBreakdownData
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  )
}

function formatStars(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count.toLocaleString()
}

export default async function ProjectPage({ params }: Props) {
  const { owner, repo: repoName } = await params
  const project = await getRepo(owner, repoName)

  if (!project) {
    notFound()
  }

  const enrichment = project.enrichment
  const score = enrichment?.early_signal_score ?? 0
  const downloads = await getPackageDownloads(project.id)

  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            {enrichment?.category && (
              <>
                <Link
                  href={`/category/${enrichment.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                  className="transition-colors hover:text-[var(--foreground)]"
                >
                  {enrichment.category}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-[var(--foreground-muted)]">{owner}/{repoName}</span>
          </nav>

          {/* Title */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <span className="text-[var(--foreground-muted)]">{owner}/</span>
                {repoName}
              </h1>
              {project.description && (
                <p className="mt-2 max-w-2xl text-sm text-[var(--foreground-muted)]">
                  {project.description}
                </p>
              )}
            </div>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View on GitHub
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left column — summaries */}
            <div className="space-y-6 lg:col-span-2">
              {enrichment?.summary && (
                <div>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
                    What it does
                  </h2>
                  <p className="text-sm leading-relaxed text-[var(--foreground)]">
                    {enrichment.summary}
                  </p>
                </div>
              )}

              {enrichment?.why_it_matters && (
                <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-subtle)] p-5">
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
                    Why it matters for PMs
                  </h2>
                  <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                    {enrichment.why_it_matters}
                  </p>
                </div>
              )}
            </div>

            {/* Right column — score and stats */}
            <div className="space-y-4">
              {/* Score */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] p-5">
                <ScoreBreakdown score={score} breakdown={parseBreakdown(enrichment?.score_breakdown)} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Stars" value={formatStars(project.stars)} />
                <StatCard label="Forks" value={formatStars(project.forks)} />
                <StatCard label="Contributors" value={project.contributors} />
                {project.language && (
                  <StatCard label="Language" value={project.language} />
                )}
                {downloads && downloads.downloads_7d > 0 && (
                  <StatCard
                    label={`Downloads (7d)`}
                    value={formatStars(downloads.downloads_7d)}
                  />
                )}
              </div>
              {downloads && downloads.downloads_7d > 0 && (
                <p className="text-xs text-[var(--foreground-subtle)]">
                  {downloads.registry}/{downloads.package_name}
                </p>
              )}

              {/* Category */}
              {enrichment?.category && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
                  <div className="text-xs text-[var(--foreground-muted)]">Category</div>
                  <Link
                    href={`/category/${enrichment.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                    className="mt-1 block text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
                  >
                    {enrichment.category} →
                  </Link>
                </div>
              )}

              {/* Last updated */}
              <p className="text-xs text-[var(--foreground-subtle)]">
                Score updated {new Date(enrichment?.scored_at ?? project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
