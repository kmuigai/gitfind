import Link from 'next/link'
import type { RepoWithEnrichment } from '@/lib/database.types'

interface ProjectCardProps {
  project: RepoWithEnrichment
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
    <span
      className={`inline-flex flex-col items-center rounded-full border px-2.5 py-1 ${color}`}
      title="Ranked by star growth, contributor activity, and community buzz"
    >
      <span className="font-mono text-sm font-bold leading-tight">{score}</span>
      <span className="text-[10px] font-medium leading-tight opacity-80">{tier}</span>
    </span>
  )
}

function LanguageDot({ language }: { language: string | null }) {
  const LANG_COLORS: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Rust: '#dea584',
    Go: '#00ADD8',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    Ruby: '#701516',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
  }

  if (!language) return null
  const color = LANG_COLORS[language] ?? '#6b7280'

  return (
    <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {language}
    </span>
  )
}

function formatStars(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count.toString()
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const enrichment = project.enrichment
  const score = enrichment?.early_signal_score ?? 0

  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-card)] p-5 transition-all duration-200 hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/project/${project.owner}/${project.name}`}
            className="block text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
          >
            <span className="text-[var(--foreground-muted)]">{project.owner}/</span>
            <span>{project.name}</span>
          </Link>
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* Summary */}
      {enrichment?.summary && (
        <p className="text-sm leading-relaxed text-[var(--foreground-muted)] line-clamp-2">
          {enrichment.summary}
        </p>
      )}

      {/* Why it matters */}
      {enrichment?.why_it_matters && (
        <div className="rounded-lg bg-[var(--accent-subtle)] px-3 py-2">
          <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
            <span className="font-medium text-[var(--accent)]">Why it matters: </span>
            {enrichment.why_it_matters}
          </p>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <LanguageDot language={project.language} />
        <span className="text-xs text-[var(--foreground-muted)]">
          ★ {formatStars(project.stars)}
        </span>
        <span className="text-xs text-[var(--foreground-muted)]">
          ⑂ {formatStars(project.forks)}
        </span>
        {project.contributors > 0 && (
          <span className="text-xs text-[var(--foreground-muted)]">
            👥 {project.contributors}
          </span>
        )}
        {enrichment?.category && (
          <Link
            href={`/category/${enrichment.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
            className="ml-auto text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--accent)]"
          >
            {enrichment.category}
          </Link>
        )}
      </div>

      {/* Full-card click → detail page */}
      <Link
        href={`/project/${project.owner}/${project.name}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`View ${project.owner}/${project.name} details`}
        tabIndex={-1}
      />
      {/* Footer links */}
      <div className="relative z-10 flex items-center justify-end">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground)]"
        >
          GitHub ↗
        </a>
      </div>
    </article>
  )
}
