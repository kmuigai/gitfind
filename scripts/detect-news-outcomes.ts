// Outcomes Ledger — news sweep (Board Directive 2 Phase 2, Nov 6, 2026)
// The second automated writer for project_outcomes. The lifecycle scan
// (scripts/detect-lifecycle-outcomes.ts) records 'dead' from repo state;
// this sweep detects the company/product events repo state cannot evidence
// — funding, acquired, shutdown, pivot, adopted, maintainer_move, breakout —
// from news, and writes them with detected_by = 'news-sweep'.
//
// Method (design: docs/outcomes-ledger.md, "Phase 2 — the news sweep"):
//   1. Fetch candidate headlines from two keyless sources reachable from
//      GitHub Actions: Google News RSS search and Hacker News (Algolia).
//   2. Keyword patterns nominate plausible event classes per headline
//      (lib/news-outcomes.ts) — items with no nomination never reach the LLM.
//   3. One Anthropic call per repo classifies the nominated candidates
//      (ANTHROPIC_API_KEY, the same secret and model the digest uses).
//   4. Deterministic validation gates every proposal before it can become
//      a row: verbatim evidence quote in the fetched item, source URL among
//      the fetched items, valid non-future date, never 'dead'.
//
// The fetch → classify → validate pipeline itself lives in
// lib/news-sweep.ts, shared with the 2025–26 backfill runner
// (scripts/backfill-outcomes.ts) so the two can never drift apart.
//
// Idempotent: rows are keyed by (repo_id, event_type, event_date); existing
// keys are skipped, and migration 009 adds the matching partial unique
// index so the guarantee also holds at the database level.
//
// Run (dry run — the default, prints what it WOULD insert, writes nothing):
//   npx tsx scripts/detect-news-outcomes.ts
// Bounded inputs:
//   npx tsx scripts/detect-news-outcomes.ts --repo acme/widgetkit,other/project
//   npx tsx scripts/detect-news-outcomes.ts --limit 100 --since-days 730
// Run for real:
//   npx tsx scripts/detect-news-outcomes.ts --write
//
// NOTE: the dry-run default is deliberate, as with the lifecycle scan —
// this writes to the proprietary ledger, so writing must be an explicit act.
//
// Requires migration 005 (project_outcomes); migration 009 hardens dedupe.
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY — only when a repo actually has nominated candidates.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServiceClient } from '../lib/supabase.js'
import type { NewsCandidate, NewsOutcome } from '../lib/news-outcomes.js'
import {
  createClassifier,
  insertOutcomeRows,
  loadExistingOutcomeKeys,
  rejectionLogLine,
  sweepRepo,
  toOutcomeInsertRow,
} from '../lib/news-sweep.js'

const WRITE = process.argv.includes('--write')
const INSERT_CHUNK = 500
const SAMPLE_LINES = 10

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

const LIMIT = Number(argValue('--limit') ?? 25)
const SINCE_DAYS = Number(argValue('--since-days') ?? 365)
const REPO_FILTER = (argValue('--repo') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

interface RepoRow extends NewsCandidate {
  stars: number
}

async function main() {
  const supabase = createServiceClient()
  const now = new Date()

  // Repos already carrying a news-class outcome — never written twice.
  const existingKeys = await loadExistingOutcomeKeys(supabase)

  // The bounded input: an explicit --repo list, or the top repos by stars.
  let repos: RepoRow[] = []
  if (REPO_FILTER.length > 0) {
    for (const fullName of REPO_FILTER) {
      const [owner, name] = fullName.split('/')
      if (!owner || !name) continue
      const { data, error } = await supabase
        .from('repos')
        .select('id, owner, name, url, description, stars')
        .ilike('owner', owner)
        .ilike('name', name)
        .limit(1)
      if (error) throw new Error(`reading repo ${fullName}: ${error.message}`)
      if (data && data.length > 0) repos.push(data[0] as RepoRow)
    }
  } else {
    const { data, error } = await supabase
      .from('repos')
      .select('id, owner, name, url, description, stars')
      .order('stars', { ascending: false })
      .limit(LIMIT)
    if (error) throw new Error(`reading repos: ${error.message}`)
    repos = (data ?? []) as RepoRow[]
  }

  console.log(
    `News sweep over ${repos.length} repos (window: last ${SINCE_DAYS} days) · ` +
      `${existingKeys.size} existing news outcomes on record`,
  )

  const classify = createClassifier()
  let checked = 0
  let withCandidates = 0
  let rejectedCount = 0
  const rejectedLines: string[] = []
  const pending: { repo_id: string; label: string; outcome: NewsOutcome }[] = []

  for (const repo of repos) {
    checked++
    const result = await sweepRepo(repo, { sinceDays: SINCE_DAYS, now, classify, existingKeys })
    if (result.hadCandidates) withCandidates++
    rejectedCount += result.rejectedCount
    for (const r of result.rejected) rejectedLines.push(rejectionLogLine(r))
    for (const outcome of result.accepted) {
      pending.push({ repo_id: repo.id, label: `${repo.owner}/${repo.name}`, outcome })
    }
  }

  const byType = new Map<string, number>()
  for (const p of pending) byType.set(p.outcome.event_type, (byType.get(p.outcome.event_type) ?? 0) + 1)
  console.log(
    `Checked ${checked} repos · ${withCandidates} had nominated candidates · ` +
      `${rejectedCount} proposals rejected by validation`,
  )
  // One line per rejection — repo, proposed type, and the specific gate
  // that turned it away — so a run's audit trail shows what was refused
  // and why, not just how much.
  for (const line of rejectedLines) console.log(`  ${line}`)
  console.log(
    `New news outcomes: ${pending.length}` +
      (byType.size > 0 ? ` (${[...byType.entries()].map(([t, n]) => `${t}: ${n}`).join(', ')})` : ''),
  )
  for (const p of pending.slice(0, SAMPLE_LINES)) {
    console.log(
      `  ${p.label} → ${p.outcome.event_type} @ ${p.outcome.event_date} (${p.outcome.confidence}) — ${p.outcome.details}`,
    )
  }
  if (pending.length > SAMPLE_LINES) console.log(`  … and ${pending.length - SAMPLE_LINES} more`)

  if (!WRITE) {
    console.log('\nDry run — nothing written. Re-run with --write to insert.')
    return
  }

  let inserted = 0
  for (let i = 0; i < pending.length; i += INSERT_CHUNK) {
    const chunk = pending.slice(i, i + INSERT_CHUNK).map((p) => toOutcomeInsertRow(p.repo_id, p.outcome))
    await insertOutcomeRows(supabase, chunk)
    inserted += chunk.length
  }
  console.log(`\nInserted ${inserted} rows into project_outcomes.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
