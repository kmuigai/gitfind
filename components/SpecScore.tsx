// Spec-sheet score panel ("fig. 02") — the Early Signal Score with full context:
// /100 numeral, tier chip, one-line explainer, methodology link, per-signal
// gauges with weights, and evidence popovers with the raw inputs behind each
// signal. Manipulation penalty shown when present, with its own evidence.

import Link from 'next/link'
import { gauge, tierFor, tierExplainer, SCORE_EXPLAINER, formatCount } from '@/lib/design'
import Evidence from '@/components/Evidence'
import type { RepoEvidence } from '@/lib/queries'

export interface SpecScoreBreakdown {
  star_velocity_score: number
  contributor_ratio_score: number
  fork_velocity_score: number
  mention_velocity_score: number
  commit_frequency_score: number
  star_acceleration_score?: number
  fork_acceleration_score?: number
  manipulation_penalty: number
}

type EvidenceBundle = RepoEvidence & { contributors: number }

const SIGNALS: { key: keyof SpecScoreBreakdown; label: string; weight: number }[] = [
  { key: 'star_velocity_score', label: 'star growth', weight: 25 },
  { key: 'contributor_ratio_score', label: 'active builders', weight: 20 },
  { key: 'mention_velocity_score', label: 'community buzz', weight: 15 },
  { key: 'commit_frequency_score', label: 'commit pace', weight: 10 },
  { key: 'fork_velocity_score', label: 'fork activity', weight: 10 },
  { key: 'star_acceleration_score', label: 'star momentum', weight: 10 },
  { key: 'fork_acceleration_score', label: 'fork momentum', weight: 10 },
]

function evidenceFor(key: keyof SpecScoreBreakdown, ev: EvidenceBundle): string {
  switch (key) {
    case 'star_velocity_score':
      return `+${formatCount(ev.stars_7d)} stars this week${ev.stars_7d_prev != null ? ` · ${formatCount(ev.stars_7d_prev)} the week before` : ''}`
    case 'contributor_ratio_score':
      return `${formatCount(ev.contributors)} contributors on record`
    case 'mention_velocity_score':
      return 'measured across hacker news, reddit, and github discussions'
    case 'commit_frequency_score':
      return `${formatCount(ev.commits_30d)} commits in the last 30 days`
    case 'fork_velocity_score':
      return ev.forks_7d != null ? `+${formatCount(ev.forks_7d)} forks this week` : 'fork snapshot pending'
    case 'star_acceleration_score':
      return `${formatCount(ev.stars_7d)}/wk this week vs ${formatCount(ev.stars_7d_prev ?? 0)}/wk last week`
    case 'fork_acceleration_score':
      return `${formatCount(ev.forks_7d ?? 0)}/wk this week vs ${formatCount(ev.forks_7d_prev ?? 0)}/wk last week`
    default:
      return ''
  }
}

function tierChipClass(tier: string): string {
  if (tier === 'Breakout') return 'bg-[var(--tier-breakout)]'
  if (tier === 'Hot') return 'bg-[var(--tier-hot)]'
  return 'bg-[var(--tier-active)]'
}

export default function SpecScore({
  score,
  breakdown,
  scoredAt,
  evidence,
}: {
  score: number
  breakdown: SpecScoreBreakdown | null
  scoredAt: string
  evidence?: EvidenceBundle
}) {
  const tier = tierFor(score)
  return (
    <div className="border-2 border-[var(--line)] bg-[var(--paper)]" title={SCORE_EXPLAINER}>
      <p className="flex items-center justify-between border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
        <span>fig. 02 — early signal score</span>
        <Link href="/methodology" className="invert-hover shrink-0 whitespace-nowrap px-1 text-[var(--ink)]">methodology →</Link>
      </p>
      <div className="p-4 font-mono">
        <div className="flex items-end justify-between gap-3">
          <p className="text-4xl font-bold text-[var(--ink)]">
            {score}
            <span className="text-lg font-normal text-[var(--muted)]">/100</span>
          </p>
          <p className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--paper)] ${tierChipClass(tier)}`}>
            {tier}
          </p>
        </div>

        <div className="mt-3 h-2 w-full border border-[var(--line)] bg-[var(--paper)]">
          <div className="gauge-fill h-full bg-[var(--ink)]" style={{ width: `${score}%` }} />
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
          {tierExplainer(tier)}. Blends star growth, builders, buzz, and commit pace.
          70+ breakout · 40–69 hot · under 40 active.
        </p>

        {breakdown ? (
          <div className="mt-4 space-y-1.5 border-t-2 border-[var(--line)] pt-3">
            {SIGNALS.map(({ key, label, weight }) => {
              const value = breakdown[key]
              if (typeof value !== 'number') return null
              const valueEl = <b className="text-[var(--ink)]">{value}</b>
              return (
                <p key={key} className="text-[11px] text-[var(--body)]">
                  {label.padEnd(18, ' ')}
                  <span className="text-[var(--ink)]">{gauge(value, 10)}</span>{' '}
                  {evidence ? (
                    <Evidence label={evidenceFor(key, evidence)}>{valueEl}</Evidence>
                  ) : (
                    valueEl
                  )}{' '}
                  <span className="text-[var(--muted)]">({weight}%)</span>
                </p>
              )
            })}
            {breakdown.manipulation_penalty > 0 && (
              <p className="pt-1 text-[11px] text-[var(--negative)]">
                manipulation filter: −
                {evidence ? (
                  <Evidence label="points deducted openly — a growth pattern the filter flagged as inorganic. how the filter works: methodology →">
                    {breakdown.manipulation_penalty}
                  </Evidence>
                ) : (
                  breakdown.manipulation_penalty
                )}{' '}
                points
              </p>
            )}
          </div>
        ) : null}

        <p className="mt-3 text-[10px] text-[var(--muted)]">measured {scoredAt}</p>
      </div>
    </div>
  )
}
