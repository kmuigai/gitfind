// Outcomes Ledger — 2025–26 backfill runner (gate G8, Nov 6, 2026)
// Processes the top 1,000 projects by Early Signal Score through the news
// sweep over the 2025–26 window and records an outcome_checks row for
// every completed pass, so gate G8's "1,000 / 1,000" is provable rather
// than assumed. Design: docs/outcomes-ledger.md, "The 2025–26 backfill";
// orchestration: lib/backfill-outcomes.ts; detection: the shared sweep
// engine in lib/news-sweep.ts (the same pipeline the weekly sweep runs).
//
// Resumable by construction: repos already carrying a check row for the
// window are skipped, a repo whose pass fails records no check row and is
// retried by a later batch, and each repo's outcomes are inserted before
// its check row — a recorded pass always has its outcomes in the ledger.
//
// Run (dry run — the default: sweeps and reports, writes NOTHING — no
// outcomes, no check rows):
//   npx tsx scripts/backfill-outcomes.ts
// Run one real batch (50 repos — sized for one GitHub Actions window;
// the full target set is ~20 batches at this size):
//   npx tsx scripts/backfill-outcomes.ts --write
//   npx tsx scripts/backfill-outcomes.ts --write --limit 100
//   npx tsx scripts/backfill-outcomes.ts --write --offset 200
//
// NOTE: the dry-run default is deliberate — this writes to the proprietary
// ledger AND its coverage record, so writing must be an explicit act.
//
// Requires migrations 005 + 009 (project_outcomes + dedupe) and 010
// (outcome_checks).
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY — only when a repo actually has nominated candidates.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServiceClient } from '../lib/supabase.js'
import {
  BACKFILL_CHECKER,
  DEFAULT_BATCH_LIMIT,
  runBackfill,
  rankTopProjects,
  type BackfillCandidate,
  type BackfillRepoRow,
  type BackfillWindow,
  type OutcomeCheckInsert,
} from '../lib/backfill-outcomes.js'
import {
  createClassifier,
  insertOutcomeRows,
  loadExistingOutcomeKeys,
  sweepRepo,
  toOutcomeInsertRow,
} from '../lib/news-sweep.js'

const WRITE = process.argv.includes('--write')
const REPO_PAGE_SIZE = 200
const CHECK_PAGE_SIZE = 1000

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

const LIMIT = Number(argValue('--limit') ?? DEFAULT_BATCH_LIMIT)
const OFFSET = Number(argValue('--offset') ?? 0)

async function main() {
  const supabase = createServiceClient()
  const classify = createClassifier()

  const summary = await runBackfill(
    {
      // The target set: enrichments ranked by Early Signal Score — the
      // ranking the site itself serves (getTopRepos in lib/queries.ts).
      fetchTopCandidates: async (target): Promise<BackfillCandidate[]> => {
        const { data: enrichments, error: eErr } = await supabase
          .from('enrichments')
          .select('repo_id, early_signal_score')
          .order('early_signal_score', { ascending: false })
          .limit(target)
        if (eErr) throw new Error(`reading enrichments: ${eErr.message}`)
        const rows = enrichments ?? []

        const reposById = new Map<string, BackfillRepoRow>()
        const repoIds = rows.map((r) => r.repo_id)
        for (let i = 0; i < repoIds.length; i += REPO_PAGE_SIZE) {
          const { data: repos, error: rErr } = await supabase
            .from('repos')
            .select('id, owner, name, url, description')
            .in('id', repoIds.slice(i, i + REPO_PAGE_SIZE))
          if (rErr) throw new Error(`reading repos: ${rErr.message}`)
          for (const repo of repos ?? []) reposById.set(repo.id, repo as BackfillRepoRow)
        }
        return rankTopProjects(rows, reposById, target)
      },

      fetchCheckedRepoIds: async (window: BackfillWindow): Promise<ReadonlySet<string>> => {
        const ids = new Set<string>()
        for (let from = 0; ; from += CHECK_PAGE_SIZE) {
          const { data, error } = await supabase
            .from('outcome_checks')
            .select('repo_id')
            .eq('checker', BACKFILL_CHECKER)
            .eq('window_start', window.windowStart)
            .range(from, from + CHECK_PAGE_SIZE - 1)
          if (error) throw new Error(`reading outcome_checks: ${error.message}`)
          for (const row of data ?? []) ids.add(row.repo_id)
          if (!data || data.length < CHECK_PAGE_SIZE) break
        }
        return ids
      },

      fetchExistingOutcomeKeys: () => loadExistingOutcomeKeys(supabase),

      sweepRepo: (repo, options) => sweepRepo(repo, { ...options, classify }),

      insertOutcomes: async (repoId, outcomes) => {
        await insertOutcomeRows(supabase, outcomes.map((o) => toOutcomeInsertRow(repoId, o)))
      },

      insertCheck: async (row: OutcomeCheckInsert) => {
        const { error } = await supabase.from('outcome_checks').insert(row)
        if (error) throw new Error(`recording outcome check: ${error.message}`)
      },

      log: (message) => console.log(message),
    },
    { write: WRITE, limit: LIMIT, offset: OFFSET },
  )

  if (!WRITE) {
    console.log('\nDry run — nothing written (no outcomes, no check rows). Re-run with --write to record this batch.')
  } else {
    console.log(
      `\nRecorded ${summary.checked} check rows in outcome_checks (${summary.failed} repos failed and were left unchecked for a later batch).`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
