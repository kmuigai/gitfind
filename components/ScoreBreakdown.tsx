'use client'

import { useState } from 'react'

interface ScoreBreakdownData {
  star_velocity_score: number
  contributor_ratio_score: number
  fork_velocity_score: number
  mention_velocity_score: number
  commit_frequency_score: number
  manipulation_penalty: number
  raw_score: number
  final_score: number
}

interface ScoreBreakdownProps {
  score: number
  breakdown: ScoreBreakdownData | null
}

const SIGNALS = [
  { key: 'star_velocity_score', label: 'Star growth', weight: '30%' },
  { key: 'contributor_ratio_score', label: 'Active builders', weight: '25%' },
  { key: 'fork_velocity_score', label: 'Fork activity', weight: '15%' },
  { key: 'mention_velocity_score', label: 'Community buzz', weight: '15%' },
  { key: 'commit_frequency_score', label: 'Commit pace', weight: '10%' },
] as const

export default function ScoreBreakdown({ score, breakdown }: ScoreBreakdownProps) {
  const [expanded, setExpanded] = useState(false)

  const tier = score >= 70 ? 'Trending' : score >= 40 ? 'Rising' : 'Watch'
  const textColor =
    score >= 70 ? 'text-[var(--score-high)]' : score >= 40 ? 'text-[var(--score-mid)]' : 'text-[var(--score-low)]'
  const barColor =
    score >= 70 ? 'bg-[var(--score-high)]' : score >= 40 ? 'bg-[var(--score-mid)]' : 'bg-[var(--score-low)]'
  const tierText =
    score >= 70
      ? 'Strong early signal — high likelihood of breaking out'
      : score >= 40
        ? 'Moderate signal — worth watching'
        : 'Early stage — limited signal data'

  return (
    <div className="space-y-3">
      {/* Score + tier */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className={`font-mono text-3xl font-bold ${textColor}`}>{score}</span>
          <span className={`ml-2 text-sm font-medium ${textColor}`}>{tier}</span>
        </div>
      </div>

      {/* Tier description */}
      <p className="text-xs text-[var(--foreground-subtle)]">{tierText}</p>

      {/* Expand toggle */}
      {breakdown && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--foreground-muted)] transition-colors hover:text-[var(--accent)]"
        >
          {expanded ? 'Hide breakdown' : 'View breakdown'}
          <span className="ml-1">{expanded ? '−' : '+'}</span>
        </button>
      )}

      {/* Breakdown bars */}
      {expanded && breakdown && (
        <div className="space-y-2.5 pt-1">
          {SIGNALS.map(({ key, label, weight }) => {
            const value = breakdown[key]
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--foreground-muted)]">{label}</span>
                  <span className="font-mono text-xs text-[var(--foreground-subtle)]">
                    {value} <span className="opacity-50">({weight})</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--background-elevated)]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            )
          })}
          {breakdown.manipulation_penalty > 0 && (
            <div className="pt-1 text-xs text-[var(--foreground-subtle)]">
              Manipulation filter: −{breakdown.manipulation_penalty} points
            </div>
          )}
        </div>
      )}
    </div>
  )
}
