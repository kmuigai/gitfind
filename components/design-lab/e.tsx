// Direction E — "Bloomberg"
// The financial terminal: amber and white on charcoal, function keys, ticker
// tape, dense panels. Terminal DNA that reads as authority to investors.

import Link from 'next/link'
import {
  SampleRepo,
  repos,
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

const DL = '/design-lab/e'

function tierTextClass(tier: string): string {
  if (tier === 'Breakout') return 'text-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'text-[var(--dl-tier-hot)]'
  return 'text-[var(--dl-tier-active)]'
}

export function ENav() {
  return (
    <header className="border-b border-[var(--dl-border)] bg-[var(--dl-surface)]">
      {/* Info strip */}
      <div className="border-b border-[var(--dl-border)] bg-[var(--dl-bg)]">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-between px-4 font-mono text-[10px] tracking-wider text-[var(--dl-muted)] sm:px-6">
          <p>
            <span className="mr-2 bg-[var(--dl-accent)] px-1.5 py-0.5 font-bold text-[var(--dl-on-accent)]">GF</span>
            GITFIND PROFESSIONAL
          </p>
          <p className="hidden sm:block">SUN 19-JUL-2026 09:41 UTC</p>
        </div>
      </div>
      {/* Function key bar */}
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4 sm:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto font-mono text-[11px]">
          {['F1 TRENDING', 'F2 CATEGORIES', 'F3 INDEX', 'F4 INSIGHTS', 'F5 BRIEFING'].map((k, i) => (
            <span
              key={k}
              className={`cursor-pointer whitespace-nowrap border px-2 py-1 ${
                i === 0
                  ? 'border-[var(--dl-accent)] text-[var(--dl-accent)]'
                  : 'border-[var(--dl-border)] text-[var(--dl-muted)] hover:border-[var(--dl-muted)] hover:text-[var(--dl-text)]'
              }`}
            >
              {k}
            </span>
          ))}
        </nav>
        <Link href="/design-lab" className="ml-3 hidden shrink-0 font-mono text-[11px] text-[var(--dl-muted)] hover:text-[var(--dl-accent)] sm:block">
          MENU &lt;GO&gt;
        </Link>
      </div>
    </header>
  )
}

export function ETicker() {
  const items = repos.map((r) => (
    <span key={`${r.owner}/${r.name}`} className="mx-5 inline-flex items-center gap-2">
      <span className="text-[var(--dl-text)]">{r.owner}/{r.name}</span>
      <span className={r.pct7d > 0 ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}>
        {r.pct7d > 0 ? '▲' : '▼'} {pctLabel(r.pct7d)} 1W
      </span>
      <span className="text-[var(--dl-muted)]">{formatCount(r.stars)}★</span>
    </span>
  ))
  return (
    <div className="overflow-hidden border-b border-[var(--dl-border)] bg-[var(--dl-bg)] py-1.5" aria-hidden="true">
      <div className="dl-marquee flex w-max whitespace-nowrap font-mono text-[11px]">
        <div className="flex">{items}</div>
        <div className="flex">{items}</div>
      </div>
    </div>
  )
}

export function EPanelHead({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--dl-border)] bg-[var(--dl-surface-2)] px-4 py-2">
      <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-[var(--dl-accent)]">{title}</p>
      {right ? <p className="font-mono text-[10px] text-[var(--dl-muted)]">{right}</p> : null}
    </div>
  )
}

export function EScoreCell({ score }: { score: number }) {
  const tier = tierFor(score)
  return (
    <div
      className="flex items-center gap-2"
      title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
    >
      <span className="w-7 text-right font-mono text-[13px] font-bold tabular-nums text-[var(--dl-text)]">{score}</span>
      <span className="h-1.5 w-14 bg-[var(--dl-border)]">
        <span className="block h-full bg-[var(--dl-accent)]" style={{ width: `${score}%` }} />
      </span>
      <span className={`font-mono text-[10px] font-bold tracking-wider ${tierTextClass(tier)}`}>
        {tier.toUpperCase()}
      </span>
    </div>
  )
}

export function ERepoRows({ items }: { items: SampleRepo[] }) {
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <EPanelHead title="TRENDING REPOSITORIES — WEEK 29" right="RANK: EARLY SIGNAL /100" />
      {/* Desktop header */}
      <div className="hidden grid-cols-[1fr_190px_120px_90px_110px] gap-3 border-b border-[var(--dl-border)] px-4 py-2 font-mono text-[10px] tracking-wider text-[var(--dl-muted)] lg:grid">
        <span>PROJECT / SUMMARY</span>
        <span>SCORE /100</span>
        <span>Δ STARS (1W)</span>
        <span className="text-right">STARS</span>
        <span>CATEGORY</span>
      </div>
      <ul>
        {items.map((repo) => (
          <li key={`${repo.owner}/${repo.name}`} className="border-b border-[var(--dl-border)] last:border-0">
            <Link
              href={`${DL}/project`}
              className="grid grid-cols-1 gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--dl-surface-2)] lg:grid-cols-[1fr_190px_120px_90px_110px] lg:items-center lg:gap-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-[var(--dl-text)]">
                  {repo.owner}/{repo.name}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-[var(--dl-muted)]">{repo.summary}</span>
              </span>
              <EScoreCell score={repo.score} />
              <span className={`font-mono text-[12px] font-semibold tabular-nums ${repo.pct7d > 0 ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}>
                {repo.pct7d > 0 ? '▲' : '▼'} {pctLabel(repo.pct7d)}
                <span className="ml-1 font-normal text-[var(--dl-muted)]">THIS WK</span>
              </span>
              <span className="font-mono text-[13px] tabular-nums text-[var(--dl-body)] lg:text-right">
                {formatCount(repo.stars)}★
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--dl-muted)]">
                {repo.category}
                <span className="ml-2 text-[var(--dl-body)]">
                  {repo.contributors === 0 ? 'SOLO' : `${contributorsLabel(repo.contributors)} CTRB`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EStatStrip() {
  const stats = [
    { label: 'REPOS TRACKED', value: '2,847', delta: '+12' },
    { label: 'AVG SIGNAL', value: '46/100', delta: '+1.8' },
    { label: 'STARS TODAY', value: '31.2K', delta: '+6.4%' },
    { label: 'AI COMMITS', value: '218.9K', delta: '+23%' },
  ]
  return (
    <div className="grid grid-cols-2 border border-[var(--dl-border)] bg-[var(--dl-surface)] lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="border-b border-r border-[var(--dl-border)] px-4 py-3 last:border-r-0 lg:border-b-0">
          <p className="font-mono text-[10px] tracking-wider text-[var(--dl-muted)]">{s.label}</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--dl-text)]">
            {s.value}{' '}
            <span className="text-[11px] font-semibold text-[var(--dl-positive)]">▲{s.delta}</span>
          </p>
        </div>
      ))}
    </div>
  )
}

export function EChart() {
  const values = commitSeries.map((d) => d.commits)
  const W = 760
  const H = 200
  const pts = toPoints(values, W, H, 2, 8, 20)
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <EPanelHead title="AI COMMIT INDEX — CLAUDE CODE" right={`${chartStats.totalLabel.toUpperCase()} · DAILY`} />
      <div className="p-4">
        <p className="font-mono text-xl font-bold tabular-nums text-[var(--dl-text)]">
          {formatCount(chartStats.latest)}
          <span className="ml-3 text-[12px] font-semibold text-[var(--dl-positive)]">▲ {chartStats.deltaLabel.toUpperCase()}</span>
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Line chart of daily Claude Code commits over the last 30 days, trending upward">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={f * H} y2={f * H} stroke="var(--dl-border)" strokeWidth={1} />
          ))}
          <path d={linePath(pts)} fill="none" stroke="var(--dl-accent)" strokeWidth={2} strokeLinejoin="round" />
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5} fill="var(--dl-accent)" />
          {commitSeries.map((d, i) =>
            i % 6 === 0 ? (
              <text key={d.day} x={pts[i].x} y={H - 4} fontSize={10} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
                {d.day}
              </text>
            ) : null
          )}
        </svg>
      </div>
    </div>
  )
}

export function ENewsletter() {
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <EPanelHead title="WEEKLY BRIEF" right="TUESDAYS 07:00 UTC" />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-[13px] leading-relaxed text-[var(--dl-body)]">
          The repos that moved this week, why they matter, and what to watch next.
          One email. No noise.
        </p>
        <div className="flex w-full max-w-sm gap-2">
          <input
            type="email"
            aria-label="Email address"
            placeholder="EMAIL ADDRESS"
            className="h-9 flex-1 border border-[var(--dl-border)] bg-[var(--dl-bg)] px-3 font-mono text-[12px] text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:border-[var(--dl-accent)] focus:outline-none"
          />
          <button
            type="button"
            className="h-9 bg-[var(--dl-accent)] px-4 font-mono text-[12px] font-bold text-[var(--dl-on-accent)] transition-colors hover:bg-[var(--dl-accent-strong)]"
          >
            SUBSCRIBE &lt;GO&gt;
          </button>
        </div>
      </div>
    </div>
  )
}

export function EFooter() {
  return (
    <footer className="border-t border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 font-mono text-[10px] tracking-wider text-[var(--dl-muted)] sm:px-6">
        <p>
          <span className="mr-2 bg-[var(--dl-accent)] px-1.5 py-0.5 font-bold text-[var(--dl-on-accent)]">GF</span>
          GITFIND — GITHUB, TRANSLATED
        </p>
        <p>MOCK E · SAMPLE DATA · <Link href="/design-lab" className="hover:text-[var(--dl-accent)]">MENU &lt;GO&gt;</Link></p>
      </div>
    </footer>
  )
}

// --- Project detail pieces ---

export function EScorePanel() {
  const tier = tierFor(featured.score)
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <EPanelHead title="EARLY SIGNAL SCORE" right={`AS OF ${featured.scoredAt.toUpperCase()}`} />
      <div className="p-4">
        <div className="flex items-end justify-between">
          <p className="font-mono text-4xl font-bold tabular-nums text-[var(--dl-text)]">
            {featured.score}
            <span className="text-base font-normal text-[var(--dl-muted)]">/100</span>
          </p>
          <p className={`font-mono text-[11px] font-bold tracking-[0.18em] ${tierTextClass(tier)}`} title={tierExplainer(tier)}>
            {tier.toUpperCase()}
          </p>
        </div>
        <div className="mt-3 h-1.5 w-full bg-[var(--dl-border)]">
          <div className="h-full bg-[var(--dl-accent)]" style={{ width: `${featured.score}%` }} />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--dl-muted)]">
          {tierExplainer(tier)}. {SCORE_EXPLAINER}
        </p>
        <div className="mt-4 border-t border-[var(--dl-border)] pt-3">
          {featured.breakdown.map((s) => (
            <div key={s.label} className="flex items-center gap-2 py-1 font-mono text-[11px]">
              <span className="w-28 shrink-0 text-[var(--dl-muted)]">{s.label}</span>
              <span className="w-8 shrink-0 text-right tabular-nums text-[var(--dl-muted)]">{s.weight}%</span>
              <span className="h-1 flex-1 bg-[var(--dl-border)]">
                <span className="block h-full bg-[var(--dl-accent)]/70" style={{ width: `${s.value}%` }} />
              </span>
              <span className="w-6 text-right tabular-nums text-[var(--dl-text)]">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function EStatsPanel() {
  const rows: { label: string; value: string }[] = [
    { label: 'STARS', value: formatCount(featured.stars) },
    { label: 'FORKS', value: formatCount(featured.forks) },
    { label: 'CONTRIBUTORS', value: contributorsLabel(featured.contributors).toUpperCase() },
    { label: 'LANGUAGE', value: (featured.language ?? '—').toUpperCase() },
    { label: 'DOWNLOADS 7D', value: featured.downloads7d == null ? '—' : formatCount(featured.downloads7d) },
    { label: 'CATEGORY', value: featured.category.toUpperCase() },
  ]
  return (
    <div className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <EPanelHead title="REPO STATISTICS" />
      <dl className="p-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between border-b border-[var(--dl-border)]/60 py-1.5 last:border-0">
            <dt className="font-mono text-[11px] tracking-wide text-[var(--dl-muted)]">{r.label}</dt>
            <dd className="font-mono text-[12px] font-bold tabular-nums text-[var(--dl-text)]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
