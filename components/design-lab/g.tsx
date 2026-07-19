// Direction G — "Scrollback"
// The entire page is one terminal window showing a live session: boot log,
// commands, aligned-column output, ASCII plot, and a man page for projects.
// DNA: ghostty.org window chrome, windows93 boot log, One Dark data colors.

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

const DL = '/design-lab/g'

function tierVar(tier: string): string {
  if (tier === 'Breakout') return 'var(--dl-tier-breakout)'
  if (tier === 'Hot') return 'var(--dl-tier-hot)'
  return 'var(--dl-tier-active)'
}

/* --- Window chrome --- */

export function GWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-[var(--dl-border)] bg-[var(--dl-window)] shadow-[0_0_80px_rgba(152,195,121,0.07)]">
      <div className="flex h-9 items-center gap-2 border-b border-[var(--dl-border)] bg-[var(--dl-chrome)] px-3.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto font-mono text-[11px] text-[var(--dl-muted)]">{title}</span>
        <Link
          href="/design-lab"
          className="font-mono text-[11px] text-[var(--dl-muted)] hover:text-[var(--dl-text)]"
          title="Back to the design lab"
        >
          logout
        </Link>
      </div>
      <div className="px-4 py-5 font-mono text-[13px] leading-[1.75] sm:px-6">{children}</div>
    </div>
  )
}

export function GPrompt({ cmd, path = '~' }: { cmd: string; path?: string }) {
  return (
    <p className="mt-8 first:mt-0">
      <span className="text-[var(--dl-accent)]">kayu@gitfind</span>
      <span className="text-[var(--dl-muted)]">:</span>
      <span className="text-[var(--dl-cyan)]">{path}</span>
      <span className="text-[var(--dl-muted)]">$ </span>
      <span className="font-bold text-[var(--dl-text)]">{cmd}</span>
    </p>
  )
}

export function GComment({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[var(--dl-muted)]"># {children}</p>
}

/* --- Boot log --- */

export function GBoot() {
  return (
    <div className="text-[12px] leading-[1.8] text-[var(--dl-muted)]">
      <p className="dl-boot-1">GITFIND BIOS v3.1.3 — checking signal feeds ......... <span className="text-[var(--dl-accent)]">OK</span></p>
      <p className="dl-boot-2">indexing 2,847 repositories (0.38s) ............... <span className="text-[var(--dl-accent)]">OK</span></p>
      <p className="dl-boot-3">translation engine ready <span className="dl-blink text-[var(--dl-accent)]">█</span></p>
    </div>
  )
}

/* --- Banner hero --- */

export function GBanner() {
  return (
    <div className="mt-3">
      <h1 className="dl-vt323 text-5xl leading-[0.95] tracking-wide text-[var(--dl-text)] sm:text-7xl">
        GITHUB,<br />
        <span className="text-[var(--dl-accent)]">TRANSLATED.</span>
      </h1>
      <p className="mt-4 max-w-xl text-[13px] text-[var(--dl-body)]">
        the rising open-source projects that matter — explained in plain english,
        before everyone else sees them.
      </p>
      <p className="mt-2 text-[12px] text-[var(--dl-muted)]">
        updated daily · 2,847 repos tracked · week 29
      </p>
    </div>
  )
}

/* --- Trending table (aligned transcript columns) --- */

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

export function GTrendingTable({ items }: { items: SampleRepo[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <pre className="min-w-[560px] text-[12px] leading-[1.9]">
        <span className="text-[var(--dl-muted)]">
          {pad('REPO', 29)}{pad('SCORE', 22)}{pad('Δ STARS 1W', 16)}{pad('STARS', 9)}LANG
          {'\n'}
        </span>
        {items.map((r) => {
          const tier = tierFor(r.score)
          const name = `${r.owner}/${r.name}`
          const gain = `${r.pct7d > 0 ? '+' : ''}${pctLabel(r.pct7d)} this wk`
          return (
            <span key={name} className="block">
              <Link href={`${DL}/project`} className="text-[var(--dl-text)] hover:bg-[var(--dl-border)] hover:text-[var(--dl-accent)]">
                {pad(name, 29)}
              </Link>
              <span style={{ color: tierVar(tier) }} title={`Early Signal Score: ${r.score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}>
                {pad(`${r.score}/100 ${gauge(r.score)}`, 22)}
              </span>
              <span className={r.pct7d > 0 ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}>
                {pad(gain, 16)}
              </span>
              <span className="text-[var(--dl-body)]">{pad(formatCount(r.stars), 9)}</span>
              <span className="text-[var(--dl-cyan)]">{r.language ?? '—'}</span>
              {'\n'}
            </span>
          )
        })}
      </pre>
      <p className="mt-1 text-[11px] text-[var(--dl-muted)]">
        6 rows · sorted by early signal score · score /100 blends star growth, builders, buzz, commit pace
      </p>
    </div>
  )
}

/* --- ASCII plot --- */

export function GPlot() {
  const values = commitSeries.map((d) => d.commits)
  const max = Math.max(...values)
  const ROWS = 7
  const heights = values.map((v) => Math.max(1, Math.round((v / max) * ROWS)))
  const lines: string[] = []
  for (let level = ROWS; level >= 1; level--) {
    let line = ''
    for (const h of heights) line += h >= level ? '█' : ' '
    lines.push(line)
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <pre className="text-[12px] leading-[1.3]">
        <span className="text-[var(--dl-muted)]">{formatCount(max)} ┤ </span>
        <span className="text-[var(--dl-accent)]">{lines[0]}</span>
        {'\n'}
        {lines.slice(1).map((l, i) => (
          <span key={i} className="block">
            <span className="text-[var(--dl-muted)]">{'     │ '}</span>
            <span className="text-[var(--dl-accent)]">{l}</span>
            {'\n'}
          </span>
        ))}
        <span className="text-[var(--dl-muted)]">
          {'     └'}{'─'.repeat(32)}
          {'\n      '}
          {commitSeries[0].day}
          {' '.repeat(11)}
          {commitSeries[14].day}
          {' '.repeat(9)}
          {commitSeries[29].day}
          {'\n'}
        </span>
      </pre>
      <p className="mt-1 text-[11px] text-[var(--dl-muted)]">
        {chartStats.totalLabel} · <span className="text-[var(--dl-positive)]">{chartStats.deltaLabel}</span> · latest {formatCount(chartStats.latest)}
      </p>
    </div>
  )
}

/* --- Subscribe --- */

export function GSubscribe() {
  return (
    <div className="mt-3">
      <p className="text-[var(--dl-body)]">
        the tuesday briefing — the repos that moved, why they matter, what to watch next.
      </p>
      <div className="mt-3 flex max-w-md items-center gap-2">
        <span className="shrink-0 text-[var(--dl-yellow)]">enter email:</span>
        <input
          type="email"
          aria-label="Email address"
          placeholder="you@company.com"
          className="w-full border-b border-[var(--dl-border)] bg-transparent pb-1 font-mono text-[13px] text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:border-[var(--dl-accent)] focus:outline-none"
        />
        <button
          type="button"
          className="shrink-0 border border-[var(--dl-accent)] px-3 py-1 font-mono text-[12px] font-bold text-[var(--dl-accent)] transition-colors hover:bg-[var(--dl-accent)] hover:text-[var(--dl-window)]"
        >
          [ok]
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[var(--dl-muted)]">one email per week · unsubscribe with ctrl-c anytime</p>
    </div>
  )
}

/* --- Man page (project detail) --- */

export function GManSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-bold tracking-wide text-[var(--dl-text)] underline decoration-[var(--dl-border)] underline-offset-4">
        {title}
      </h2>
      <div className="mt-2 pl-0 sm:pl-7">{children}</div>
    </section>
  )
}

export function GManHeader() {
  return (
    <div className="text-[var(--dl-body)]">
      <div className="flex justify-between gap-2 text-[12px] font-bold text-[var(--dl-text)]">
        <span>SUPERPOWERS(1)</span>
        <span className="hidden sm:inline">GitFind User Commands</span>
        <span>SUPERPOWERS(1)</span>
      </div>
    </div>
  )
}

export function GManFooter() {
  return (
    <div className="mt-8 flex justify-between gap-2 border-t border-[var(--dl-border)] pt-3 text-[12px] text-[var(--dl-muted)]">
      <span>GitFind</span>
      <span className="hidden sm:inline">July 2026</span>
      <span>SUPERPOWERS(1)</span>
    </div>
  )
}

export function GManScore() {
  const tier = tierFor(featured.score)
  return (
    <div>
      <p>
        <span className="font-bold text-[var(--dl-text)]">{featured.score}/100 </span>
        <span style={{ color: tierVar(tier) }}>{gauge(featured.score, 16)} {tier.toUpperCase()}</span>
      </p>
      <p className="mt-1 text-[var(--dl-body)]">
        {tierExplainer(tier)}. {SCORE_EXPLAINER}
      </p>
      <div className="mt-3">
        {featured.breakdown.map((s) => (
          <p key={s.label} className="text-[var(--dl-body)]">
            <span className="text-[var(--dl-muted)]">
              {s.label.toLowerCase()} {'.'.repeat(Math.max(2, 18 - s.label.length))}{' '}
            </span>
            <span style={{ color: tierVar(tier) }}>{gauge(s.value, 10)}</span>{' '}
            <span className="text-[var(--dl-text)]">{s.value}</span>{' '}
            <span className="text-[var(--dl-muted)]">({s.weight}%)</span>
          </p>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--dl-muted)]">score updated {featured.scoredAt}</p>
    </div>
  )
}

export function GManStats() {
  const rows: [string, string][] = [
    ['stars', formatCount(featured.stars)],
    ['forks', formatCount(featured.forks)],
    ['contributors', contributorsLabel(featured.contributors).toLowerCase()],
    ['language', (featured.language ?? '—').toLowerCase()],
    ['downloads (7d)', featured.downloads7d == null ? '—' : formatCount(featured.downloads7d)],
    ['category', featured.category.toLowerCase()],
    ['7d delta', `+${featured.stars7d.toLocaleString('en-US')} (${pctLabel(featured.pct7d)} this week)`],
    ['commits (30d)', String(featured.commits30d)],
  ]
  return (
    <div>
      {rows.map(([k, v]) => (
        <p key={k} className="text-[var(--dl-body)]">
          <span className="text-[var(--dl-muted)]">{k.padEnd(18, ' ')}</span>
          <span className="text-[var(--dl-text)]">{v}</span>
        </p>
      ))}
    </div>
  )
}

export function GSeeAlso() {
  return (
    <p className="text-[var(--dl-body)]">
      {repos.slice(1, 5).map((r, i) => (
        <span key={r.name}>
          <Link href={`${DL}/project`} className="text-[var(--dl-cyan)] underline decoration-[var(--dl-border)] underline-offset-4 hover:text-[var(--dl-text)]">
            {r.name}(1)
          </Link>
          {i < 3 ? ', ' : ''}
        </span>
      ))}
    </p>
  )
}
