// Direction F — "BBS / ANSI"
// 90s bulletin-board energy: ASCII wordmark, double-line box frames, ANSI
// cyan/magenta/yellow on deep navy, shareware charm — with modern restraint.

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
  featured,
} from './sample-data'

const DL = '/design-lab/f'

// --- ASCII wordmark (5-row pixel glyphs) ---

const GLYPHS: Record<string, string[]> = {
  G: [' ██  ', '█    ', '█ ██ ', '█  █ ', ' ███ '],
  I: ['███', ' █ ', ' █ ', ' █ ', '███'],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  F: ['████', '█   ', '███ ', '█   ', '█   '],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  D: ['███ ', '█  █', '█  █', '█  █', '███ '],
}

function asciiWord(word: string): string {
  const rows = ['', '', '', '', '']
  for (const ch of word) {
    const g = GLYPHS[ch]
    if (!g) continue
    for (let i = 0; i < 5; i++) rows[i] += g[i] + ' '
  }
  return rows.join('\n')
}

export function FWordmark({ className = '' }: { className?: string }) {
  return (
    <pre
      aria-label="GitFind"
      className={`font-mono text-[10px] leading-[1.15] text-[var(--dl-accent)] ${className}`}
      style={{ textShadow: '0 0 10px rgba(77,227,255,0.3)' }}
    >
      {asciiWord('GITFIND')}
    </pre>
  )
}

function tierTextClass(tier: string): string {
  if (tier === 'Breakout') return 'text-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'text-[var(--dl-tier-hot)]'
  return 'text-[var(--dl-tier-active)]'
}

export function FNav() {
  return (
    <header className="border-b border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href={DL} className="flex items-center gap-2.5 font-mono">
          <span className="text-lg font-bold text-[var(--dl-magenta)]">❯</span>
          <span className="text-sm font-bold tracking-wider text-[var(--dl-text)]">GITFIND BBS</span>
        </Link>
        <nav className="hidden items-center gap-4 font-mono text-[11px] tracking-wider md:flex">
          {['MOVERS', 'FILES', 'BRIEF'].map((item, i) => (
            <span
              key={item}
              className={`cursor-pointer ${
                i === 0 ? 'text-[var(--dl-yellow)]' : 'text-[var(--dl-muted)] hover:text-[var(--dl-text)]'
              }`}
            >
              [{item}]
            </span>
          ))}
        </nav>
        <Link href="/design-lab" className="font-mono text-[11px] tracking-wider text-[var(--dl-muted)] hover:text-[var(--dl-magenta)]">
          [LOGOFF]
        </Link>
      </div>
    </header>
  )
}

export function FDivider({ label }: { label: string }) {
  return (
    <div className="mb-8 flex items-center gap-3 font-mono" aria-hidden="true">
      <span className="flex-1 border-t-2 border-[var(--dl-border)]" />
      <span className="text-sm tracking-[0.2em] text-[var(--dl-yellow)]">
        ╡ {label} ╞
      </span>
      <span className="flex-1 border-t-2 border-[var(--dl-border)]" />
    </div>
  )
}

export function FScoreBlock({ score }: { score: number }) {
  const tier = tierFor(score)
  return (
    <div
      className="shrink-0 text-right font-mono"
      title={`Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}`}
    >
      <p className="text-sm font-bold tracking-wider text-[var(--dl-yellow)]">{gauge(score)}</p>
      <p className="mt-1 text-sm font-bold text-[var(--dl-text)]">
        {score}<span className="font-normal text-[var(--dl-muted)]">/100</span>
      </p>
      <p className={`mt-0.5 text-[10px] font-bold tracking-[0.2em] ${tierTextClass(tier)}`}>
        {tier.toUpperCase()}
      </p>
    </div>
  )
}

export function FRepoCard({ repo }: { repo: SampleRepo }) {
  const positive = repo.pct7d > 0
  return (
    <article className="group flex h-full flex-col border-[3px] border-double border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 transition-colors hover:border-[var(--dl-accent)]">
      <div className="flex items-start justify-between gap-4">
        <Link href={`${DL}/project`} className="min-w-0 font-mono">
          <h3 className="truncate text-[15px] font-bold text-[var(--dl-text)] group-hover:text-[var(--dl-accent-strong)]">
            <span className="font-normal text-[var(--dl-muted)]">{repo.owner}/</span>
            {repo.name}
          </h3>
        </Link>
        <FScoreBlock score={repo.score} />
      </div>

      <p className="mt-3 font-mono text-[12.5px] leading-[1.75] text-[var(--dl-body)] line-clamp-3">
        {repo.summary}
      </p>

      <div className="mt-4 border-t border-[var(--dl-border)] pt-3 font-mono">
        <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-magenta)]">※ WHY IT MATTERS</p>
        <p className="mt-1.5 text-[12.5px] leading-[1.7] text-[var(--dl-muted)] line-clamp-2">
          {repo.whyItMatters}
        </p>
      </div>

      <div className="mt-auto pt-5 font-mono">
        <p className={`text-[11px] font-bold tracking-wide ${positive ? 'text-[var(--dl-positive)]' : 'text-[var(--dl-negative)]'}`}>
          {positive ? '▲' : '▼'} {pctLabel(repo.pct7d)} THIS WEEK
          <span className="ml-2 font-normal text-[var(--dl-muted)]">(+{formatCount(repo.stars7d)}★)</span>
        </p>
        <p className="mt-2 text-[10.5px] tracking-wider text-[var(--dl-muted)]">
          {formatCount(repo.stars)}★ · {formatCount(repo.forks)}⑂ ·{' '}
          {repo.contributors === 0 ? 'SOLO DEV' : `${contributorsLabel(repo.contributors)} DEVS`}
          {repo.language ? ` · ${repo.language.toUpperCase()}` : ''}
        </p>
      </div>
    </article>
  )
}

export function FChart() {
  const W = 720
  const H = 200
  const padTop = 10
  const padBottom = 22
  const values = commitSeries.map((d) => d.commits)
  const max = Math.max(...values)
  const barW = W / values.length
  return (
    <div className="border-[3px] border-double border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 font-mono">
        <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-accent)]">
          ※ CLAUDE CODE COMMITS — DAILY
        </p>
        <p className="text-[11px] text-[var(--dl-muted)]">
          <span className="font-bold text-[var(--dl-magenta)]">{formatCount(chartStats.latest)}</span>{' '}
          {chartStats.deltaLabel}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Bar chart of daily Claude Code commits over the last 30 days, trending upward">
        {values.map((v, i) => {
          const h = (v / max) * (H - padTop - padBottom)
          const isLast = i === values.length - 1
          return (
            <rect
              key={commitSeries[i].day}
              x={i * barW + 1.5}
              y={H - padBottom - h}
              width={barW - 3}
              height={h}
              fill={isLast ? 'var(--dl-magenta)' : 'var(--dl-accent)'}
              opacity={isLast ? 1 : 0.45 + (v / max) * 0.4}
            />
          )
        })}
        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--dl-border)" strokeWidth={2} />
        {commitSeries.map((d, i) =>
          i % 6 === 0 ? (
            <text key={d.day} x={i * barW + 2} y={H - 6} fontSize={10} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
              {d.day}
            </text>
          ) : null
        )}
      </svg>
      <p className="mt-3 font-mono text-[10px] tracking-wider text-[var(--dl-muted)]">
        {chartStats.totalLabel.toUpperCase()} · PUBLIC GITHUB
      </p>
    </div>
  )
}

export function FNewsletter() {
  return (
    <div className="border-[3px] border-double border-[var(--dl-yellow)]/60 bg-[var(--dl-surface)] p-6 text-center sm:p-10">
      <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-[var(--dl-yellow)]">
        ※ REGISTRATION FORM ※
      </p>
      <h3 className="mt-4 font-mono text-xl font-bold tracking-tight text-[var(--dl-text)] sm:text-2xl">
        REGISTER YOUR COPY OF <span className="text-[var(--dl-magenta)]">GITFIND</span>
      </h3>
      <p className="mx-auto mt-3 max-w-md font-mono text-[12.5px] leading-[1.8] text-[var(--dl-muted)]">
        Enter your e-mail address to receive THE TUESDAY BRIEFING — the repos that
        moved this week, why they matter, what to watch next. One email. No noise.
      </p>
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 font-mono sm:flex-row">
        <div className="flex h-11 flex-1 items-center gap-2 border border-[var(--dl-border)] bg-[var(--dl-bg)] px-3 focus-within:border-[var(--dl-accent)]">
          <span className="text-[11px] tracking-wider text-[var(--dl-accent)]">E-MAIL:</span>
          <input
            type="email"
            aria-label="Email address"
            placeholder="YOU@COMPANY.COM"
            className="w-full bg-transparent text-[12px] tracking-wide text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:outline-none"
          />
        </div>
        <button
          type="button"
          className="h-11 border border-[var(--dl-yellow)] bg-[var(--dl-yellow)]/10 px-5 font-mono text-[12px] font-bold tracking-wider text-[var(--dl-yellow)] transition-colors hover:bg-[var(--dl-yellow)] hover:text-[#1a1a00]"
        >
          [REGISTER]
        </button>
      </div>
    </div>
  )
}

export function FFooter() {
  return (
    <footer className="border-t border-[var(--dl-border)] bg-[var(--dl-surface)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[10px] tracking-wider text-[var(--dl-muted)] sm:px-6">
        <p>(C) 2026 GITFIND BBS · SYSOP: TEAM GITFIND</p>
        <p>
          MOCK F — SAMPLE DATA ·{' '}
          <Link href="/design-lab" className="hover:text-[var(--dl-magenta)]">[LOGOFF TO DESIGN LAB]</Link>
        </p>
      </div>
    </footer>
  )
}

// --- Project detail pieces ---

export function FScorePanel() {
  const tier = tierFor(featured.score)
  return (
    <div className="border-[3px] border-double border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 font-mono">
      <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-accent)]">※ EARLY SIGNAL SCORE</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-5xl font-bold text-[var(--dl-text)]">
          {featured.score}
          <span className="text-xl font-normal text-[var(--dl-muted)]">/100</span>
        </p>
        <p className={`text-[11px] font-bold tracking-[0.2em] ${tierTextClass(tier)}`} title={tierExplainer(tier)}>
          {tier.toUpperCase()}
        </p>
      </div>
      <p className="mt-2 text-lg tracking-wider text-[var(--dl-yellow)]">{gauge(featured.score, 20)}</p>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--dl-muted)]">
        {tierExplainer(tier)}. {SCORE_EXPLAINER}
      </p>
      <div className="mt-5 space-y-2 border-t border-[var(--dl-border)] pt-4">
        {featured.breakdown.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[10.5px]">
            <span className="w-32 shrink-0 text-[var(--dl-muted)]">
              {s.label.toUpperCase()} <span className="text-[var(--dl-border)]">·{s.weight}%</span>
            </span>
            <span className="flex-1 tracking-wider text-[var(--dl-yellow)]/80">{gauge(s.value, 12)}</span>
            <span className="w-7 text-right text-[var(--dl-text)]">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] tracking-wider text-[var(--dl-muted)]">UPDATED {featured.scoredAt.toUpperCase()}</p>
    </div>
  )
}

export function FStatsPanel() {
  const rows: { label: string; value: string }[] = [
    { label: 'STARS', value: formatCount(featured.stars) },
    { label: 'FORKS', value: formatCount(featured.forks) },
    { label: 'CONTRIBUTORS', value: contributorsLabel(featured.contributors).toUpperCase() },
    { label: 'LANGUAGE', value: (featured.language ?? '—').toUpperCase() },
    { label: 'DOWNLOADS 7D', value: featured.downloads7d == null ? '—' : formatCount(featured.downloads7d) },
    { label: 'CATEGORY', value: featured.category.toUpperCase() },
  ]
  return (
    <div className="border-[3px] border-double border-[var(--dl-border)] bg-[var(--dl-surface)] p-5 font-mono">
      <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-accent)]">※ FILE STATS</p>
      <dl className="mt-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between border-b border-[var(--dl-border)]/60 py-2 last:border-0">
            <dt className="text-[11px] text-[var(--dl-muted)]">{r.label}</dt>
            <dd className="text-[12px] font-bold text-[var(--dl-text)]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
