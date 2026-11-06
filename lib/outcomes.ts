// The Outcomes Ledger — taxonomy + pure classification logic.
//
// The ledger records what actually happens to the projects GitFind tracks, so
// outcomes can later be joined to the point-in-time score history and the
// Early Signal Score's predictive quality can be measured (and licensed).
// Taxonomy and evidence rules: docs/outcomes-ledger.md.
//
// This module is pure (no I/O) so it is unit-testable; the scan that feeds it
// lives in scripts/detect-lifecycle-outcomes.ts.

/** The 8 v1 event types. Mirrors the CHECK constraint in migration 005. */
export const OUTCOME_EVENT_TYPES = [
  'funding',
  'acquired',
  'shutdown',
  'pivot',
  'adopted',
  'maintainer_move',
  'breakout',
  'dead',
] as const

export type OutcomeEventType = (typeof OUTCOME_EVENT_TYPES)[number]

export type OutcomeConfidence = 'confirmed' | 'likely'

/** Minimal repo shape the lifecycle classifier needs (from the repos table). */
export interface LifecycleCandidate {
  archived: boolean
  pushed_at: string | null
  url: string
}

/** A classified outcome, ready to insert into project_outcomes. */
export interface LifecycleOutcome {
  event_type: 'dead'
  /** ISO date (YYYY-MM-DD). See the event-date rule in classifyLifecycle. */
  event_date: string
  source_url: string
  details: string
  /** Archived on GitHub is a directly observed fact; inactivity is an inference. */
  confidence: OutcomeConfidence
  detected_by: 'lifecycle-scan'
}

/** No pushes for this many days (and not archived) counts as dead. */
export const DEAD_INACTIVITY_DAYS = 365

const DAY_MS = 24 * 60 * 60 * 1000

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Classify a repo's lifecycle state into at most one 'dead' outcome.
 *
 * v1 detects ONLY 'dead' from repo fields — the other seven event types are
 * company/product events (a funding round, a product shutdown) that repo
 * metadata cannot evidence; they arrive via news sweeps and manual rows.
 * In particular this never emits 'shutdown': in this taxonomy 'shutdown' is
 * a company/product event, while 'dead' is the repo-level end of life.
 *
 * Rules:
 *   - archived === true → 'dead', confidence 'confirmed' (GitHub's own flag).
 *   - pushed_at 365+ days before `now` (and not archived) → 'dead',
 *     confidence 'likely' (dormant projects occasionally revive).
 *   - pushed_at missing/unparseable and not archived → no event: without a
 *     last-activity date there is nothing honest to record.
 *
 * Event-date rule: the date activity is known to have ceased — pushed_at —
 * not the detection date. The ledger's joins ask "what did the score look
 * like just before this project died?", and pushed_at is the closest
 * observable anchor for that. For an archived repo with no pushed_at, the
 * detection date is used and the details say so.
 */
export function classifyLifecycle(
  repo: LifecycleCandidate,
  now: Date,
): LifecycleOutcome | null {
  const pushedAt = repo.pushed_at ? new Date(repo.pushed_at) : null
  const pushedValid = pushedAt !== null && !Number.isNaN(pushedAt.getTime())
  const pushedIso = pushedValid ? toIsoDate(pushedAt) : null
  const todayIso = toIsoDate(now)

  if (repo.archived) {
    return {
      event_type: 'dead',
      event_date: pushedIso ?? todayIso,
      source_url: repo.url,
      details: pushedIso
        ? `Repo archived on GitHub; last push ${pushedIso}; detected ${todayIso} by lifecycle scan.`
        : `Repo archived on GitHub; no pushed_at on record; detected ${todayIso} by lifecycle scan.`,
      confidence: 'confirmed',
      detected_by: 'lifecycle-scan',
    }
  }

  if (!pushedValid) return null

  const idleDays = Math.floor((now.getTime() - pushedAt.getTime()) / DAY_MS)
  if (idleDays >= DEAD_INACTIVITY_DAYS) {
    return {
      event_type: 'dead',
      event_date: pushedIso!,
      source_url: repo.url,
      details: `No pushes for ${idleDays} days (threshold ${DEAD_INACTIVITY_DAYS}); last push ${pushedIso}; detected ${todayIso} by lifecycle scan.`,
      confidence: 'likely',
      detected_by: 'lifecycle-scan',
    }
  }

  return null
}
