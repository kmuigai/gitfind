// The sports card ("scouting card") — shared by the bubble race (/insights/race)
// and the universe hero (homepage). Pure presentation: the parent owns
// selection state, week context, and positioning.

import Link from 'next/link'
import { formatCount, gauge, tierFor, categorySlug, truncateAtWord } from '@/lib/design'
import { sparklineFor, type BubbleFrame, type BubbleProfile } from '@/lib/bubble'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

export interface ScoutingCardProps {
  repoKey: string // "owner/name"
  profile: BubbleProfile
  weekEntry: { stars7d: number; stars: number; forks: number } | undefined
  rank: number | null // rank in the current week's frame, null when absent
  frames: BubbleFrame[]
  currentIdx: number
  onClose: () => void
}

export default function ScoutingCard({
  repoKey,
  profile,
  weekEntry,
  rank,
  frames,
  currentIdx,
  onClose,
}: ScoutingCardProps) {
  return (
    <div className="border-2 border-[var(--line)] bg-[var(--paper)] sm:shadow-[5px_5px_0_var(--ink)]">
      {/* Card header */}
      <div className="flex items-start justify-between gap-2 border-b-2 border-[var(--line)] px-3 py-2">
        <p className="min-w-0 truncate font-mono text-[13px] font-bold text-[var(--ink)]">
          <span className="font-normal text-[var(--muted)]">{repoKey.split('/')[0]}/</span>
          {repoKey.split('/')[1]}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 border-2 border-[var(--line)] px-1.5 font-mono text-[11px] font-bold leading-5 text-[var(--ink)] invert-hover"
          aria-label="Close card"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-3">
        {/* Chips: category · tier · this week's rank */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold">
          {profile.category && (
            <Link
              href={`/category/${categorySlug(profile.category)}`}
              className="border-2 border-[var(--line)] px-1.5 py-0.5 text-[var(--body)] invert-hover"
            >
              {profile.category.toLowerCase()}
            </Link>
          )}
          <span className="border-2 border-[var(--line)] bg-[var(--accent)] px-1.5 py-0.5 text-[var(--ink)]">
            {tierFor(profile.score).toLowerCase()}
          </span>
          <span className="border-2 border-dashed border-[var(--line-soft)] px-1.5 py-0.5 text-[var(--muted)]">
            {rank ? `#${rank} this week` : 'not in top 10 this week'}
          </span>
        </div>

        {/* Score */}
        <p className="mt-3 font-mono text-[12px] text-[var(--muted)]">
          <b className="font-display text-xl text-[var(--ink)]">{profile.score}</b>
          <span className="text-[var(--muted)]"> /100 · early signal</span>
        </p>
        <p className="mt-0.5 font-mono text-[13px] tracking-wider text-[var(--ink)]" aria-hidden="true">
          {gauge(profile.score)}
        </p>

        {/* Story — the full "why it matters" lives on the project page */}
        {profile.summary && (
          <p className="mt-3 font-mono text-[12px] leading-[1.7] text-[var(--body)]">
            {truncateAtWord(profile.summary, 120)}
          </p>
        )}

        {/* This week's numbers */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono">
          {[
            { label: 'this week', value: weekEntry ? `+${formatCount(weekEntry.stars7d)}` : '—' },
            { label: 'total', value: weekEntry ? formatCount(weekEntry.stars) : '—' },
            { label: 'forks', value: weekEntry ? formatCount(weekEntry.forks) : '—' },
          ].map((s) => (
            <div key={s.label} className="border-2 border-[var(--line)] px-1 py-1.5">
              <p className="text-[13px] font-bold text-[var(--ink)]">{s.value}</p>
              <p className="text-[9.5px] text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sparkline: weekly gains across all frames */}
        <Sparkline frames={frames} repoKey={repoKey} currentIdx={currentIdx} />

        {/* CTAs */}
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] font-bold">
          <Link
            href={`/project/${repoKey}`}
            className="flex-1 border-2 border-[var(--line)] bg-[var(--ink)] px-2.5 py-1.5 text-center text-[var(--paper)] invert-hover"
          >
            full scouting report →
          </Link>
          {profile.url && (
            <a
              href={profile.url}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5 text-[var(--ink)] invert-hover"
            >
              github ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/** Weekly star gains for one repo across all frames; current week in accent. */
function Sparkline({ frames, repoKey, currentIdx }: { frames: BubbleFrame[]; repoKey: string; currentIdx: number }) {
  const values = sparklineFor(frames, repoKey)
  const max = Math.max(1, ...values.map((v) => v ?? 0))
  const W = 260
  const H = 44
  const bw = W / values.length

  return (
    <div className="mt-3">
      <p className="font-mono text-[9.5px] text-[var(--muted)]">weekly gains, {values.length} weeks</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label="Weekly star gains history">
        {values.map((v, i) => {
          if (v == null) return null
          const h = Math.max((v / max) * (H - 10), 1.5)
          const isCurrent = i === currentIdx
          return (
            <rect
              key={i}
              x={i * bw + 1}
              y={H - 6 - h}
              width={Math.max(bw - 2, 1)}
              height={h}
              fill={isCurrent ? 'var(--accent)' : 'var(--ink)'}
              stroke={isCurrent ? 'var(--ink)' : 'none'}
              strokeWidth={isCurrent ? 1.5 : 0}
            >
              <title>{`${shortDate(frames[i].date)} — +${formatCount(v)}`}</title>
            </rect>
          )
        })}
        <line x1={0} x2={W} y1={H - 6} y2={H - 6} stroke="var(--ink)" strokeWidth={1.5} />
      </svg>
    </div>
  )
}
