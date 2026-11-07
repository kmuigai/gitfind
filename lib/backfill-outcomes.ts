// The Outcomes Ledger — 2025–26 backfill over the top 1,000 projects.
//
// Gate G8 of the product-first program: the top 1,000 projects by Early
// Signal Score each end up with an outcome row or a recorded "checked, no
// outcome" pass — 1,000 / 1,000, provably. The weekly news sweep
// (scripts/detect-news-outcomes.ts) only ever looks back ~a year and keeps
// no record of the repos it passed over, so it cannot produce that proof.
// This runner can:
//
//   - the target set is the site's own definition of "top": enrichments
//     ordered by early_signal_score descending (the ranking getTopRepos
//     serves), capped at 1,000;
//   - every repo it processes gets an outcome_checks row (migration 010)
//     recording the window, the result, and how many outcomes were found —
//     unless its processing FAILED, in which case no row is recorded and a
//     later batch retries it (a recorded pass must mean the pass happened);
//   - repos already carrying a check row for the window are skipped, so
//     the backfill is resumable: run a batch, stop, run the next.
//
// Detection itself is the shared sweep engine (lib/news-sweep.ts) — the
// same fetch → nominate → classify → validate pipeline as the weekly
// sweep, pointed at a window that starts 2025-01-01. This module is the
// orchestration around it, written against injected dependencies so the
// selection, skipping, and check-recording decisions are unit-testable
// with the sweep core mocked; scripts/backfill-outcomes.ts wires the real
// Supabase + engine implementations in.

import type { NewsCandidate, NewsOutcome } from './news-outcomes.js'
import { rejectionLogLine, type SweepRepoResult } from './news-sweep.js'

/** Gate G8's target: the top 1,000 projects by Early Signal Score. */
export const BACKFILL_TARGET = 1000
/** The backfill window opens 2025-01-01; it closes on the day a pass runs. */
export const BACKFILL_WINDOW_START = '2025-01-01'
/** The `checker` value recorded in outcome_checks for passes by this runner. */
export const BACKFILL_CHECKER = 'news-sweep-backfill'
/** Default batch size — sized for one GitHub Actions window (see docs). */
export const DEFAULT_BATCH_LIMIT = 50
const PROGRESS_EVERY = 25
const DAY_MS = 24 * 60 * 60 * 1000

export interface BackfillCandidate extends NewsCandidate {
  /** The Early Signal Score that ranked this project into the target set. */
  score: number
}

export interface RankedEnrichmentRow {
  repo_id: string
  early_signal_score: number
}

export interface BackfillRepoRow {
  id: string
  owner: string
  name: string
  url: string
  description: string | null
}

/**
 * Shape the target set from score-ordered enrichment rows: preserve the
 * incoming order (the query ranks by Early Signal Score descending — this
 * function never re-sorts), dedupe repeat repo_ids, drop enrichments whose
 * repo row is missing, and cap at the target. Pure so the selection is
 * testable without a database.
 */
export function rankTopProjects(
  enrichmentRows: RankedEnrichmentRow[],
  reposById: ReadonlyMap<string, BackfillRepoRow>,
  target: number = BACKFILL_TARGET,
): BackfillCandidate[] {
  const seen = new Set<string>()
  const candidates: BackfillCandidate[] = []
  for (const row of enrichmentRows) {
    if (candidates.length >= target) break
    if (seen.has(row.repo_id)) continue
    seen.add(row.repo_id)
    const repo = reposById.get(row.repo_id)
    if (!repo) continue
    candidates.push({
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      url: repo.url,
      description: repo.description,
      score: row.early_signal_score,
    })
  }
  return candidates
}

export interface BackfillWindow {
  /** First day of the window (BACKFILL_WINDOW_START). */
  windowStart: string
  /** Last day of the window — the day the pass runs. */
  windowEnd: string
  /**
   * Look-back for the sweep engine, in days. One day wider than the exact
   * window so a headline published at any hour of the opening day is
   * fetched; withinWindow() then trims recorded outcomes to the exact
   * window, so the extra day can never leak an out-of-window row in.
   */
  sinceDays: number
}

export function backfillWindow(now: Date): BackfillWindow {
  const windowEnd = now.toISOString().slice(0, 10)
  const days = Math.round((Date.parse(windowEnd) - Date.parse(BACKFILL_WINDOW_START)) / DAY_MS)
  return { windowStart: BACKFILL_WINDOW_START, windowEnd, sinceDays: days + 1 }
}

/** An accepted outcome belongs to the backfill only if it is dated inside the window. */
export function withinWindow(outcome: NewsOutcome, window: BackfillWindow): boolean {
  return outcome.event_date >= window.windowStart && outcome.event_date <= window.windowEnd
}

export type CheckResult = 'outcome_found' | 'none_found'

/** The check-recording decision: found is a count question, nothing else. */
export function decideCheckResult(outcomesFound: number): CheckResult {
  return outcomesFound > 0 ? 'outcome_found' : 'none_found'
}

export interface OutcomeCheckInsert {
  repo_id: string
  window_start: string
  window_end: string
  checker: string
  result: CheckResult
  outcomes_found: number
}

export function buildCheckRow(repoId: string, window: BackfillWindow, outcomesFound: number): OutcomeCheckInsert {
  return {
    repo_id: repoId,
    window_start: window.windowStart,
    window_end: window.windowEnd,
    checker: BACKFILL_CHECKER,
    result: decideCheckResult(outcomesFound),
    outcomes_found: outcomesFound,
  }
}

/**
 * The repos one batch should process: the ranked target set minus repos
 * already checked for this window, windowed by offset then limit. Pure —
 * this is the resumability rule, and it is tested as one.
 */
export function planBatch(
  candidates: BackfillCandidate[],
  checkedRepoIds: ReadonlySet<string>,
  options: { limit: number; offset?: number },
): BackfillCandidate[] {
  const unchecked = candidates.filter((c) => !checkedRepoIds.has(c.id))
  const offset = options.offset ?? 0
  return unchecked.slice(offset, offset + options.limit)
}

export interface BackfillDeps {
  /** The ranked target set (top `target` by Early Signal Score). */
  fetchTopCandidates: (target: number) => Promise<BackfillCandidate[]>
  /**
   * Repo ids already carrying a check row for this window. The window is
   * identified by its start: a pass recorded on any day covers the window,
   * because each pass sweeps from the window start through its own day.
   */
  fetchCheckedRepoIds: (window: BackfillWindow) => Promise<ReadonlySet<string>>
  /** Dedupe keys of news outcomes already in the ledger (shared, mutated by the sweep). */
  fetchExistingOutcomeKeys: () => Promise<Set<string>>
  /** The shared sweep engine's per-repo detection. */
  sweepRepo: (
    repo: NewsCandidate,
    options: { sinceDays: number; now: Date; existingKeys: Set<string> },
  ) => Promise<SweepRepoResult>
  /** Insert one repo's accepted outcomes into project_outcomes. */
  insertOutcomes: (repoId: string, outcomes: NewsOutcome[]) => Promise<void>
  /** Record one repo's completed pass in outcome_checks. */
  insertCheck: (row: OutcomeCheckInsert) => Promise<void>
  log: (message: string) => void
}

export interface BackfillOptions {
  /** Write outcomes AND check rows. Dry-run (false) writes nothing at all. */
  write: boolean
  /** Batch size (default DEFAULT_BATCH_LIMIT). */
  limit?: number
  /** Skip this many unchecked repos before the batch starts (default 0). */
  offset?: number
  now?: Date
}

export interface BackfillSummary {
  target: number
  candidates: number
  alreadyChecked: number
  remaining: number
  attempted: number
  checked: number
  found: number
  none: number
  failed: number
  outcomesRecorded: number
}

/**
 * Run one backfill batch. Per repo: sweep, keep only outcomes dated inside
 * the window, and — in write mode — insert the outcomes first and the
 * check row second, so a recorded pass always has its outcomes already in
 * the ledger. Any failure (fetch, classification, either insert) is
 * isolated to that repo: it is logged, counted, records NO check row, and
 * the batch continues — a later batch retries it.
 */
export async function runBackfill(deps: BackfillDeps, options: BackfillOptions): Promise<BackfillSummary> {
  const now = options.now ?? new Date()
  const window = backfillWindow(now)
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT
  const offset = options.offset ?? 0

  const candidates = await deps.fetchTopCandidates(BACKFILL_TARGET)
  const checkedRepoIds = await deps.fetchCheckedRepoIds(window)
  const alreadyChecked = candidates.filter((c) => checkedRepoIds.has(c.id)).length
  const batch = planBatch(candidates, checkedRepoIds, { limit, offset })
  const existingKeys = await deps.fetchExistingOutcomeKeys()

  deps.log(
    `Backfill window ${window.windowStart} → ${window.windowEnd} · target ${BACKFILL_TARGET} by Early Signal Score`,
  )
  deps.log(
    `${candidates.length} candidates · ${alreadyChecked} already checked · ` +
      `batch of ${batch.length} (limit ${limit}, offset ${offset}) · ${options.write ? 'WRITE' : 'DRY RUN'}`,
  )

  const summary: BackfillSummary = {
    target: BACKFILL_TARGET,
    candidates: candidates.length,
    alreadyChecked,
    remaining: Math.max(0, candidates.length - alreadyChecked - offset - batch.length),
    attempted: 0,
    checked: 0,
    found: 0,
    none: 0,
    failed: 0,
    outcomesRecorded: 0,
  }

  for (const repo of batch) {
    summary.attempted++
    try {
      const result = await deps.sweepRepo(repo, { sinceDays: window.sinceDays, now, existingKeys })
      // Every rejected proposal is logged with its reason: across 1,000
      // repos, the rejection lines are the audit trail that shows the
      // validation gate working (or misfiring), not just a count.
      for (const r of result.rejected) deps.log(`  ${rejectionLogLine(r)}`)
      const inWindow = result.accepted.filter((outcome) => withinWindow(outcome, window))
      if (options.write) {
        if (inWindow.length > 0) await deps.insertOutcomes(repo.id, inWindow)
        await deps.insertCheck(buildCheckRow(repo.id, window, inWindow.length))
      }
      summary.checked++
      if (inWindow.length > 0) {
        summary.found++
        summary.outcomesRecorded += inWindow.length
      } else {
        summary.none++
      }
    } catch (err) {
      summary.failed++
      deps.log(
        `  ✗ ${repo.owner}/${repo.name} — ${err instanceof Error ? err.message : String(err)} ` +
          `(no check recorded; a later batch will retry)`,
      )
    }
    if (summary.attempted % PROGRESS_EVERY === 0) {
      deps.log(
        `  … ${summary.attempted}/${batch.length} processed · ${summary.found} with outcomes · ` +
          `${summary.none} none · ${summary.failed} failed`,
      )
    }
  }

  deps.log(
    `Batch complete: checked ${summary.checked} (${summary.found} outcome_found, ${summary.none} none_found) · ` +
      `${summary.failed} failed · ${summary.outcomesRecorded} outcomes ${options.write ? 'recorded' : 'would be recorded'} · ` +
      `${summary.remaining} of the target set still unchecked after this batch`,
  )
  return summary
}
