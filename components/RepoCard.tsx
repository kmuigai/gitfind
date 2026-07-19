// Catalog-entry repo card — the production RepoCard (1-bit design system).
// Repo name and summary are the stars; metadata is secondary; every score
// shows /100 + tier + methodology tooltip; deltas always carry a timeframe.

import Link from 'next/link'
import type { RepoWithEnrichment } from '@/lib/database.types'
import {
  contributorsLabel,
  formatCount,
  pctLabel,
  tierFor,
  tierExplainer,
  SCORE_EXPLAINER,
  categorySlug,
} from '@/lib/design'

interface RepoCardProps {
  project: RepoWithEnrichment
  index?: number
  stars7d?: number | null
  pct7d?: number | null
}

function tierChipClass(tier: string): string {
  if (tier === 'Breakout') return 'bg-[var(--tier-breakout)]'
  if (tier === 'Hot') return 'bg-[var(--tier-hot)]'
  return 'bg-[var(--tier-active)]'
}

export default function RepoCard({ project, index, stars7d, pct7d }: RepoCardProps) {
  const { owner, name } = project
  const enrichment = project.enrichment
  const score = enrichment?.early_signal_score ?? 0
  const tier = tierFor(score)
  const hasDelta = typeof stars7d === 'number' && stars7d > 0
  const positive = pct7d == null || pct7d >= 0

  return (
    <article className="press flex h-full flex-col border-2 border-[var(--line)] bg-[var(--paper)]">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-[var(--line)] px-4 py-2">
        <p className="font-mono text-[11px] tracking-wider text-[var(--muted)]">
          {typeof index === 'number' ? `no. ${String(index + 1).padStart(3, '0')}` : 'entry'}
        </p>
        {enrichment?.category ? (
          <Link
            href={`/category/${categorySlug(enrichment.category)}`}
            className="font-mono text-[11px] text-[var(--muted)] invert-hover px-1"
          >
            {enrichment.category.toLowerCase()}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <Link href={`/project/${owner}/${name}`} className="min-w-0">
            <h3 className="break-words font-mono text-lg font-bold leading-snug tracking-tight text-[var(--ink)] line-clamp-2">
              <span className="font-normal text-[var(--muted)]">{owner}/</span>
              {name}
            </h3>
          </Link>
          <div
            className="shrink-0 text-right font-mono"
            title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
          >
            <p className="text-[15px] font-bold text-[var(--ink)]">
              {score}
              <span className="font-normal text-[var(--muted)]">/100</span>
            </p>
            <p className={`mt-1 inline-block px-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--paper)] ${tierChipClass(tier)}`}>
              {tier}
            </p>
          </div>
        </div>

        {enrichment?.summary ? (
          <p className="mt-2.5 font-mono text-[13px] leading-[1.8] text-[var(--body)]">
            {enrichment.summary}
          </p>
        ) : null}

        {enrichment?.why_it_matters ? (
          <p className="mt-3 border-l-2 border-[var(--line)] pl-3 font-mono text-[12.5px] leading-[1.75] text-[var(--muted)]">
            <span className="font-bold text-[var(--ink)]">why it matters: </span>
            {enrichment.why_it_matters}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 font-mono text-[11.5px] text-[var(--body)]">
          {hasDelta ? (
            <span
              className={`border-2 px-1.5 py-0.5 font-bold ${
                positive
                  ? 'border-[var(--line)] bg-[var(--accent)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-transparent text-[var(--ink)]'
              }`}
              title={`+${formatCount(stars7d)} stars this week${pct7d != null ? `, ${pctLabel(pct7d)} versus last week` : ''}`}
            >
              {positive ? '▲' : '▼'} {pct7d != null ? pctLabel(pct7d) : `+${formatCount(stars7d)}★`} this week
            </span>
          ) : null}
          <span>{formatCount(project.stars)}★</span>
          <span>{formatCount(project.forks)}⑂</span>
          <span>
            {project.contributors === 0 ? 'Solo' : `${contributorsLabel(project.contributors)} contributors`}
          </span>
          {project.language ? <span>{project.language}</span> : null}
        </div>
      </div>
    </article>
  )
}
