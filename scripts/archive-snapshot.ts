// Daily archive snapshot (Board Directive 1, Nov 6, 2026).
//
// Freezes GitFind's derived data — the point-in-time asset behind the Early
// Signal Score, the AI Code Index, and the Open Model Index — into immutable
// dated JSONL files with a checksummed manifest, OUTSIDE the serving
// database. Run by .github/workflows/archive-snapshot.yml, which commits the
// output to the dedicated `archive` branch.
//
//   npx tsx scripts/archive-snapshot.ts [--date YYYY-MM-DD] [--out DIR] [--dry-run]
//   npx tsx scripts/archive-snapshot.ts --verify [--out DIR]
//
// Datasets:
//   Full freeze (these tables are mutated/backfilled in place, so only a
//   full daily copy preserves them "as published" on that day):
//     repos            — catalog state (stars, forks, metadata) as of the date
//     enrichments      — scores, breakdowns, and AI summaries as of the date
//     ai_code_index    — tool_contributions rows for the _bigquery_aggregate
//                        placeholder repo: the full AI Code Index series,
//                        agent-PR series, config-adoption and SDK/buzz rows
//     model_metrics    — the full Open Model Index series
//   Dated slice (append-only fact tables keyed by snapshot_date; the union
//   of daily slices is the full history):
//     repo_snapshots   — rows where snapshot_date = date
//     package_downloads— rows where snapshot_date = date
//     weekly_stats     — rows where snapshot_date = date (weekly cadence;
//                        zero rows on other days is expected, not a failure)
//
// The script only ever SELECTs — it never writes to the database. Output for
// a date overwrites that date's files and manifest entry only, so re-running
// a date is idempotent and can never disturb another day.

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  archiveDatePath,
  buildDayEntry,
  collectKeysetPages,
  findMissingDates,
  idCursorAfter,
  mergeManifest,
  modelCursorAfter,
  modelCursorOrFilter,
  parseManifest,
  serializeJsonl,
  sha256Hex,
  type ArchiveManifest,
  type DatasetSnapshotInput,
  type ModelMetricsCursor,
} from '../lib/archive.js'

dotenv.config({ path: '.env.local' })

// Built lazily so --verify (a pure file/manifest check) works with no
// database credentials present.
let sb: ReturnType<typeof createClient> | null = null
function db(): ReturnType<typeof createClient> {
  if (!sb) {
    sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return sb
}

const PAGE_SIZE = 1000

// Datasets that must never come back empty — an empty result here means the
// pipeline or the query broke, not that there was nothing to archive (the
// Sep–Oct 2026 silent-zero failure is the lesson behind this guard).
const NON_EMPTY_DATASETS = new Set(['repos', 'enrichments', 'ai_code_index', 'model_metrics'])

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

type Row = Record<string, unknown>

interface PageResult {
  data: Row[] | null
  error: { message: string } | null
}

/**
 * Fetch every row of an id-ordered query, paging with a keyset cursor
 * (`id > last id seen`) instead of OFFSET. Offset paging re-scans the whole
 * matching set for every page and timed out on repo_snapshots in run #1
 * (Nov 6, 2026); each keyset page is a bounded index range scan. The row
 * sequence — and therefore the archived bytes — is unchanged.
 */
async function fetchKeysetById(
  label: string,
  query: (afterId: string | null) => PromiseLike<PageResult>,
): Promise<Row[]> {
  return collectKeysetPages<Row, string>(
    PAGE_SIZE,
    async (afterId: string | null) => {
      const { data, error } = await query(afterId)
      if (error) throw new Error(`${label}: ${error.message}`)
      return data ?? []
    },
    (page) => idCursorAfter(page),
  )
}

async function fetchDataset(name: string, date: string, repoKeyById: Map<string, string>, placeholderId: string | null): Promise<Row[]> {
  switch (name) {
    case 'repos':
      return fetchKeysetById('repos', (afterId) => {
        const q = db().from('repos').select('*').order('id', { ascending: true }).limit(PAGE_SIZE)
        return afterId === null ? q : q.gt('id', afterId)
      })
    case 'enrichments': {
      const rows = await fetchKeysetById('enrichments', (afterId) => {
        const q = db().from('enrichments').select('*').order('id', { ascending: true }).limit(PAGE_SIZE)
        return afterId === null ? q : q.gt('id', afterId)
      })
      // Denormalize owner/name so the file stands alone without the repos join.
      return rows.map((row) => ({ ...row, repo_key: repoKeyById.get(String(row.repo_id)) ?? null }))
    }
    // The dated slices keep select('*'): their rows are a handful of narrow
    // scalar columns and every column is derived state the archive exists to
    // preserve. The run #1 timeout was a scan problem (no index leads with
    // snapshot_date — see migration 007), not a row-width problem.
    case 'repo_snapshots':
      return fetchKeysetById('repo_snapshots', (afterId) => {
        const q = db().from('repo_snapshots').select('*').eq('snapshot_date', date).order('id', { ascending: true }).limit(PAGE_SIZE)
        return afterId === null ? q : q.gt('id', afterId)
      })
    case 'package_downloads':
      return fetchKeysetById('package_downloads', (afterId) => {
        const q = db().from('package_downloads').select('*').eq('snapshot_date', date).order('id', { ascending: true }).limit(PAGE_SIZE)
        return afterId === null ? q : q.gt('id', afterId)
      })
    case 'weekly_stats':
      return fetchKeysetById('weekly_stats', (afterId) => {
        const q = db().from('weekly_stats').select('*').eq('snapshot_date', date).order('id', { ascending: true }).limit(PAGE_SIZE)
        return afterId === null ? q : q.gt('id', afterId)
      })
    case 'ai_code_index': {
      if (!placeholderId) {
        throw new Error('ai_code_index: _bigquery_aggregate placeholder repo not found in repos export')
      }
      return fetchKeysetById('ai_code_index', (afterId) => {
        const q = db().from('tool_contributions').select('*').eq('repo_id', placeholderId).order('id', { ascending: true }).limit(PAGE_SIZE)
        return afterId === null ? q : q.gt('id', afterId)
      })
    }
    case 'model_metrics':
      // No id column: the primary key is (model_key, snapshot_date). Page on
      // the (snapshot_date, model_key) ordering with a tuple cursor.
      return collectKeysetPages<Row, ModelMetricsCursor>(
        PAGE_SIZE,
        async (cursor: ModelMetricsCursor | null) => {
          const q = db().from('model_metrics').select('*')
            .order('snapshot_date', { ascending: true })
            .order('model_key', { ascending: true })
            .limit(PAGE_SIZE)
          const { data, error } = await (cursor === null ? q : q.or(modelCursorOrFilter(cursor)))
          if (error) throw new Error(`model_metrics: ${error.message}`)
          return (data ?? []) as Row[]
        },
        (page) => modelCursorAfter(page),
      )
    default:
      throw new Error(`Unknown dataset: ${name}`)
  }
}

const DATASETS = [
  'repos',
  'enrichments',
  'repo_snapshots',
  'package_downloads',
  'weekly_stats',
  'ai_code_index',
  'model_metrics',
] as const

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? (process.argv[idx + 1] ?? null) : null
}

function manifestPath(outDir: string): string {
  return join(outDir, 'archive', 'manifest.json')
}

function loadManifest(outDir: string, nowIso: string): ArchiveManifest {
  const path = manifestPath(outDir)
  if (!existsSync(path)) return parseManifest('', nowIso)
  return parseManifest(readFileSync(path, 'utf8'), nowIso)
}

async function runSnapshot(date: string, outDir: string, dryRun: boolean): Promise<void> {
  const nowIso = new Date().toISOString()
  log(`Archiving derived data for ${date}${dryRun ? ' (dry run — nothing written)' : ''}`)

  // Repos first: enrichments need the id -> owner/name map, and the AI Code
  // Index needs the _bigquery_aggregate placeholder's id.
  const repos = await fetchDataset('repos', date, new Map(), null)
  if (repos.length === 0) throw new Error('repos: export returned 0 rows — refusing to archive an empty catalog')
  const repoKeyById = new Map<string, string>()
  let placeholderId: string | null = null
  for (const repo of repos) {
    repoKeyById.set(String(repo.id), `${String(repo.owner)}/${String(repo.name)}`)
    if (repo.owner === '_gitfind' && repo.name === '_bigquery_aggregate') {
      placeholderId = String(repo.id)
    }
  }

  const inputs: DatasetSnapshotInput[] = [
    { name: 'repos', content: serializeJsonl(repos), rows: repos.length },
  ]
  for (const name of DATASETS.slice(1)) {
    const rows = await fetchDataset(name, date, repoKeyById, placeholderId)
    if (NON_EMPTY_DATASETS.has(name) && rows.length === 0) {
      throw new Error(`${name}: export returned 0 rows — refusing to write a silently-empty archive day`)
    }
    inputs.push({ name, content: serializeJsonl(rows), rows: rows.length })
    log(`  ${name}: ${rows.length} rows`)
  }

  const dayEntry = buildDayEntry(date, inputs, nowIso)
  for (const input of inputs) {
    log(`  ${input.name}: sha256 ${dayEntry.datasets[input.name].sha256.slice(0, 12)}…`)
  }

  if (dryRun) {
    log('Dry run complete — no files written.')
    return
  }

  const dayDir = join(outDir, archiveDatePath(date))
  mkdirSync(dayDir, { recursive: true })
  for (const input of inputs) {
    writeFileSync(join(dayDir, `${input.name}.jsonl`), input.content, 'utf8')
  }

  const manifest = mergeManifest(loadManifest(outDir, nowIso), date, dayEntry, nowIso)
  writeFileSync(manifestPath(outDir), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  log(`Wrote ${inputs.length} datasets + manifest entry for ${date} under ${join(outDir, archiveDatePath(date))}`)
}

function runVerify(outDir: string): void {
  const manifest = loadManifest(outDir, new Date().toISOString())
  const days = Object.keys(manifest.days).sort()
  if (days.length === 0) {
    console.log('Archive manifest has no days recorded.')
    process.exit(1)
  }
  console.log(`Manifest covers ${days.length} day(s): ${days[0]} .. ${days[days.length - 1]}`)

  let problems = 0
  for (const date of days) {
    const entry = manifest.days[date]
    for (const [name, dataset] of Object.entries(entry.datasets)) {
      const filePath = join(outDir, dataset.path)
      if (!existsSync(filePath)) {
        console.log(`MISSING FILE  ${date} ${name}: ${dataset.path}`)
        problems++
        continue
      }
      const content = readFileSync(filePath, 'utf8')
      const actualSha = sha256Hex(content)
      const actualRows = content === '' ? 0 : content.split('\n').length - 1
      if (actualSha !== dataset.sha256) {
        console.log(`CHECKSUM FAIL ${date} ${name}: manifest ${dataset.sha256.slice(0, 12)}… != file ${actualSha.slice(0, 12)}…`)
        problems++
      }
      if (actualRows !== dataset.rows) {
        console.log(`ROWCOUNT FAIL ${date} ${name}: manifest ${dataset.rows} != file ${actualRows}`)
        problems++
      }
    }
  }

  const missing = findMissingDates(manifest)
  for (const date of missing) {
    console.log(`GAP           ${date}: no archive entry`)
    problems++
  }

  if (problems > 0) {
    console.log(`\nArchive verification FAILED with ${problems} problem(s).`)
    process.exit(1)
  }
  console.log('Archive verification passed: every recorded day is present, checksums match, no gaps.')
}

async function main(): Promise<void> {
  const outDir = argValue('--out') ?? process.env.ARCHIVE_OUT ?? 'archive-out'
  if (process.argv.includes('--verify')) {
    runVerify(outDir)
    return
  }
  const date = argValue('--date') ?? new Date().toISOString().slice(0, 10)
  await runSnapshot(date, outDir, process.argv.includes('--dry-run'))
}

main().catch((err: unknown) => {
  console.error(`[ERROR] archive snapshot failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
