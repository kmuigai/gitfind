// Unit tests for the 2025–26 backfill orchestration (lib/backfill-outcomes.ts)
// Run with: npm test (Vitest)
//
// The sweep core is mocked throughout: these tests pin the runner's own
// decisions — target-set shaping, the skip-already-checked rule, the
// found / none / failure check-recording rules, and dry-run writing
// nothing — not the detection pipeline (covered by news-outcomes tests).

import { describe, it, expect, vi } from 'vitest'
import {
  BACKFILL_TARGET,
  backfillWindow,
  buildCheckRow,
  decideCheckResult,
  planBatch,
  rankTopProjects,
  runBackfill,
  withinWindow,
  type BackfillCandidate,
  type BackfillDeps,
  type BackfillRepoRow,
} from './backfill-outcomes'
import type { NewsOutcome } from './news-outcomes'
import type { SweepRepoResult } from './news-sweep'

const NOW = new Date('2026-11-06T12:00:00Z')
const WINDOW = backfillWindow(NOW)

function candidate(partial: Partial<BackfillCandidate> = {}): BackfillCandidate {
  return {
    id: 'repo-1',
    owner: 'acme',
    name: 'widgetkit',
    url: 'https://github.com/acme/widgetkit',
    description: 'A toolkit for widgets',
    score: 91,
    ...partial,
  }
}

function outcome(partial: Partial<NewsOutcome> = {}): NewsOutcome {
  return {
    event_type: 'funding',
    event_date: '2026-03-01',
    source_url: 'https://news.google.com/rss/articles/example',
    details: 'Raised $5M seed. Evidence: "raises $5M" (TechCrunch, 2026-03-02).',
    confidence: 'likely',
    detected_by: 'news-sweep',
    ...partial,
  }
}

describe('backfillWindow', () => {
  it('opens 2025-01-01 and closes on the run day', () => {
    expect(WINDOW.windowStart).toBe('2025-01-01')
    expect(WINDOW.windowEnd).toBe('2026-11-06')
  })

  it('looks back one day wider than the exact window (trimmed later)', () => {
    // 2025-01-01 → 2026-11-06 is 674 days; the sweep fetches 675 days back
    // so an opening-day headline published at any hour is seen.
    expect(WINDOW.sinceDays).toBe(675)
  })
})

describe('withinWindow', () => {
  it('accepts the window edges and rejects outside dates', () => {
    expect(withinWindow(outcome({ event_date: '2025-01-01' }), WINDOW)).toBe(true)
    expect(withinWindow(outcome({ event_date: '2026-11-06' }), WINDOW)).toBe(true)
    expect(withinWindow(outcome({ event_date: '2024-12-31' }), WINDOW)).toBe(false)
    expect(withinWindow(outcome({ event_date: '2026-11-07' }), WINDOW)).toBe(false)
  })
})

describe('rankTopProjects', () => {
  const repos = new Map<string, BackfillRepoRow>([
    ['a', { id: 'a', owner: 'acme', name: 'alpha', url: 'https://github.com/acme/alpha', description: null }],
    ['b', { id: 'b', owner: 'acme', name: 'beta', url: 'https://github.com/acme/beta', description: 'B' }],
    ['c', { id: 'c', owner: 'acme', name: 'gamma', url: 'https://github.com/acme/gamma', description: 'G' }],
  ])

  it('preserves the score order the query produced and carries the score', () => {
    const ranked = rankTopProjects(
      [
        { repo_id: 'b', early_signal_score: 95 },
        { repo_id: 'a', early_signal_score: 90 },
        { repo_id: 'c', early_signal_score: 80 },
      ],
      repos,
    )
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(ranked[0].score).toBe(95)
  })

  it('dedupes repeat repo_ids and drops enrichments whose repo is missing', () => {
    const ranked = rankTopProjects(
      [
        { repo_id: 'a', early_signal_score: 90 },
        { repo_id: 'a', early_signal_score: 90 },
        { repo_id: 'gone', early_signal_score: 85 },
        { repo_id: 'b', early_signal_score: 70 },
      ],
      repos,
    )
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('caps the set at the target', () => {
    const ranked = rankTopProjects(
      [
        { repo_id: 'a', early_signal_score: 90 },
        { repo_id: 'b', early_signal_score: 80 },
        { repo_id: 'c', early_signal_score: 70 },
      ],
      repos,
      2,
    )
    expect(ranked).toHaveLength(2)
    expect(BACKFILL_TARGET).toBe(1000)
  })
})

describe('planBatch', () => {
  const candidates = [
    candidate({ id: 'r1' }),
    candidate({ id: 'r2' }),
    candidate({ id: 'r3' }),
    candidate({ id: 'r4' }),
  ]

  it('skips repos already checked for the window', () => {
    const batch = planBatch(candidates, new Set(['r2', 'r4']), { limit: 50 })
    expect(batch.map((c) => c.id)).toEqual(['r1', 'r3'])
  })

  it('applies offset after skipping, then limit', () => {
    const batch = planBatch(candidates, new Set(['r1']), { limit: 1, offset: 1 })
    expect(batch.map((c) => c.id)).toEqual(['r3'])
  })
})

describe('check recording decision', () => {
  it('found when at least one outcome landed, none otherwise', () => {
    expect(decideCheckResult(2)).toBe('outcome_found')
    expect(decideCheckResult(0)).toBe('none_found')
  })

  it('builds the row the migration expects', () => {
    expect(buildCheckRow('repo-9', WINDOW, 3)).toEqual({
      repo_id: 'repo-9',
      window_start: '2025-01-01',
      window_end: '2026-11-06',
      checker: 'news-sweep-backfill',
      result: 'outcome_found',
      outcomes_found: 3,
    })
  })
})

// --- runBackfill, with the sweep core and the store mocked ------------------

function sweepResult(partial: Partial<SweepRepoResult> = {}): SweepRepoResult {
  return { accepted: [], rejected: [], rejectedCount: 0, hadCandidates: false, ...partial }
}

function makeDeps(overrides: Partial<BackfillDeps> = {}) {
  const calls: string[] = []
  const deps: BackfillDeps = {
    fetchTopCandidates: vi.fn(async () => [candidate()]),
    fetchCheckedRepoIds: vi.fn(async () => new Set<string>()),
    fetchExistingOutcomeKeys: vi.fn(async () => new Set<string>()),
    sweepRepo: vi.fn(async () => sweepResult()),
    insertOutcomes: vi.fn(async () => {
      calls.push('insertOutcomes')
    }),
    insertCheck: vi.fn(async () => {
      calls.push('insertCheck')
    }),
    log: vi.fn(),
    ...overrides,
  }
  return { deps, calls }
}

describe('runBackfill', () => {
  it('records outcome_found with the count, outcomes inserted before the check', async () => {
    const { deps, calls } = makeDeps({
      sweepRepo: vi.fn(async () => sweepResult({ accepted: [outcome()], hadCandidates: true })),
    })
    const summary = await runBackfill(deps, { write: true, now: NOW })

    expect(summary).toMatchObject({ checked: 1, found: 1, none: 0, failed: 0, outcomesRecorded: 1 })
    expect(deps.insertOutcomes).toHaveBeenCalledWith('repo-1', [outcome()])
    expect(deps.insertCheck).toHaveBeenCalledWith({
      repo_id: 'repo-1',
      window_start: '2025-01-01',
      window_end: '2026-11-06',
      checker: 'news-sweep-backfill',
      result: 'outcome_found',
      outcomes_found: 1,
    })
    expect(calls).toEqual(['insertOutcomes', 'insertCheck'])
  })

  it('records none_found and inserts no outcomes when the sweep finds nothing', async () => {
    const { deps } = makeDeps()
    const summary = await runBackfill(deps, { write: true, now: NOW })

    expect(summary).toMatchObject({ checked: 1, found: 0, none: 1, outcomesRecorded: 0 })
    expect(deps.insertOutcomes).not.toHaveBeenCalled()
    expect(deps.insertCheck).toHaveBeenCalledWith(expect.objectContaining({ result: 'none_found', outcomes_found: 0 }))
  })

  it('trims out-of-window outcomes before deciding the check result', async () => {
    const { deps } = makeDeps({
      sweepRepo: vi.fn(async () =>
        sweepResult({ accepted: [outcome({ event_date: '2024-06-15' })], hadCandidates: true }),
      ),
    })
    const summary = await runBackfill(deps, { write: true, now: NOW })

    expect(summary).toMatchObject({ found: 0, none: 1, outcomesRecorded: 0 })
    expect(deps.insertOutcomes).not.toHaveBeenCalled()
    expect(deps.insertCheck).toHaveBeenCalledWith(expect.objectContaining({ result: 'none_found' }))
  })

  it('never re-processes repos already checked for the window', async () => {
    const three = [
      candidate({ id: 'r1' }),
      candidate({ id: 'r2', name: 'beta' }),
      candidate({ id: 'r3', name: 'gamma' }),
    ]
    const { deps } = makeDeps({
      fetchTopCandidates: vi.fn(async () => three),
      fetchCheckedRepoIds: vi.fn(async () => new Set(['r1', 'r3'])),
    })
    const summary = await runBackfill(deps, { write: true, now: NOW })

    expect(summary).toMatchObject({ candidates: 3, alreadyChecked: 2, attempted: 1, checked: 1 })
    expect(deps.sweepRepo).toHaveBeenCalledTimes(1)
    expect(deps.sweepRepo).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }), expect.anything())
  })

  it('isolates a per-repo failure: no check row for it, the batch continues', async () => {
    const three = [
      candidate({ id: 'r1' }),
      candidate({ id: 'r2', name: 'beta' }),
      candidate({ id: 'r3', name: 'gamma' }),
    ]
    const { deps } = makeDeps({
      fetchTopCandidates: vi.fn(async () => three),
      sweepRepo: vi.fn(async (repo) => {
        if (repo.id === 'r2') throw new Error('headline fetch exploded')
        return sweepResult()
      }),
    })
    const summary = await runBackfill(deps, { write: true, now: NOW })

    expect(summary).toMatchObject({ attempted: 3, checked: 2, failed: 1 })
    const checkedIds = vi.mocked(deps.insertCheck).mock.calls.map((c) => c[0].repo_id)
    expect(checkedIds).toEqual(['r1', 'r3'])
  })

  it('records no check when the check insert itself fails', async () => {
    const { deps } = makeDeps({
      insertCheck: vi.fn(async () => {
        throw new Error('database unavailable')
      }),
    })
    const summary = await runBackfill(deps, { write: true, now: NOW })
    expect(summary).toMatchObject({ checked: 0, failed: 1 })
  })

  it('dry run writes nothing — no outcomes, no check rows', async () => {
    const { deps } = makeDeps({
      sweepRepo: vi.fn(async () => sweepResult({ accepted: [outcome()], hadCandidates: true })),
    })
    const summary = await runBackfill(deps, { write: false, now: NOW })

    expect(summary).toMatchObject({ checked: 1, found: 1, outcomesRecorded: 1 })
    expect(deps.insertOutcomes).not.toHaveBeenCalled()
    expect(deps.insertCheck).not.toHaveBeenCalled()
  })

  it('logs every rejected proposal with repo, type, and reason — and still records the pass', async () => {
    const rejected = {
      repoId: 'repo-1',
      label: 'acme/widgetkit',
      proposal: {
        event_type: 'acquired',
        event_date: '2026-02-01',
        evidence_quote: 'some quote',
        details: 'Acquired by Example Corp.',
        primary_source: false,
        source_url: 'https://example.com/not-fetched',
      },
      reason: 'source_url is not one of the fetched items',
    }
    const { deps } = makeDeps({
      sweepRepo: vi.fn(async () => sweepResult({ rejected: [rejected], rejectedCount: 1, hadCandidates: true })),
    })
    const summary = await runBackfill(deps, { write: true, now: NOW })

    const logLines = vi.mocked(deps.log).mock.calls.map((c) => c[0])
    expect(logLines).toContain(
      '  acme/widgetkit → acquired rejected: source_url is not one of the fetched items',
    )
    // A rejection is information, not a failure: the pass still counts.
    expect(summary).toMatchObject({ checked: 1, failed: 0, none: 1 })
    expect(deps.insertCheck).toHaveBeenCalledWith(expect.objectContaining({ result: 'none_found' }))
  })

  it('honors the batch limit', async () => {
    const many = Array.from({ length: 10 }, (_, i) => candidate({ id: `r${i}`, name: `repo-${i}` }))
    const { deps } = makeDeps({ fetchTopCandidates: vi.fn(async () => many) })
    const summary = await runBackfill(deps, { write: true, now: NOW, limit: 3 })

    expect(summary.attempted).toBe(3)
    expect(summary.remaining).toBe(7)
  })
})
