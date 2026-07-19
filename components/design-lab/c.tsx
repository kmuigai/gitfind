// Direction C — "Minimal dashboard"
// Linear/Vercel-style quiet UI: compact, near-monochrome, one indigo accent,
// subtle borders, tabular numerals, data legibility first.

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
  areaPath,
  featured,
} from './sample-data'

const DL = '/design-lab/c'

function tierDotClass(tier: string): string {
  if (tier === 'Breakout') return 'bg-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'bg-[var(--dl-tier-hot)]'
  return 'bg-[var(--dl-tier-active)]'
}

export function CNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--dl-border)] bg-[var(--dl-surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href={DL} className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[var(--dl-accent)] text-[11px] font-bold text-white">
            G
          </span>
          <span className="text-[13px] font-semibold text-[var(--dl-text)]">GitFind</span>
        </Link>
        <nav className="hidden items-center gap-1 text-[13px] md:flex">
          {['Overview', 'Trending', 'Categories', 'Insights'].map((item) => (
            <span
              key={item}
              className={`cursor-pointer rounded-md px-2.5 py-1 ${
                item === 'Trending'
                  ? 'bg-[var(--dl-surface-2)] font-medium text-[var(--dl-text)]'
                  : 'text-[var(--dl-muted)] hover:text-[var(--dl-text)]'
              }`}
            >
              {item}
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-md border border-[var(--dl-border)] bg-[var(--dl-surface)] px-2.5 py-1 text-xs text-[var(--dl-dim)] sm:flex">
            Search
            <kbd className="rounded border border-[var(--dl-border)] px-1 font-mono text-[10px]">⌘K</kbd>
          </span>
          <Link href="/design-lab" className="text-xs font-medium text-[var(--dl-muted)] hover:text-[var(--dl-text)]">
            ← Directions
          </Link>
        </div>
      </div>
    </header>
  )
}

export function CFooter() {
  return (
    <footer className="border-t border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[var(--dl-dim)] sm:px-6">
        <p>© 2026 GitFind — Design mock C · Sample data, no live feeds</p>
        <p className="flex gap-4">
          <span className="cursor-pointer hover:text-[var(--dl-text)]">AI Code Index</span>
          <span className="cursor-pointer hover:text-[var(--dl-text)]">Insights</span>
          <span className="cursor-pointer hover:text-[var(--dl-text)]">Submit</span>
        </p>
      </div>
    </footer>
  )
}

export function CScoreCell({ score }: { score: number }) {
  const tier = tierFor(score)
  return (
    <div
      className="flex items-center gap-2"
      title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
    >
      <span className="w-6 text-right text-[13px] font-semibold tabular-nums text-[var(--dl-text)]">{score}</span>
      <span className="h-1 w-12 rounded-full bg-[var(--dl-border)]">
        <span className="block h-full rounded-full bg-[var(--dl-accent)]" style={{ width: `${score}%` }} />
      </span>
      <span className={`h-1.5 w-1.5 rounded-full ${tierDotClass(tier)}`} title={tier} />
    </div>
  )
}

function CGain({ pct, stars7d, stacked }: { pct: number; stars7d: number; stacked?: boolean }) {
  const positive = pct > 0
  return (
    <div title={`+${formatCount(stars7d)} stars this week, ${pctLabel(pct)} versus last week`}>
      <span className={`text-[13px] font-medium tabular-nums ${positive ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}>
        {pctLabel(pct)}
      </span>
      {stacked ? (
        <span className="block text-[11px] text-[var(--dl-dim)]">this week</span>
      ) : (
        <span className="ml-1 text-[11px] text-[var(--dl-dim)]">this week</span>
      )}
    </div>
  )
}

export function CRepoTable({ items }: { items: SampleRepo[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      {/* Desktop table */}
      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-b border-[var(--dl-border)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--dl-dim)]">
            <th className="px-4 py-2.5 font-medium">Project</th>
            <th className="px-4 py-2.5 font-medium" title={SCORE_EXPLAINER}>Score /100</th>
            <th className="px-4 py-2.5 font-medium">Δ Stars</th>
            <th className="px-4 py-2.5 text-right font-medium">Stars</th>
            <th className="px-4 py-2.5 font-medium">Language</th>
            <th className="px-4 py-2.5 font-medium">Contributors</th>
            <th className="px-4 py-2.5 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          {items.map((repo) => (
            <tr
              key={`${repo.owner}/${repo.name}`}
              className="group border-b border-[var(--dl-border)] transition-colors last:border-0 hover:bg-[var(--dl-surface-2)]/60"
            >
              <td className="max-w-[340px] px-4 py-3">
                <Link href={`${DL}/project`} className="block">
                  <span className="block truncate text-[13px] font-semibold text-[var(--dl-text)] group-hover:text-[var(--dl-accent)]">
                    {repo.owner}/{repo.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--dl-muted)]">{repo.summary}</span>
                </Link>
              </td>
              <td className="px-4 py-3"><CScoreCell score={repo.score} /></td>
              <td className="px-4 py-3"><CGain pct={repo.pct7d} stars7d={repo.stars7d} /></td>
              <td className="px-4 py-3 text-right text-[13px] tabular-nums text-[var(--dl-body)]">{formatCount(repo.stars)}</td>
              <td className="px-4 py-3 text-[13px] text-[var(--dl-body)]">{repo.language ?? '—'}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums text-[var(--dl-body)]">
                {repo.contributors === 0 ? <span className="text-[var(--dl-dim)]">Solo</span> : contributorsLabel(repo.contributors)}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-[var(--dl-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--dl-muted)]">
                  {repo.category}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-[var(--dl-border)] md:hidden">
        {items.map((repo) => (
          <li key={`${repo.owner}/${repo.name}`}>
            <Link href={`${DL}/project`} className="block px-4 py-3.5">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-semibold text-[var(--dl-text)]">
                  {repo.owner}/{repo.name}
                </span>
                <CScoreCell score={repo.score} />
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-[var(--dl-muted)] line-clamp-2">
                {repo.summary}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--dl-dim)]">
                <CGain pct={repo.pct7d} stars7d={repo.stars7d} />
                <span>{formatCount(repo.stars)} stars</span>
                <span>{repo.contributors === 0 ? 'Solo' : `${contributorsLabel(repo.contributors)} contributors`}</span>
                <span className="rounded-full bg-[var(--dl-surface-2)] px-2 py-0.5">{repo.category}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CMetricCards() {
  const metrics = [
    { label: 'Projects tracked', value: '2,847', delta: '+12 today', up: true },
    { label: 'Avg Early Signal Score', value: '46', delta: '+1.8 this week', up: true },
    { label: 'Stars added today', value: '31.2k', delta: '+6.4% vs yesterday', up: true },
    { label: 'Claude Code commits today', value: '218.9k', delta: '+23% week over week', up: true },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] px-4 py-3.5">
          <p className="text-xs text-[var(--dl-muted)]">{m.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-[var(--dl-text)]">{m.value}</p>
          <p className={`mt-0.5 text-[11px] font-medium ${m.up ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}>
            {m.delta}
          </p>
        </div>
      ))}
    </div>
  )
}

export function CChart() {
  const values = commitSeries.map((d) => d.commits)
  const W = 760
  const H = 200
  const pts = toPoints(values, W, H, 2, 8, 20)
  return (
    <div className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[13px] font-semibold text-[var(--dl-text)]">Claude Code commits</h2>
          <p className="text-xs text-[var(--dl-dim)]">Public GitHub, daily</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-semibold tabular-nums text-[var(--dl-text)]">
            {formatCount(chartStats.latest)}
            <span className="ml-2 text-xs font-medium text-[var(--dl-positive)]">{chartStats.deltaLabel}</span>
          </p>
          <div className="flex rounded-md border border-[var(--dl-border)] text-[11px]">
            {['7d', '30d', '90d', 'All'].map((r) => (
              <span
                key={r}
                className={`cursor-pointer px-2 py-1 ${
                  r === '30d'
                    ? 'bg-[var(--dl-surface-2)] font-medium text-[var(--dl-text)]'
                    : 'text-[var(--dl-dim)] hover:text-[var(--dl-text)]'
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Line chart of daily Claude Code commits over the last 30 days, trending upward">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={f * H} y2={f * H} stroke="var(--dl-border)" strokeWidth={1} />
        ))}
        <path d={areaPath(pts, H)} fill="var(--dl-accent)" fillOpacity={0.06} />
        <path d={linePath(pts)} fill="none" stroke="var(--dl-accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill="var(--dl-accent)" />
        {commitSeries.map((d, i) =>
          i % 6 === 0 ? (
            <text key={d.day} x={pts[i].x} y={H - 4} fontSize={10} fill="var(--dl-dim)" fontFamily="var(--font-geist-sans), system-ui, sans-serif">
              {d.day}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}

export function CNewsletter() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[13px] font-semibold text-[var(--dl-text)]">The Tuesday Briefing</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--dl-muted)]">
          The repos that moved this week, why they matter, what to watch next. One email, no noise.
        </p>
      </div>
      <div className="flex w-full max-w-sm gap-2">
        <input
          type="email"
          aria-label="Email address"
          placeholder="you@company.com"
          className="h-9 flex-1 rounded-md border border-[var(--dl-border)] bg-[var(--dl-bg)] px-3 text-[13px] text-[var(--dl-text)] placeholder:text-[var(--dl-dim)] focus:border-[var(--dl-accent)] focus:outline-none"
        />
        <button
          type="button"
          className="h-9 rounded-md bg-[var(--dl-accent)] px-4 text-[13px] font-medium text-[var(--dl-on-accent)] transition-colors hover:bg-[var(--dl-accent-strong)]"
        >
          Subscribe
        </button>
      </div>
    </div>
  )
}

// --- Project detail pieces ---

export function CScorePanel() {
  const tier = tierFor(featured.score)
  return (
    <div className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="border-b border-[var(--dl-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--dl-muted)]" title={SCORE_EXPLAINER}>
            Early Signal Score
          </p>
          <span
            className="rounded-full bg-[var(--dl-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--dl-muted)]"
            title={tierExplainer(tier)}
          >
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${tierDotClass(tier)}`} />
            {tier}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--dl-text)]">{featured.score}</p>
          <p className="text-sm tabular-nums text-[var(--dl-dim)]">/ 100</p>
        </div>
        <div className="mt-2.5 h-1 w-full rounded-full bg-[var(--dl-border)]">
          <div className="h-full rounded-full bg-[var(--dl-accent)]" style={{ width: `${featured.score}%` }} />
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-[var(--dl-muted)]">
          {tierExplainer(tier)}. Blends star growth, active builders, community buzz, and commit pace.
        </p>
      </div>

      <div className="px-4 py-3">
        {featured.breakdown.map((s) => (
          <div key={s.label} className="flex items-center gap-2 py-1.5">
            <span className="w-28 shrink-0 text-xs text-[var(--dl-muted)]">{s.label}</span>
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[var(--dl-dim)]">{s.weight}%</span>
            <span className="h-1 flex-1 rounded-full bg-[var(--dl-border)]">
              <span className="block h-full rounded-full bg-[var(--dl-accent)]/60" style={{ width: `${s.value}%` }} />
            </span>
            <span className="w-6 text-right text-xs font-medium tabular-nums text-[var(--dl-text)]">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-[var(--dl-border)] px-4 py-2.5 text-[11px] text-[var(--dl-dim)]">
        Score updated {featured.scoredAt}
      </p>
    </div>
  )
}

export function CStatsPanel() {
  const rows: { label: string; value: string }[] = [
    { label: 'Stars', value: formatCount(featured.stars) },
    { label: 'Forks', value: formatCount(featured.forks) },
    { label: 'Contributors', value: contributorsLabel(featured.contributors) },
    { label: 'Language', value: featured.language ?? '—' },
    { label: 'Downloads (7d)', value: featured.downloads7d == null ? '—' : formatCount(featured.downloads7d) },
    { label: 'Category', value: featured.category },
  ]
  return (
    <div className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <p className="border-b border-[var(--dl-border)] px-4 py-3 text-xs font-medium text-[var(--dl-muted)]">
        Repository stats
      </p>
      <dl>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-[var(--dl-border)] px-4 py-2.5 last:border-0">
            <dt className="text-xs text-[var(--dl-muted)]">{r.label}</dt>
            <dd className="text-[13px] font-medium tabular-nums text-[var(--dl-text)]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
