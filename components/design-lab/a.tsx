// Direction A — "Refined terminal"
// Dark developer aesthetic, disciplined: sans for prose, mono only for labels
// and data, generous whitespace, scores shown with context.

import Link from 'next/link'
import {
  SampleRepo,
  commitSeries,
  chartStats,
  contributorsLabel,
  formatCount,
  languageColors,
  pctLabel,
  tierFor,
  tierExplainer,
  SCORE_EXPLAINER,
  toPoints,
  linePath,
  areaPath,
  featured,
} from './sample-data'

const DL = '/design-lab/a'

function tierTextClass(tier: string): string {
  if (tier === 'Breakout') return 'text-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'text-[var(--dl-tier-hot)]'
  return 'text-[var(--dl-tier-active)]'
}

export function ANav() {
  return (
    <header className="border-b border-[var(--dl-border)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href={DL} className="font-mono text-sm font-bold tracking-tight text-[var(--dl-text)]">
          <span className="mr-1.5 text-[var(--dl-accent)]">❯</span>gitfind.ai
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--dl-muted)] sm:flex">
          <span className="text-[var(--dl-text)]">Trending</span>
          <span className="cursor-pointer transition-colors hover:text-[var(--dl-text)]">Categories</span>
          <span className="cursor-pointer transition-colors hover:text-[var(--dl-text)]">AI Code Index</span>
          <span className="cursor-pointer transition-colors hover:text-[var(--dl-text)]">Insights</span>
        </nav>
        <Link
          href="/design-lab"
          className="rounded-md border border-[var(--dl-border)] px-3 py-1.5 font-mono text-xs text-[var(--dl-muted)] transition-colors hover:border-[var(--dl-accent)] hover:text-[var(--dl-text)]"
        >
          ← All directions
        </Link>
      </div>
    </header>
  )
}

export function AFooter() {
  return (
    <footer className="border-t border-[var(--dl-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-mono text-xs text-[var(--dl-muted)]">
          <span className="mr-1.5 text-[var(--dl-accent)]">❯</span>gitfind.ai
          <span className="mx-2 text-[var(--dl-border)]">·</span>GitHub, translated
        </p>
        <p className="font-mono text-xs text-[var(--dl-muted)]">
          Design mock A — sample data, no live feeds
        </p>
      </div>
    </footer>
  )
}

export function ALabel({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div className="mb-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
        {index} <span className="mx-1 text-[var(--dl-border)]">/</span> {title}
      </p>
      {note ? <p className="mt-2 max-w-2xl text-sm text-[var(--dl-muted)]">{note}</p> : null}
    </div>
  )
}

export function AScoreBlock({ score }: { score: number }) {
  const tier = tierFor(score)
  return (
    <div
      className="shrink-0 text-right"
      title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
    >
      <p className="font-mono text-xl font-bold leading-none text-[var(--dl-text)]">
        {score}
        <span className="text-sm font-medium text-[var(--dl-muted)]">/100</span>
      </p>
      <div className="ml-auto mt-2 h-0.5 w-14 rounded-full bg-[var(--dl-border)]">
        <div className="h-full rounded-full bg-[var(--dl-accent)]" style={{ width: `${score}%` }} />
      </div>
      <p className={`mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${tierTextClass(tier)}`}>
        {tier}
      </p>
    </div>
  )
}

function AGain({ repo }: { repo: SampleRepo }) {
  const positive = repo.pct7d > 0
  return (
    <p
      className={`font-mono text-xs font-medium ${positive ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}
      title={`${formatCount(repo.stars7d)} new stars this week, ${pctLabel(repo.pct7d)} versus last week`}
    >
      {positive ? '▲' : '▼'} +{formatCount(repo.stars7d)} stars this week ({pctLabel(repo.pct7d)})
    </p>
  )
}

export function ARepoCard({ repo }: { repo: SampleRepo }) {
  return (
    <article className="group flex h-full flex-col rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6 transition-colors hover:border-[var(--dl-accent)]/60 hover:bg-[var(--dl-surface-2)]">
      <div className="flex items-start justify-between gap-4">
        <Link href={`${DL}/project`} className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--dl-text)] group-hover:text-[var(--dl-accent-strong)]">
            <span className="font-normal text-[var(--dl-muted)]">{repo.owner}/</span>
            {repo.name}
          </h3>
        </Link>
        <AScoreBlock score={repo.score} />
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-[var(--dl-body)] line-clamp-3">
        {repo.summary}
      </p>

      <div className="mt-4 border-l-2 border-[var(--dl-accent)]/50 py-0.5 pl-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dl-accent)]">
          Why it matters
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dl-muted)] line-clamp-2">
          {repo.whyItMatters}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <AGain repo={repo} />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-[var(--dl-muted)]">
          {repo.language ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: languageColors[repo.language] ?? '#8b949e' }}
              />
              {repo.language}
            </span>
          ) : null}
          <span>{formatCount(repo.stars)} stars</span>
          <span>{formatCount(repo.forks)} forks</span>
          <span>{contributorsLabel(repo.contributors)} {repo.contributors === 0 ? 'developer' : 'contributors'}</span>
        </div>
      </div>
    </article>
  )
}

export function AChart() {
  const values = commitSeries.map((d) => d.commits)
  const W = 720
  const H = 240
  const pts = toPoints(values, W, H, 4, 12, 24)
  const gridYs = [0.25, 0.5, 0.75].map((f) => f * H)
  return (
    <div className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-bold text-[var(--dl-text)]">
            {formatCount(chartStats.latest)}
          </p>
          <p className="mt-1 text-sm text-[var(--dl-muted)]">
            Claude Code commits on Jul 18 ·{' '}
            <span className="text-[var(--dl-positive)]">{chartStats.deltaLabel}</span>
          </p>
        </div>
        <div className="flex gap-1 font-mono text-xs">
          {['1W', '1M', '3M', '1Y', 'ALL'].map((r) => (
            <span
              key={r}
              className={`cursor-pointer rounded px-2.5 py-1 ${
                r === '1M'
                  ? 'bg-[var(--dl-accent)]/15 text-[var(--dl-accent-strong)]'
                  : 'text-[var(--dl-muted)] hover:text-[var(--dl-text)]'
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 h-auto w-full" role="img" aria-label="Line chart of daily Claude Code commits over the last 30 days, trending upward">
        {gridYs.map((y) => (
          <line key={y} x1={0} x2={W} y1={y} y2={y} stroke="var(--dl-border)" strokeDasharray="3 5" strokeWidth={1} />
        ))}
        <path d={areaPath(pts, H)} fill="var(--dl-accent)" fillOpacity={0.1} />
        <path d={linePath(pts)} fill="none" stroke="var(--dl-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4} fill="var(--dl-accent)" />
        {commitSeries.map((d, i) =>
          i % 6 === 0 ? (
            <text key={d.day} x={pts[i].x} y={H - 6} fontSize={11} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
              {d.day}
            </text>
          ) : null
        )}
      </svg>

      <p className="mt-4 border-t border-[var(--dl-border)] pt-4 text-sm text-[var(--dl-muted)]">
        {chartStats.totalLabel}. Claude Code commits across public GitHub repositories, tracked daily.
      </p>
    </div>
  )
}

export function ANewsletter() {
  return (
    <div className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6 sm:p-10">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
        03 <span className="mx-1 text-[var(--dl-border)]">/</span> The Tuesday Briefing
      </p>
      <h3 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight text-[var(--dl-text)] sm:text-3xl">
        The repos that moved this week, why they matter, and what to watch next.
      </h3>
      <p className="mt-2 text-sm text-[var(--dl-muted)]">One email every Tuesday. No noise.</p>
      <div className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
        <input
          type="email"
          aria-label="Email address"
          placeholder="you@company.com"
          className="h-11 flex-1 rounded-md border border-[var(--dl-border)] bg-[var(--dl-bg)] px-4 text-sm text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:border-[var(--dl-accent)] focus:outline-none"
        />
        <button
          type="button"
          className="h-11 rounded-md bg-[var(--dl-accent)] px-5 text-sm font-semibold text-[var(--dl-on-accent)] transition-colors hover:bg-[var(--dl-accent-strong)]"
        >
          Subscribe
        </button>
      </div>
    </div>
  )
}

// --- Project detail pieces ---

export function AScoreCard() {
  const tier = tierFor(featured.score)
  return (
    <div className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dl-muted)]">
            Early Signal Score
          </p>
          <p className="mt-2 font-mono text-5xl font-bold leading-none text-[var(--dl-text)]">
            {featured.score}
            <span className="text-xl font-medium text-[var(--dl-muted)]">/100</span>
          </p>
        </div>
        <span
          className={`rounded border border-current px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] ${tierTextClass(tier)}`}
          title={tierExplainer(tier)}
        >
          {tier}
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--dl-border)]">
        <div className="h-full rounded-full bg-[var(--dl-accent)]" style={{ width: `${featured.score}%` }} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--dl-muted)]">
        {tierExplainer(tier)}. {SCORE_EXPLAINER}
      </p>

      <div className="mt-5 space-y-2.5 border-t border-[var(--dl-border)] pt-5">
        {featured.breakdown.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-[var(--dl-muted)]">
              {s.label} <span className="text-[var(--dl-border)]">· {s.weight}%</span>
            </span>
            <div className="h-1 flex-1 rounded-full bg-[var(--dl-border)]">
              <div className="h-full rounded-full bg-[var(--dl-accent)]/70" style={{ width: `${s.value}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-xs text-[var(--dl-text)]">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-5 font-mono text-[11px] text-[var(--dl-muted)]">Score updated {featured.scoredAt}</p>
    </div>
  )
}

export function AStatGrid() {
  const stats: { label: string; value: string }[] = [
    { label: 'Stars', value: formatCount(featured.stars) },
    { label: 'Forks', value: formatCount(featured.forks) },
    { label: 'Contributors', value: contributorsLabel(featured.contributors) },
    { label: 'Language', value: featured.language ?? '—' },
    { label: 'Downloads (7d)', value: featured.downloads7d == null ? '—' : formatCount(featured.downloads7d) },
    { label: 'Category', value: featured.category },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] px-4 py-3.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dl-muted)]">
            {s.label}
          </p>
          <p className="mt-1.5 truncate font-mono text-lg font-semibold text-[var(--dl-text)]" title={s.value}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  )
}
