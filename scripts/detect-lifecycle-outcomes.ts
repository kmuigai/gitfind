// Outcomes Ledger — lifecycle scan (Board Directive 2, Nov 6, 2026)
// The v1 automated writer for project_outcomes. Scans the repos table and
// records 'dead' outcomes for repos whose lifecycle has observably ended:
// archived on GitHub, or no pushes for 365+ days. Classification lives in
// lib/outcomes.ts (pure, unit-tested); this script is only I/O.
//
// Idempotent: repos that already have a 'dead' outcome are skipped, and a
// partial unique index (migration 005) enforces one 'dead' row per repo.
//
// Run (dry run — the default, prints what it WOULD insert, writes nothing):
//   npx tsx scripts/detect-lifecycle-outcomes.ts
// Run for real:
//   npx tsx scripts/detect-lifecycle-outcomes.ts --write
//
// NOTE: the dry-run default is deliberately the inverse of most pipeline
// scripts — this one writes to the proprietary ledger, so writing must be
// an explicit act.
//
// Requires migration 005 (project_outcomes) to be applied, and:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServiceClient } from '../lib/supabase.js'
import { classifyLifecycle, type LifecycleOutcome } from '../lib/outcomes.js'

const WRITE = process.argv.includes('--write')
const PAGE_SIZE = 1000
const INSERT_CHUNK = 500
const SAMPLE_LINES = 10

interface RepoRow {
  id: string
  owner: string
  name: string
  url: string
  archived: boolean
  pushed_at: string | null
}

async function main() {
  const supabase = createServiceClient()
  const now = new Date()

  // Repos that already have a 'dead' outcome — never written twice.
  const alreadyDead = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('project_outcomes')
      .select('repo_id')
      .eq('event_type', 'dead')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`reading existing outcomes: ${error.message}`)
    for (const row of data ?? []) alreadyDead.add(row.repo_id)
    if (!data || data.length < PAGE_SIZE) break
  }

  let scanned = 0
  let skippedExisting = 0
  const pending: { repo_id: string; label: string; outcome: LifecycleOutcome }[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('repos')
      .select('id, owner, name, url, archived, pushed_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`reading repos: ${error.message}`)
    const repos = (data ?? []) as RepoRow[]
    for (const repo of repos) {
      scanned++
      const outcome = classifyLifecycle(repo, now)
      if (!outcome) continue
      if (alreadyDead.has(repo.id)) {
        skippedExisting++
        continue
      }
      pending.push({ repo_id: repo.id, label: `${repo.owner}/${repo.name}`, outcome })
    }
    if (repos.length < PAGE_SIZE) break
  }

  const confirmed = pending.filter((p) => p.outcome.confidence === 'confirmed').length
  console.log(
    `Scanned ${scanned} repos · ${alreadyDead.size} already have a 'dead' outcome ` +
      `(${skippedExisting} matched again and were skipped)`,
  )
  console.log(
    `New 'dead' outcomes: ${pending.length} (${confirmed} confirmed/archived, ${pending.length - confirmed} likely/inactive)`,
  )
  for (const p of pending.slice(0, SAMPLE_LINES)) {
    console.log(
      `  ${p.label} → dead @ ${p.outcome.event_date} (${p.outcome.confidence}) — ${p.outcome.details}`,
    )
  }
  if (pending.length > SAMPLE_LINES) console.log(`  … and ${pending.length - SAMPLE_LINES} more`)

  if (!WRITE) {
    console.log('\nDry run — nothing written. Re-run with --write to insert.')
    return
  }

  let inserted = 0
  for (let i = 0; i < pending.length; i += INSERT_CHUNK) {
    const chunk = pending.slice(i, i + INSERT_CHUNK).map((p) => ({
      repo_id: p.repo_id,
      event_type: p.outcome.event_type,
      event_date: p.outcome.event_date,
      source_url: p.outcome.source_url,
      details: p.outcome.details,
      confidence: p.outcome.confidence,
      detected_by: p.outcome.detected_by,
    }))
    const { error } = await supabase.from('project_outcomes').insert(chunk)
    if (error) throw new Error(`inserting outcomes: ${error.message}`)
    inserted += chunk.length
  }
  console.log(`\nInserted ${inserted} rows into project_outcomes.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
