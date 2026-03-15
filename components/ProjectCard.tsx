import Link from 'next/link'
import type { RepoWithEnrichment } from '@/lib/database.types'
import StatsRow from './StatsRow'

interface ProjectCardProps {
  project: RepoWithEnrichment
}

function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 70 ? 'Breakout' : score >= 40 ? 'Hot' : 'Active'
  const color =
    score >= 70
      ? 'text-[var(--badge-breakout)] border-[var(--badge-breakout)]/30 bg-[var(--badge-breakout)]/10'
      : score >= 40
        ? 'text-[var(--badge-hot)] border-[var(--badge-hot)]/30 bg-[var(--badge-hot)]/10'
        : 'text-[var(--badge-active)] border-[var(--badge-active)]/30 bg-[var(--badge-active)]/10'

  return (
    <span
      className={`inline-flex flex-col items-center rounded-[3px] border px-2.5 py-1 ${color}`}
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
    <article className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-sm border border-[var(--border)] border-l-2 border-l-transparent bg-[var(--background-card)] p-5 transition-colors hover:border-[var(--border)] hover:border-l-[var(--accent)] hover:bg-[var(--background-elevated)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/project/${project.owner}/${project.name}`}
            className="block font-mono text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
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
        <div className="border-l-2 border-l-[var(--accent)] pl-3 py-1">
          <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
            <span className="font-mono font-medium text-[var(--accent)]">{'// why it matters '}</span>
            {enrichment.why_it_matters}
          </p>
        </div>
      )}

      {/* Stats footer */}
      <StatsRow
        tooltipText={[
          project.language,
          `${formatStars(project.stars)} stars`,
          `${formatStars(project.forks)} forks`,
          project.contributors > 0 ? `${project.contributors} contributors` : '',
          project.downloads_7d != null && project.downloads_7d > 0 ? `${formatStars(project.downloads_7d)} dl/wk` : '',
        ].filter(Boolean).join(' · ')}
      >
        <LanguageDot language={project.language} />
        <span className="shrink-0 font-mono text-xs text-[var(--foreground-muted)]">
          {formatStars(project.stars)} stars
        </span>
        <span className="shrink-0 font-mono text-xs text-[var(--foreground-muted)]">
          {formatStars(project.forks)} forks
        </span>
        {project.contributors > 0 && (
          <span className="shrink-0 font-mono text-xs text-[var(--foreground-muted)]">
            {project.contributors} contrib
          </span>
        )}
        {project.downloads_7d != null && project.downloads_7d > 0 && (
          <span className="shrink-0 font-mono text-xs text-[var(--foreground-muted)]">
            {formatStars(project.downloads_7d)} dl/wk
          </span>
        )}
      </StatsRow>

      {/* Full-card click → detail page */}
      <Link
        href={`/project/${project.owner}/${project.name}`}
        className="absolute inset-0"
        aria-label={`View ${project.owner}/${project.name} details`}
      />
      {/* Footer links */}
      <div className="relative z-10 flex items-center justify-between gap-2 min-w-0">
        {enrichment?.category ? (
          <Link
            href={`/category/${enrichment.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
            className="truncate text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--accent)]"
          >
            {enrichment.category}
          </Link>
        ) : (
          <span />
        )}
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground)]"
        >
          GitHub ↗
        </a>
      </div>
    </article>
  )
}
