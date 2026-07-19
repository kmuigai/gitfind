// Direction I — "1-bit parts catalog"
// Strict two-tone discipline: ink on cream, one yellow, dither textures,
// hard offset shadows, pixel display type, lowercase machine-log voice.
// DNA: play.date screen tones, teenage.engineering catalog voice, xxiivv dither.

import Link from 'next/link'
import {
  SampleRepo,
  repos,
  commitSeries,
  chartStats,
  contributorsLabel,
  formatCount,
  gauge,
  pctLabel,
  tierFor,
  tierExplainer,
  SCORE_EXPLAINER,
  featured,
} from './sample-data'

const DL = '/design-lab/i'

/* --- ticker (analogue/cameron marquee) --- */

export function ITicker() {
  const items = repos.map((r) => (
    <span key={`${r.owner}/${r.name}`} className="mx-6">
      {r.owner}/{r.name}{' '}
      <span className="text-[var(--dl-accent)]">
        {r.pct7d > 0 ? '▲' : '▼'} {pctLabel(r.pct7d)} this week
      </span>
    </span>
  ))
  return (
    <div className="overflow-hidden border-b-2 border-[var(--dl-line)] bg-[var(--dl-ink)] py-2" aria-hidden="true">
      <div className="dl-marquee flex w-max whitespace-nowrap font-mono text-[12px] font-bold uppercase tracking-wider text-[var(--dl-paper)]">
        <div className="flex">{items}</div>
        <div className="flex">{items}</div>
      </div>
    </div>
  )
}

export function IHeader({ active = 'index' }: { active?: 'index' | 'ai-index' }) {
  const items: { label: string; href: string; key: string }[] = [
    { label: 'index', href: '/design-lab/i', key: 'index' },
    { label: 'ai index', href: '/design-lab/i/ai-index', key: 'ai-index' },
    { label: 'categories', href: '/design-lab/i', key: 'categories' },
    { label: 'about', href: '/design-lab/i', key: 'about' },
  ]
  return (
    <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 font-mono text-[12px] text-[var(--dl-muted)] sm:px-6">
      <nav className="flex gap-4">
        {items.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className={`px-1 ${active === l.key ? 'bg-[var(--dl-ink)] text-[var(--dl-paper)]' : 'dl-invert-hover'}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="hidden sm:block">feed refreshed 04:12 ago</p>
      <Link href="/design-lab" className="dl-invert-hover px-1">
        exit
      </Link>
    </div>
  )
}

export function IHero() {
  return (
    <section className="border-b-2 border-[var(--dl-line)]">
      <div className="dl-halftone">
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--dl-muted)]">
            open source intelligence — catalog no. 29
          </p>
          <h1 className="dl-pixel mt-4 text-[26px] font-bold leading-[1.15] text-[var(--dl-ink)] sm:text-5xl">
            GITHUB,<br />TRANSLATED.
          </h1>
          <p className="mt-5 max-w-md font-mono text-[13px] leading-[1.8] text-[var(--dl-body)]">
            the rising open-source projects that matter, explained in plain
            english. before everyone else sees them.
          </p>
          <p className="mt-6 inline-block border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--dl-body)]">
            repos tracked: <b>2,847</b> · this week: <b>6 movers</b> · crank not required
          </p>
        </div>
      </div>
    </section>
  )
}

/* --- catalog entries --- */

export function IRepoEntry({ repo, index }: { repo: SampleRepo; index: number }) {
  const tier = tierFor(repo.score)
  const positive = repo.pct7d > 0
  return (
    <article className="dl-hardshadow border-2 border-[var(--dl-line)] bg-[var(--dl-paper)]">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-[var(--dl-line)] px-4 py-2">
        <p className="font-mono text-[11px] tracking-wider text-[var(--dl-muted)]">
          no. {String(index + 1).padStart(3, '0')}
        </p>
        <p className="font-mono text-[11px] text-[var(--dl-muted)]">{repo.category.toLowerCase()}</p>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <Link href={`${DL}/project`} className="min-w-0">
            <h3 className="truncate font-mono text-lg font-bold tracking-tight text-[var(--dl-ink)]">
              {repo.owner}/{repo.name}
            </h3>
          </Link>
          <div
            className="shrink-0 text-right font-mono"
            title={`early signal score: ${repo.score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
          >
            <p className="text-[15px] font-bold text-[var(--dl-ink)]">
              {repo.score}<span className="font-normal text-[var(--dl-muted)]">/100</span>
            </p>
            <p className="mt-1 inline-block bg-[var(--dl-ink)] px-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dl-paper)]">
              {tier}
            </p>
          </div>
        </div>

        <p className="mt-2.5 font-mono text-[13.5px] leading-[1.8] text-[var(--dl-body)] line-clamp-3">
          {repo.summary}
        </p>

        <p className="mt-3 border-l-2 border-[var(--dl-line)] pl-3 font-mono text-[12.5px] leading-[1.75] text-[var(--dl-muted)] line-clamp-2">
          <span className="font-bold text-[var(--dl-ink)]">why it matters: </span>
          {repo.whyItMatters}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11.5px] text-[var(--dl-body)]">
          <span
            className={`border-2 px-1.5 py-0.5 font-bold ${
              positive
                ? 'border-[var(--dl-line)] bg-[var(--dl-accent)] text-[var(--dl-ink)]'
                : 'border-[var(--dl-line)] bg-transparent text-[var(--dl-ink)]'
            }`}
            title={`+${formatCount(repo.stars7d)} stars this week, ${pctLabel(repo.pct7d)} versus last week`}
          >
            {positive ? '▲' : '▼'} {pctLabel(repo.pct7d)} this week
          </span>
          <span>{formatCount(repo.stars)}★</span>
          <span>{formatCount(repo.forks)}⑂</span>
          <span>{repo.contributors === 0 ? 'Solo' : `${contributorsLabel(repo.contributors)} contributors`}</span>
          {repo.language ? <span>{repo.language}</span> : null}
        </div>
      </div>
    </article>
  )
}

/* --- fig. 01 chart (dither bars) --- */

export function IChart() {
  const values = commitSeries.map((d) => d.commits)
  const max = Math.max(...values)
  const W = 680
  const H = 190
  const padTop = 8
  const padBottom = 20
  const barW = W / values.length
  const gridLevels = [100000, 200000]
  return (
    <figure className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[var(--dl-line)] px-4 py-2 font-mono text-[11px] text-[var(--dl-muted)]">
        <p>fig. 01 — claude code commits, daily</p>
        <p>
          latest <b className="text-[var(--dl-ink)]">{formatCount(chartStats.latest)}</b> · {chartStats.deltaLabel}
        </p>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart of daily Claude Code commits over the last 30 days, trending upward">
          {gridLevels.map((g) => {
            const y = H - padBottom - (g / max) * (H - padTop - padBottom)
            return (
              <g key={g}>
                <line x1={0} x2={W} y1={y} y2={y} stroke="var(--dl-ink)" strokeWidth={0.75} strokeDasharray="2 4" opacity={0.35} />
                <text x={0} y={y - 3} fontSize={9} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
                  {formatCount(g)}
                </text>
              </g>
            )
          })}
          {values.map((v, i) => {
            const h = (v / max) * (H - padTop - padBottom)
            const isLast = i === values.length - 1
            return (
              <rect
                key={commitSeries[i].day}
                x={i * barW + 1}
                y={H - padBottom - h}
                width={barW - 2}
                height={h}
                fill={isLast ? 'var(--dl-accent)' : 'var(--dl-ink)'}
                stroke={isLast ? 'var(--dl-ink)' : 'none'}
                strokeWidth={isLast ? 2 : 0}
              />
            )
          })}
          {/* value label on latest bar */}
          <text
            x={W - 4}
            y={H - padBottom - (values[values.length - 1] / max) * (H - padTop - padBottom) - 5}
            textAnchor="end"
            fontSize={11}
            fontWeight="bold"
            fill="var(--dl-ink)"
            fontFamily="var(--font-geist-mono), ui-monospace, monospace"
          >
            {formatCount(values[values.length - 1])}
          </text>
          <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--dl-ink)" strokeWidth={2} />
          {commitSeries.map((d, i) =>
            i % 10 === 0 ? (
              <text key={d.day} x={i * barW + 2} y={H - 5} fontSize={10} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
                {d.day.toLowerCase()}
              </text>
            ) : null
          )}
        </svg>
        <p className="mt-2 font-mono text-[11px] text-[var(--dl-muted)]">
          {chartStats.totalLabel}. turn crank for higher resolution (crank sold separately).
        </p>
      </div>
    </figure>
  )
}

/* --- newsletter + footer --- */

export function INewsletter() {
  return (
    <div className="dl-hardshadow border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] p-5 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--dl-muted)]">form 27-b — subscription</p>
      <h3 className="dl-pixel mt-3 text-xl font-bold text-[var(--dl-ink)] sm:text-2xl">
        THE TUESDAY BRIEFING
      </h3>
      <p className="mt-2 max-w-md font-mono text-[12.5px] leading-[1.8] text-[var(--dl-body)]">
        the repos that moved this week, why they matter, what to watch next.
        one email. no noise. unsubscribe by replying “please stop”.
      </p>
      <div className="mt-5 flex max-w-md flex-col gap-3 font-mono sm:flex-row">
        <input
          type="email"
          aria-label="Email address"
          placeholder="you@company.com"
          className="h-10 flex-1 border-2 border-[var(--dl-line)] bg-transparent px-3 text-[13px] text-[var(--dl-ink)] placeholder:text-[var(--dl-muted)] focus:outline-none"
        />
        <button
          type="button"
          className="h-10 border-2 border-[var(--dl-line)] bg-[var(--dl-accent)] px-5 text-[13px] font-bold text-[var(--dl-ink)]"
        >
          file it
        </button>
      </div>
    </div>
  )
}

export function IFooter() {
  const badges = ['no gradients', 'works in lynx', 'made with html', '1-bit certified', 'gitfind ★ 2026']
  return (
    <footer className="border-t-2 border-[var(--dl-line)]">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="border-2 border-[var(--dl-line)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--dl-ink)]"
            >
              {b}
            </span>
          ))}
        </div>
        <p className="font-mono text-[11px] text-[var(--dl-muted)]">
          mock i — sample data · <Link href="/design-lab" className="dl-invert-hover px-1">exit to design lab</Link>
        </p>
      </div>
    </footer>
  )
}

/* --- project detail (spec sheet) --- */

export function ISpecScore() {
  const tier = tierFor(featured.score)
  return (
    <div className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)]">
      <p className="border-b-2 border-[var(--dl-line)] px-4 py-2 font-mono text-[11px] text-[var(--dl-muted)]">
        fig. 02 — early signal score
      </p>
      <div className="p-4 font-mono">
        <p className="text-4xl font-bold text-[var(--dl-ink)]">
          {featured.score}
          <span className="text-lg font-normal text-[var(--dl-muted)]">/100</span>
        </p>
        <p className="mt-2 text-[15px] tracking-wider text-[var(--dl-ink)]">{gauge(featured.score, 20)}</p>
        <p className="mt-2">
          <span className="bg-[var(--dl-ink)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dl-paper)]">
            {tier}
          </span>
        </p>
        <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--dl-muted)]">
          {tierExplainer(tier).toLowerCase()}. blends star growth, builders, buzz, and commit pace. 70+ breakout · 40–69 hot · under 40 active.
        </p>
        <div className="mt-4 space-y-1.5 border-t-2 border-[var(--dl-line)] pt-3">
          {featured.breakdown.map((s) => (
            <p key={s.label} className="text-[11px] text-[var(--dl-body)]">
              {s.label.toLowerCase().padEnd(18, '\u00a0')}
              <span className="text-[var(--dl-ink)]">{gauge(s.value, 10)}</span>{' '}
              <b className="text-[var(--dl-ink)]">{s.value}</b>{' '}
              <span className="text-[var(--dl-muted)]">({s.weight}%)</span>
            </p>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[var(--dl-muted)]">measured {featured.scoredAt.toLowerCase()}</p>
      </div>
    </div>
  )
}

export function ISpecStats() {
  const rows: [string, string][] = [
    ['stars', formatCount(featured.stars)],
    ['forks', formatCount(featured.forks)],
    ['contributors', contributorsLabel(featured.contributors).toLowerCase()],
    ['language', (featured.language ?? '—').toLowerCase()],
    ['downloads (7d)', featured.downloads7d == null ? '—' : formatCount(featured.downloads7d)],
    ['7d delta', `+${featured.stars7d.toLocaleString('en-US')} (${pctLabel(featured.pct7d)} this week)`],
    ['commits (30d)', String(featured.commits30d)],
    ['category', featured.category.toLowerCase()],
  ]
  return (
    <div className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)]">
      <p className="border-b-2 border-[var(--dl-line)] px-4 py-2 font-mono text-[11px] text-[var(--dl-muted)]">
        fig. 03 — specifications
      </p>
      <dl className="p-4 font-mono">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-dashed border-[var(--dl-line)]/40 py-1.5 text-[12px] last:border-0">
            <dt className="text-[var(--dl-muted)]">{k}</dt>
            <dd className="font-bold text-[var(--dl-ink)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
