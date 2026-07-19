// Direction B — "Editorial publication"
// A clean tech-magazine reading experience: paper background, serif display
// type, article-style cards, analysis presented like journalism.

import Link from 'next/link'
import {
  SampleRepo,
  commitSeries,
  chartStats,
  contributorsLabel,
  formatCount,
  pctLabel,
  tierFor,
  tierExplainer,
  SCORE_EXPLAINER,
  toPoints,
  linePath,
  featured,
} from './sample-data'

const DL = '/design-lab/b'

function tierTextClass(tier: string): string {
  if (tier === 'Breakout') return 'text-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'text-[var(--dl-tier-hot)]'
  return 'text-[var(--dl-tier-active)]'
}

export function BNav() {
  return (
    <header className="border-b border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="border-b border-[var(--dl-border)]">
        <p className="mx-auto max-w-4xl px-5 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--dl-muted)] sm:px-8">
          Open-source intelligence · Sunday, July 19, 2026
        </p>
      </div>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href={DL} className="dl-serif text-2xl font-bold tracking-tight text-[var(--dl-text)]">
          GitFind
        </Link>
        <nav className="hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dl-muted)] sm:flex">
          <span className="text-[var(--dl-text)]">Trending</span>
          <span className="cursor-pointer transition-colors hover:text-[var(--dl-text)]">Categories</span>
          <span className="cursor-pointer transition-colors hover:text-[var(--dl-text)]">AI Code Index</span>
          <span className="cursor-pointer transition-colors hover:text-[var(--dl-text)]">Insights</span>
        </nav>
        <Link
          href="/design-lab"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dl-accent)] underline decoration-[var(--dl-border)] underline-offset-4 transition-colors hover:decoration-[var(--dl-accent)]"
        >
          All directions
        </Link>
      </div>
    </header>
  )
}

export function BFooter() {
  return (
    <footer className="border-t border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3 sm:px-8">
        <div>
          <p className="dl-serif text-xl font-bold text-[var(--dl-text)]">GitFind</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--dl-muted)]">
            GitHub, translated. Rising open source, explained in plain English for
            builders, founders, and investors.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dl-muted)]">Sections</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--dl-body)]">
            <li>Trending</li>
            <li>Categories</li>
            <li>AI Code Index</li>
            <li>Insights</li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dl-muted)]">About this page</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dl-muted)]">
            Design mock B — sample data, no live feeds. Part of the GitFind design lab.
          </p>
        </div>
      </div>
      <div className="border-t border-[var(--dl-border)]">
        <p className="mx-auto max-w-6xl px-5 py-4 text-xs text-[var(--dl-muted)] sm:px-8">
          © 2026 GitFind · The Tuesday Briefing
        </p>
      </div>
    </footer>
  )
}

export function BSectionHeader({ kicker, title, lede }: { kicker: string; title: string; lede?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">{kicker}</p>
      <h2 className="dl-serif mt-3 text-3xl font-bold tracking-tight text-[var(--dl-text)] sm:text-4xl">{title}</h2>
      {lede ? <p className="mt-3 text-base leading-relaxed text-[var(--dl-muted)]">{lede}</p> : null}
    </div>
  )
}

export function BScoreNote({ score }: { score: number }) {
  const tier = tierFor(score)
  return (
    <div
      className="flex items-center gap-2.5"
      title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
    >
      <span className="text-sm font-semibold tabular-nums text-[var(--dl-text)]">
        {score}
        <span className="font-normal text-[var(--dl-muted)]">/100</span>
      </span>
      <span className="h-1 w-10 rounded-full bg-[var(--dl-border)]">
        <span className="block h-full rounded-full bg-[var(--dl-accent)]" style={{ width: `${score}%` }} />
      </span>
      <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${tierTextClass(tier)}`}>{tier}</span>
    </div>
  )
}

export function BRepoCard({ repo }: { repo: SampleRepo }) {
  const positive = repo.pct7d > 0
  return (
    <article className="flex h-full flex-col border-t-2 border-[var(--dl-text)] bg-[var(--dl-surface)] px-6 pb-6 pt-5 shadow-[0_1px_2px_rgba(26,29,36,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(26,29,36,0.1)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dl-accent)]">
          {repo.category}
        </p>
        <BScoreNote score={repo.score} />
      </div>

      <Link href={`${DL}/project`} className="mt-3 block">
        <h3 className="dl-serif text-[22px] font-bold leading-snug tracking-tight text-[var(--dl-text)] hover:text-[var(--dl-accent-strong)]">
          {repo.owner}/{repo.name}
        </h3>
      </Link>

      <p className="dl-serif mt-2.5 text-[15.5px] leading-relaxed text-[var(--dl-body)] line-clamp-3">
        {repo.summary}
      </p>

      <blockquote className="mt-4 border-l-2 border-[var(--dl-border)] pl-4">
        <p className="dl-serif text-sm italic leading-relaxed text-[var(--dl-muted)] line-clamp-2">
          {repo.whyItMatters}
        </p>
      </blockquote>

      <div className="mt-auto pt-5">
        <p className={`text-xs font-semibold ${positive ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}>
          {positive ? '▲' : '▼'} {pctLabel(repo.pct7d)} this week
          <span className="ml-1.5 font-normal text-[var(--dl-muted)]">(+{formatCount(repo.stars7d)} stars)</span>
        </p>
        <p className="mt-2 text-xs text-[var(--dl-muted)]">
          {formatCount(repo.stars)} stars · {formatCount(repo.forks)} forks ·{' '}
          {repo.contributors === 0 ? 'Solo developer' : `${contributorsLabel(repo.contributors)} contributors`}
          {repo.language ? ` · ${repo.language}` : ''}
        </p>
      </div>
    </article>
  )
}

export function BChart() {
  const values = commitSeries.map((d) => d.commits)
  const W = 720
  const H = 220
  const pts = toPoints(values, W, H, 2, 10, 22)
  return (
    <figure className="border-y border-[var(--dl-border)] py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <figcaption className="dl-serif text-xl font-bold text-[var(--dl-text)]">
          AI now writes a quarter-million lines’ worth of commits a day
        </figcaption>
        <p className="text-sm font-semibold text-[var(--dl-positive)]">{chartStats.deltaLabel}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 h-auto w-full" role="img" aria-label="Line chart of daily Claude Code commits over the last 30 days, trending upward">
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={0} x2={W} y1={f * H} y2={f * H} stroke="var(--dl-border)" strokeWidth={1} />
        ))}
        <path d={linePath(pts)} fill="none" stroke="var(--dl-accent)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4} fill="var(--dl-accent)" />
        {commitSeries.map((d, i) =>
          i % 6 === 0 ? (
            <text key={d.day} x={pts[i].x} y={H - 4} fontSize={11} fill="var(--dl-muted)" fontFamily="var(--font-geist-sans), system-ui, sans-serif">
              {d.day}
            </text>
          ) : null
        )}
      </svg>
      <p className="mt-4 text-sm leading-relaxed text-[var(--dl-muted)]">
        Daily commits authored by Claude Code across public GitHub repositories.{' '}
        {chartStats.totalLabel}. <span className="italic">Source: GitFind AI Code Index.</span>
      </p>
    </figure>
  )
}

export function BNewsletter() {
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)] px-6 py-10 text-center sm:px-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
        The Tuesday Briefing
      </p>
      <h3 className="dl-serif mx-auto mt-3 max-w-md text-3xl font-bold tracking-tight text-[var(--dl-text)]">
        One email. Every Tuesday. No noise.
      </h3>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--dl-muted)]">
        The repos that moved this week, why they matter, and what to watch next — written
        for people who make decisions, not for terminals.
      </p>
      <div className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row">
        <input
          type="email"
          aria-label="Email address"
          placeholder="you@company.com"
          className="h-11 flex-1 border border-[var(--dl-border)] bg-[var(--dl-bg)] px-4 text-sm text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:border-[var(--dl-accent)] focus:outline-none"
        />
        <button
          type="button"
          className="h-11 bg-[var(--dl-text)] px-6 text-sm font-semibold text-[var(--dl-bg)] transition-colors hover:bg-[var(--dl-accent-strong)]"
        >
          Subscribe
        </button>
      </div>
      <p className="mt-4 text-xs text-[var(--dl-muted)]">Free forever. Unsubscribe anytime.</p>
    </div>
  )
}

// --- Project detail pieces ---

export function BFactBox() {
  const tier = tierFor(featured.score)
  return (
    <aside className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dl-muted)]">
        GitFind Fact Box
      </p>

      <div className="mt-4 flex items-end justify-between gap-3 border-b border-[var(--dl-border)] pb-4">
        <p className="text-4xl font-bold tabular-nums tracking-tight text-[var(--dl-text)]">
          {featured.score}
          <span className="text-lg font-normal text-[var(--dl-muted)]">/100</span>
        </p>
        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tierTextClass(tier)}`}>{tier}</p>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--dl-muted)]">
        <span className="font-semibold text-[var(--dl-body)]">Early Signal Score.</span>{' '}
        {tierExplainer(tier)}. {SCORE_EXPLAINER}
      </p>

      <table className="mt-5 w-full text-[13px]">
        <tbody>
          {featured.breakdown.map((s) => (
            <tr key={s.label} className="border-t border-[var(--dl-border)]">
              <td className="py-2 pr-2 text-[var(--dl-body)]">{s.label}</td>
              <td className="py-2 pr-2 text-right text-[var(--dl-muted)]">{s.weight}%</td>
              <td className="w-24 py-2">
                <span className="block h-1 rounded-full bg-[var(--dl-border)]">
                  <span className="block h-full rounded-full bg-[var(--dl-accent)]" style={{ width: `${s.value}%` }} />
                </span>
              </td>
              <td className="py-2 pl-2 text-right font-semibold tabular-nums text-[var(--dl-text)]">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--dl-border)] pt-4 text-[13px]">
        <div>
          <dt className="text-[var(--dl-muted)]">Stars</dt>
          <dd className="font-semibold tabular-nums text-[var(--dl-text)]">{formatCount(featured.stars)}</dd>
        </div>
        <div>
          <dt className="text-[var(--dl-muted)]">Forks</dt>
          <dd className="font-semibold tabular-nums text-[var(--dl-text)]">{formatCount(featured.forks)}</dd>
        </div>
        <div>
          <dt className="text-[var(--dl-muted)]">Contributors</dt>
          <dd className="font-semibold text-[var(--dl-text)]">{contributorsLabel(featured.contributors)}</dd>
        </div>
        <div>
          <dt className="text-[var(--dl-muted)]">Language</dt>
          <dd className="font-semibold text-[var(--dl-text)]">{featured.language ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--dl-muted)]">Downloads (7d)</dt>
          <dd className="font-semibold text-[var(--dl-text)]">
            {featured.downloads7d == null ? '—' : formatCount(featured.downloads7d)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--dl-muted)]">Score updated</dt>
          <dd className="font-semibold text-[var(--dl-text)]">{featured.scoredAt}</dd>
        </div>
      </dl>
    </aside>
  )
}
