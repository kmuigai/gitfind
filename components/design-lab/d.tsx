// Direction D — "Phosphor CRT"
// Full-commit terminal fantasy: green phosphor on near-black, scanlines, boot
// sequence, block gauges — but with modern type scale, spacing, and AA contrast.

import Link from 'next/link'
import {
  SampleRepo,
  commitSeries,
  chartStats,
  contributorsLabel,
  formatCount,
  gauge,
  pctLabel,
  tierFor,
  tierExplainer,
  SCORE_EXPLAINER,
  toPoints,
  linePath,
  featured,
} from './sample-data'

const DL = '/design-lab/d'

function tierTextClass(tier: string): string {
  if (tier === 'Breakout') return 'text-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'text-[var(--dl-tier-hot)]'
  return 'text-[var(--dl-tier-active)]'
}

export function DChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="dl-d min-h-screen bg-[var(--dl-bg)] pb-10 font-mono text-[var(--dl-text)]">
      <style>{'body { background: #030603; }'}</style>
      {/* CRT scanline overlay */}
      <div className="dl-scanlines pointer-events-none fixed inset-0 z-50 opacity-60" aria-hidden="true" />
      {/* Soft phosphor vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(77,255,136,0.07), transparent 55%)' }}
        aria-hidden="true"
      />
      {children}
    </div>
  )
}

export function DNav() {
  return (
    <header className="border-b border-[var(--dl-border)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href={DL} className="text-sm font-bold tracking-tight">
          <span className="text-[var(--dl-accent)]">❯</span> GITFIND.SYS{' '}
          <span className="text-[var(--dl-muted)]">v2.6</span>
        </Link>
        <nav className="hidden items-center gap-4 text-xs text-[var(--dl-muted)] md:flex">
          {['F1 TRENDING', 'F2 CATEGORIES', 'F3 INDEX', 'F4 BRIEFING'].map((k, i) => (
            <span key={k} className={`cursor-pointer ${i === 0 ? 'text-[var(--dl-accent)]' : 'hover:text-[var(--dl-text)]'}`}>
              <span className="text-[var(--dl-border)]">[</span>{k}<span className="text-[var(--dl-border)]">]</span>
            </span>
          ))}
        </nav>
        <Link href="/design-lab" className="text-xs text-[var(--dl-muted)] hover:text-[var(--dl-accent)]">
          [ESC] ALL DIRECTIONS
        </Link>
      </div>
    </header>
  )
}

export function DStatusBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="mx-auto flex h-7 max-w-5xl items-center justify-between px-4 text-[10px] tracking-wider text-[var(--dl-muted)] sm:px-6">
        <span>TTY1 · UTF-8 · <span className="text-[var(--dl-accent)]">SIGNAL OK</span></span>
        <span className="hidden sm:inline">MOCK D — SAMPLE DATA, NO LIVE FEEDS</span>
        <span>19-JUL-2026</span>
      </div>
    </div>
  )
}

export function DSectionHead({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-[var(--dl-accent)]">
        <span>┌─[ {index} :: {title} ]</span>
        <span className="flex-1 border-t border-[var(--dl-border)]" />
        <span className="text-[var(--dl-border)]">┐</span>
      </div>
      {note ? <p className="mt-3 text-[13px] leading-relaxed text-[var(--dl-muted)]">{note}</p> : null}
    </div>
  )
}

export function DScoreBlock({ score }: { score: number }) {
  const tier = tierFor(score)
  return (
    <div
      className="shrink-0 text-right"
      title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
    >
      <p className={`text-sm font-bold tracking-wider ${tierTextClass(tier)}`}>{gauge(score)}</p>
      <p className="mt-1 text-sm font-bold text-[var(--dl-text)]">
        {score}<span className="font-normal text-[var(--dl-muted)]">/100</span>
      </p>
      <p className={`mt-0.5 text-[10px] font-semibold tracking-[0.2em] ${tierTextClass(tier)}`}>
        {tier.toUpperCase()}
      </p>
    </div>
  )
}

export function DRepoCard({ repo }: { repo: SampleRepo }) {
  const positive = repo.pct7d > 0
  return (
    <article className="group flex h-full flex-col border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 transition-colors hover:border-[var(--dl-accent)] hover:bg-[var(--dl-surface-2)]">
      <div className="flex items-start justify-between gap-4">
        <Link href={`${DL}/project`} className="min-w-0">
          <h3 className="truncate text-[15px] font-bold group-hover:text-[var(--dl-accent-strong)]">
            <span className="font-normal text-[var(--dl-muted)]">{repo.owner}/</span>
            {repo.name}
          </h3>
        </Link>
        <DScoreBlock score={repo.score} />
      </div>

      <p className="mt-3 text-[13px] leading-[1.75] text-[var(--dl-body)] line-clamp-3">
        {repo.summary}
      </p>

      <div className="mt-4 space-y-1 text-[13px] leading-[1.7]">
        <p className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: WHY IT MATTERS</p>
        <p className="text-[var(--dl-muted)] line-clamp-2">
          <span className="mr-1.5 text-[var(--dl-accent)]">›</span>
          {repo.whyItMatters}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <p className={`text-xs font-semibold ${positive ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}>
          {positive ? '▲' : '▼'} {pctLabel(repo.pct7d)} THIS WEEK
          <span className="ml-2 font-normal text-[var(--dl-muted)]">(+{formatCount(repo.stars7d)} stars)</span>
        </p>
        <p className="mt-2 text-[11px] tracking-wide text-[var(--dl-muted)]">
          {formatCount(repo.stars)}★ · {formatCount(repo.forks)}⑂ ·{' '}
          {repo.contributors === 0 ? 'SOLO DEV' : `${contributorsLabel(repo.contributors)} CONTRIBUTORS`}
          {repo.language ? ` · ${repo.language.toUpperCase()}` : ''}
        </p>
      </div>
    </article>
  )
}

export function DChart() {
  const values = commitSeries.map((d) => d.commits)
  const W = 720
  const H = 220
  const pts = toPoints(values, W, H, 4, 10, 22)
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: PLOT — CLAUDE_CODE.COMMITS</p>
          <p className="mt-2 text-2xl font-bold dl-glow-green">
            {formatCount(chartStats.latest)}
            <span className="ml-3 text-sm font-normal text-[var(--dl-positive)]">{chartStats.deltaLabel}</span>
          </p>
        </div>
        <div className="flex gap-2 text-[10px]">
          {['1W', '1M', '3M', '1Y', 'ALL'].map((r) => (
            <span
              key={r}
              className={`cursor-pointer border px-2 py-1 ${
                r === '1M'
                  ? 'border-[var(--dl-accent)] text-[var(--dl-accent)]'
                  : 'border-[var(--dl-border)] text-[var(--dl-muted)] hover:text-[var(--dl-text)]'
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Line chart of daily Claude Code commits over the last 30 days, trending upward">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={f * H} y2={f * H} stroke="var(--dl-border)" strokeDasharray="2 6" strokeWidth={1} />
        ))}
        <path
          d={linePath(pts)}
          fill="none"
          stroke="var(--dl-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 5px rgba(77,255,136,0.5))' }}
        />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5} fill="var(--dl-accent)" />
        {commitSeries.map((d, i) =>
          i % 6 === 0 ? (
            <text key={d.day} x={pts[i].x} y={H - 5} fontSize={10} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
              {d.day}
            </text>
          ) : null
        )}
      </svg>
      <p className="mt-3 border-t border-[var(--dl-border)] pt-3 text-[11px] text-[var(--dl-muted)]">
        {chartStats.totalLabel} · PUBLIC GITHUB, DAILY
      </p>
    </div>
  )
}

export function DNewsletter() {
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6 sm:p-8">
      <p className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: MAILING_LIST.SUBSCRIBE</p>
      <h3 className="mt-3 max-w-xl text-xl font-bold leading-snug sm:text-2xl">
        THE TUESDAY BRIEFING<span className="dl-blink text-[var(--dl-accent)]">_</span>
      </h3>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--dl-muted)]">
        The repos that moved this week, why they matter, and what to watch next.
        One email. No noise.
      </p>
      <div className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row">
        <div className="flex h-11 flex-1 items-center gap-2 border border-[var(--dl-border)] bg-[var(--dl-bg)] px-3 focus-within:border-[var(--dl-accent)]">
          <span className="text-sm text-[var(--dl-accent)]">❯</span>
          <input
            type="email"
            aria-label="Email address"
            placeholder="YOU@COMPANY.COM"
            className="w-full bg-transparent text-[13px] tracking-wide text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:outline-none"
          />
        </div>
        <button
          type="button"
          className="h-11 border border-[var(--dl-accent)] bg-[var(--dl-accent)]/10 px-5 text-[13px] font-bold tracking-wider text-[var(--dl-accent)] transition-colors hover:bg-[var(--dl-accent)] hover:text-[var(--dl-on-accent)]"
        >
          [SUBSCRIBE]
        </button>
      </div>
    </div>
  )
}

// --- Project detail pieces ---

export function DScorePanel() {
  const tier = tierFor(featured.score)
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5">
      <p className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: EARLY_SIGNAL.SCORE</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-5xl font-bold dl-glow-green">
          {featured.score}
          <span className="text-xl font-normal text-[var(--dl-muted)]">/100</span>
        </p>
        <p className={`text-xs font-bold tracking-[0.2em] ${tierTextClass(tier)}`} title={tierExplainer(tier)}>
          {tier.toUpperCase()}
        </p>
      </div>
      <p className={`mt-2 text-lg tracking-wider ${tierTextClass(tier)}`}>{gauge(featured.score, 20)}</p>
      <p className="mt-3 text-xs leading-relaxed text-[var(--dl-muted)]">
        {tierExplainer(tier)}. {SCORE_EXPLAINER}
      </p>

      <div className="mt-5 space-y-2 border-t border-[var(--dl-border)] pt-4">
        {featured.breakdown.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-32 shrink-0 text-[var(--dl-muted)]">
              {s.label.toUpperCase()} <span className="text-[var(--dl-border)]">·{s.weight}%</span>
            </span>
            <span className="flex-1 tracking-wider text-[var(--dl-accent)]/80">{gauge(s.value, 12)}</span>
            <span className="w-7 text-right text-[var(--dl-text)]">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] tracking-wider text-[var(--dl-muted)]">UPDATED {featured.scoredAt.toUpperCase()}</p>
    </div>
  )
}

export function DStatsPanel() {
  const rows: { label: string; value: string }[] = [
    { label: 'STARS', value: formatCount(featured.stars) },
    { label: 'FORKS', value: formatCount(featured.forks) },
    { label: 'CONTRIBUTORS', value: contributorsLabel(featured.contributors).toUpperCase() },
    { label: 'LANGUAGE', value: (featured.language ?? '—').toUpperCase() },
    { label: 'DOWNLOADS_7D', value: featured.downloads7d == null ? '—' : formatCount(featured.downloads7d) },
    { label: 'CATEGORY', value: featured.category.toUpperCase() },
  ]
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5">
      <p className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: REPO.STATS</p>
      <dl className="mt-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-[var(--dl-border)]/60 py-2 last:border-0">
            <dt className="text-[11px] text-[var(--dl-muted)]">{r.label}</dt>
            <dd className="text-[13px] font-bold text-[var(--dl-text)]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
