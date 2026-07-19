import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRepo, getPackageDownloads, getReposByCategory } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import RepoCard from '@/components/RepoCard'
import SpecScore, { type SpecScoreBreakdown } from '@/components/SpecScore'
import Reveal from '@/components/Reveal'
import { categorySlug, contributorsLabel, formatCount } from '@/lib/design'

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

  const repoName = `${owner}/${repo}`
  const score = project.enrichment?.early_signal_score ?? 0
  const category = project.enrichment?.category
  const description =
    project.enrichment?.summary ??
    project.description ??
    `${repoName} — Early Signal Score, stats, and plain-English analysis on GitFind.`

  const scorePart = score > 0 ? ` | Score ${score}` : ''
  const categoryPart = category ? ` | ${category}` : ''
  const pageTitle = `${repoName}${scorePart}${categoryPart}`
  const fullTitle = `${pageTitle} — GitFind`

  const url = `https://gitfind.ai/project/${owner}/${repo}`

  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  }
}

function parseBreakdown(raw: unknown): SpecScoreBreakdown | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.star_velocity_score !== 'number') return null
  return obj as unknown as SpecScoreBreakdown
}

export default async function ProjectPage({ params }: Props) {
  const { owner, repo: repoName } = await params
  const project = await getRepo(owner, repoName)

  if (!project) {
    notFound()
  }

  const enrichment = project.enrichment
  const score = enrichment?.early_signal_score ?? 0
  const [downloads, relatedRaw] = await Promise.all([
    getPackageDownloads(project.id),
    enrichment?.category ? getReposByCategory(enrichment.category, 5) : Promise.resolve([]),
  ])
  const relatedProjects = relatedRaw.filter((r) => r.id !== project.id).slice(0, 4)

  const scoredAt = new Date(enrichment?.scored_at ?? project.updated_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const stats: { label: string; value: string }[] = [
    { label: 'stars', value: formatCount(project.stars) },
    { label: 'forks', value: formatCount(project.forks) },
    { label: 'contributors', value: contributorsLabel(project.contributors) },
    { label: 'language', value: project.language ?? '—' },
    {
      label: 'downloads (7d)',
      value: downloads && downloads.downloads_7d > 0 ? formatCount(downloads.downloads_7d) : '—',
    },
    { label: 'category', value: enrichment?.category ?? '—' },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${owner}/${repoName}`,
    description: enrichment?.summary ?? project.description ?? '',
    url: project.url,
    applicationCategory: enrichment?.category ?? 'DeveloperApplication',
    operatingSystem: 'Cross-platform',
    ...(project.language ? { programmingLanguage: project.language } : {}),
    aggregateRating: score > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: score,
          bestRating: 100,
          worstRating: 0,
          ratingCount: project.stars,
        }
      : undefined,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Spec header */}
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            {enrichment?.category ? (
              <>
                <Link href={`/category/${categorySlug(enrichment.category)}`} className="invert-hover px-1">
                  {enrichment.category.toLowerCase()}
                </Link>
                <span className="mx-1">/</span>
              </>
            ) : null}
            <span className="text-[var(--ink)]">{owner}/{repoName}</span>
          </nav>

          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            <span className="text-[var(--muted)]">{owner}/</span>
            {repoName}
          </h1>

          {enrichment?.summary ? (
            <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
              {enrichment.summary}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              {formatCount(project.stars)}★
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              {formatCount(project.forks)}⑂
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              {project.contributors === 0 ? 'Solo' : `${contributorsLabel(project.contributors)} contributors`}
            </span>
            {project.language ? (
              <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
                {project.language}
              </span>
            ) : null}
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="invert-hover border-2 border-[var(--line)] px-2 py-0.5 font-bold text-[var(--ink)]"
            >
              source ↗
            </a>
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            {enrichment?.summary ? (
              <Reveal>
                <section>
                  <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
                    § 1 — what it does
                  </h2>
                  <p className="mt-3 border-l-2 border-[var(--line)] pl-4 font-mono text-[14px] leading-[1.85] text-[var(--body)]">
                    {enrichment.summary}
                  </p>
                </section>
              </Reveal>
            ) : null}

            {enrichment?.why_it_matters ? (
              <Reveal>
                <section>
                  <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
                    § 2 — why it matters
                  </h2>
                  <p className="mt-3 border-l-2 border-[var(--line)] pl-4 font-mono text-[14px] leading-[1.85] text-[var(--body)]">
                    {enrichment.why_it_matters}
                  </p>
                </section>
              </Reveal>
            ) : null}

            {enrichment?.trend_narrative ? (
              <Reveal>
                <section>
                  <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
                    § 3 — why it’s trending
                  </h2>
                  <p className="mt-3 border-l-2 border-[var(--line)] pl-4 font-mono text-[14px] leading-[1.85] text-[var(--body)]">
                    {enrichment.trend_narrative}
                  </p>
                </section>
              </Reveal>
            ) : null}
          </div>

          <aside className="space-y-5">
            <SpecScore
              score={score}
              breakdown={parseBreakdown(enrichment?.score_breakdown)}
              scoredAt={scoredAt}
            />

            <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
              <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
                fig. 03 — specifications
              </p>
              <dl className="p-4 font-mono">
                {stats.map((s) => (
                  <div key={s.label} className="flex justify-between gap-3 border-b border-dashed border-[var(--line-soft)] py-1.5 text-[12px] last:border-0">
                    <dt className="text-[var(--muted)]">{s.label}</dt>
                    <dd className="font-bold text-[var(--ink)]">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {downloads && downloads.downloads_7d > 0 ? (
              <p className="font-mono text-[11px] text-[var(--muted)]">
                {downloads.registry}/{downloads.package_name}
              </p>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Related */}
      {relatedProjects.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
            <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 4 — related entries</p>
            <p>{relatedProjects.length} entries</p>
          </div>
          <Reveal className="mt-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {relatedProjects.map((rp, i) => (
                <RepoCard key={rp.id} project={rp} index={i} />
              ))}
            </div>
          </Reveal>
        </section>
      )}

      <NewsletterSignup />
    </div>
  )
}
