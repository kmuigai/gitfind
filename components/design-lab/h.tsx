// Direction H — "GITFIND/95"
// A full desktop OS: teal desktop, icons, beveled windows with title bars and
// menus, an Explorer details view, a Notepad README, a Properties dialog.
// DNA: poolsuite.net bevel recipe, exact Win95 palette, segmented progress bars.

import Link from 'next/link'
import {
  SampleRepo,
  commitSeries,
  contributorsLabel,
  formatCount,
  pctLabel,
  tierFor,
  tierExplainer,
  SCORE_EXPLAINER,
  featured,
} from './sample-data'

const DL = '/design-lab/h'

const UI_FONT = 'font-[Tahoma,_Verdana,_Geneva,sans-serif]'

function tierTextClass(tier: string): string {
  if (tier === 'Breakout') return 'text-[var(--dl-tier-breakout)]'
  if (tier === 'Hot') return 'text-[var(--dl-tier-hot)]'
  return 'text-[var(--dl-tier-active)]'
}

/* --- Window chrome --- */

export function HWindow({
  title,
  menu = ['File', 'Edit', 'View', 'Help'],
  status,
  children,
  className = '',
}: {
  title: string
  menu?: string[]
  status?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`dl-bevel p-[3px] ${className}`}>
      {/* Title bar */}
      <div className="flex h-7 items-center gap-2 bg-gradient-to-r from-[var(--dl-titlebar)] to-[var(--dl-titlebar-2)] px-2">
        <span className="text-[11px] font-bold text-white">{title}</span>
        <span className="ml-auto flex gap-[2px]">
          {['_', '▢', '×'].map((g) => (
            <span
              key={g}
              className="dl-bevel-thin flex h-4 w-4 cursor-default items-center justify-center text-[9px] font-bold leading-none text-black"
            >
              {g}
            </span>
          ))}
        </span>
      </div>
      {/* Menu bar */}
      <div className={`flex items-center gap-4 px-2 py-1 text-[12px] text-black ${UI_FONT}`}>
        {menu.map((m) => (
          <span key={m} className="cursor-default">
            <span className="underline">{m[0]}</span>
            {m.slice(1)}
          </span>
        ))}
      </div>
      {/* Content */}
      <div className="mx-[2px] mb-[2px]">{children}</div>
      {/* Status bar */}
      {status ? (
        <div className="flex gap-[2px] px-[2px] pb-[1px] pt-[2px]">
          <span className="dl-bevel-sunken flex-1 px-2 py-[2px] text-[11px] text-[var(--dl-body)]">{status}</span>
          <span className="dl-bevel-sunken px-2 py-[2px] text-[11px] text-[var(--dl-body)]">NUM</span>
        </div>
      ) : null}
    </div>
  )
}

export function HButton({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      className={`dl-bevel-thin px-4 py-1 text-[12px] text-black active:shadow-[2px_2px_0_0_#808080_inset,-1px_-1px_0_0_#ffffff_inset] ${UI_FONT} ${
        primary ? 'font-bold outline outline-1 outline-black outline-offset-[-3px]' : ''
      }`}
    >
      {children}
    </button>
  )
}

/* --- Segmented Win95-style progress bar --- */

export function HProgress({ value, segments = 12 }: { value: number; segments?: number }) {
  const filled = Math.round((value / 100) * segments)
  return (
    <span className="dl-bevel-sunken inline-flex items-center gap-[2px] px-[3px] py-[3px]" role="img" aria-label={`${value} out of 100`}>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={`h-3 w-[7px] ${i < filled ? 'bg-[var(--dl-progress)]' : 'bg-transparent'}`}
        />
      ))}
    </span>
  )
}

/* --- Desktop icons + taskbar --- */

function HIcon({ glyph, label, href }: { glyph: string; label: string; href?: string }) {
  const inner = (
    <>
      <span className="text-[28px] leading-none [text-shadow:1px_1px_0_rgba(0,0,0,0.4)]">{glyph}</span>
      <span className="mt-1 max-w-[72px] text-center text-[11px] leading-tight text-white [text-shadow:1px_1px_0_#000]">
        {label}
      </span>
    </>
  )
  const cls = 'flex w-[76px] cursor-default flex-col items-center'
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

export function HDesktop({ children }: { children: React.ReactNode }) {
  return (
    <div className={`dl-h min-h-screen bg-[var(--dl-desktop)] pb-14 ${UI_FONT}`}>
      <style>{'body { background: #007f7f; }'}</style>
      <div className="flex flex-col gap-5 p-4 sm:flex-row">
        <div className="flex shrink-0 flex-row gap-4 sm:flex-col">
          <HIcon glyph="▣" label="My Repos" />
          <HIcon glyph="◫" label="hype.exe" />
          <HIcon glyph="◼" label="Design Lab" href="/design-lab" />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {/* Taskbar */}
      <div className="dl-bevel fixed inset-x-0 bottom-0 z-40 flex h-10 items-center gap-2 px-2">
        <span className="dl-bevel-thin flex h-7 cursor-default items-center gap-1.5 px-3 text-[12px] font-bold text-black">
          <span className="text-[#000080]">❯</span> Start
        </span>
        <span className="dl-bevel-pressed hidden h-7 items-center px-3 text-[12px] text-black sm:flex">
          TRENDING.EXE
        </span>
        <span className="dl-bevel-sunken ml-auto flex h-7 items-center px-3 text-[12px] text-black">
          9:41 AM
        </span>
      </div>
    </div>
  )
}

/* --- Explorer details view (repo list) --- */

export function HExplorerRows({ items }: { items: SampleRepo[] }) {
  const cols = 'grid-cols-[1fr_150px_130px_70px] lg:grid-cols-[1fr_170px_140px_80px_90px_110px]'
  return (
    <div className="dl-bevel-sunken overflow-x-auto">
      <div className={`grid ${cols} items-center gap-2 border-b border-[#808080] px-2 py-1 text-[11px] font-bold text-black`}>
        <span>Name</span>
        <span title={SCORE_EXPLAINER}>Score /100</span>
        <span>Δ Stars 1W</span>
        <span className="text-right">Stars</span>
        <span className="hidden lg:inline">Language</span>
        <span className="hidden lg:inline">Contributors</span>
      </div>
      <ul>
        {items.map((r) => {
          const tier = tierFor(r.score)
          return (
            <li key={`${r.owner}/${r.name}`}>
              <Link
                href={`${DL}/project`}
                className={`grid ${cols} items-center gap-2 border-b border-[#e0e0e0] px-2 py-[5px] text-[12px] text-[var(--dl-body)] hover:bg-[var(--dl-titlebar)] hover:text-white`}
              >
                <span className="truncate font-bold">{r.owner}/{r.name}</span>
                <span className="flex items-center gap-1.5" title={`Early Signal Score: ${r.score}/100 — ${tier}. ${tierExplainer(tier)}`}>
                  <HProgress value={r.score} segments={8} />
                  <span className={`font-bold ${tierTextClass(tier)}`}>{r.score}</span>
                </span>
                <span className={r.pct7d > 0 ? 'font-bold text-[var(--dl-positive)]' : 'font-bold text-[var(--dl-negative)]'}>
                  {pctLabel(r.pct7d)} this wk
                </span>
                <span className="text-right tabular-nums">{formatCount(r.stars)}</span>
                <span className="hidden lg:inline">{r.language ?? '—'}</span>
                <span className="hidden lg:inline">
                  {r.contributors === 0 ? 'Solo' : contributorsLabel(r.contributors)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* --- PLOT.EXE chart --- */

export function HPlot() {
  const values = commitSeries.map((d) => d.commits)
  const max = Math.max(...values)
  const W = 560
  const H = 170
  const padBottom = 18
  const barW = W / values.length
  return (
    <div className="dl-bevel-sunken p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart of daily Claude Code commits over the last 30 days, trending upward">
        {values.map((v, i) => {
          const h = (v / max) * (H - padBottom - 6)
          return (
            <rect
              key={commitSeries[i].day}
              x={i * barW + 1}
              y={H - padBottom - h}
              width={barW - 2}
              height={h}
              fill="var(--dl-progress)"
            />
          )
        })}
        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="#000" strokeWidth={1} />
        {commitSeries.map((d, i) =>
          i % 10 === 0 ? (
            <text key={d.day} x={i * barW + 2} y={H - 4} fontSize={9} fill="#000" fontFamily="Tahoma, Verdana, sans-serif">
              {d.day}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}

/* --- Newsletter dialog --- */

export function HSubscribeDialog() {
  return (
    <HWindow title="Tuesday Briefing — Subscribe" menu={[]} className="max-w-md">
      <div className="flex gap-3 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dl-titlebar)] text-lg font-bold text-white">
          i
        </span>
        <div className="min-w-0">
          <p className="text-[12px] leading-relaxed text-black">
            The repos that moved this week, why they matter, and what to watch next.
            One email every Tuesday. No noise.
          </p>
          <input
            type="email"
            aria-label="Email address"
            placeholder="you@company.com"
            className="dl-bevel-sunken mt-3 h-7 w-full px-2 text-[12px] text-black placeholder:text-[#808080] focus:outline-none"
          />
          <div className="mt-4 flex justify-end gap-2">
            <HButton primary>OK</HButton>
            <HButton>Cancel</HButton>
          </div>
        </div>
      </div>
    </HWindow>
  )
}

/* --- Properties dialog (project page) --- */

export function HProperties() {
  const tier = tierFor(featured.score)
  return (
    <HWindow title="superpowers Properties" menu={[]} className="max-w-md">
      {/* Tab strip */}
      <div className="flex gap-[2px] px-2 pt-1">
        {['General', 'Score', 'Stats'].map((t, i) => (
          <span
            key={t}
            className={`dl-bevel-thin cursor-default px-3 py-1 text-[12px] text-black ${
              i === 1 ? 'relative z-10 -mb-[2px] pb-[6px] font-bold' : ''
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="dl-bevel-thin relative m-2 mt-0 bg-[var(--dl-chrome)] p-4">
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-bold text-black">
            Early Signal Score: {featured.score}/100
          </p>
          <p className={`text-[11px] font-bold uppercase ${tierTextClass(tier)}`}>{tier}</p>
        </div>
        <div className="mt-2">
          <HProgress value={featured.score} segments={20} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--dl-body)]">
          {tierExplainer(tier)}. {SCORE_EXPLAINER}
        </p>

        <div className="mt-4 space-y-2 border-t border-[#808080] pt-3">
          {featured.breakdown.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-[11px] text-black">
              <span className="w-28 shrink-0">{s.label} ({s.weight}%)</span>
              <HProgress value={s.value} segments={10} />
              <span className="w-6 text-right font-bold">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[#808080] pt-3 text-[11px] text-black">
          <span>Stars: <b>{formatCount(featured.stars)}</b></span>
          <span>Forks: <b>{formatCount(featured.forks)}</b></span>
          <span>Contributors: <b>{contributorsLabel(featured.contributors)}</b></span>
          <span>Language: <b>{featured.language ?? '—'}</b></span>
          <span>Downloads (7d): <b>{featured.downloads7d == null ? '—' : formatCount(featured.downloads7d)}</b></span>
          <span>Updated: <b>{featured.scoredAt}</b></span>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <HButton primary>OK</HButton>
          <HButton>Apply</HButton>
        </div>
      </div>
    </HWindow>
  )
}
