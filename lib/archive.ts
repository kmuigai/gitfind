// Pure helpers for the daily data archive (Board Directive 1, Nov 6, 2026).
//
// The archive freezes GitFind's derived data — Early Signal Scores, enrichment
// summaries, the AI Code Index series, and Open Model Index metrics — into
// immutable dated files on the `archive` branch, with a manifest recording row
// counts and SHA-256 checksums per dataset per day. A day with no manifest
// entry is a provable gap; a day whose files no longer match their checksums
// is provable tampering or corruption.
//
// This module is intentionally free of I/O: scripts/archive-snapshot.ts does
// the fetching and file writing, and everything here is unit-tested.

import { createHash } from 'node:crypto'

export const ARCHIVE_SCHEMA_VERSION = 1

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isArchiveDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** '2026-11-06' -> 'archive/2026/11/06'. Throws on malformed dates. */
export function archiveDatePath(date: string): string {
  if (!isArchiveDate(date)) {
    throw new Error(`Invalid archive date: ${JSON.stringify(date)} (expected YYYY-MM-DD)`)
  }
  const [year, month, day] = date.split('-')
  return `archive/${year}/${month}/${day}`
}

/**
 * JSON.stringify with object keys sorted at every depth, so the same logical
 * row always serializes to the same bytes regardless of the key order the
 * database happened to return. Checksums are only meaningful if this holds.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** Rows -> JSONL: one stable-stringified row per line, trailing newline. */
export function serializeJsonl(rows: readonly unknown[]): string {
  if (rows.length === 0) return ''
  return rows.map((row) => stableStringify(row)).join('\n') + '\n'
}

export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export interface DatasetSnapshotInput {
  /** Dataset name, also the file stem: '<name>.jsonl'. */
  name: string
  /** Serialized file content (from serializeJsonl). */
  content: string
  /** Number of rows serialized into content. */
  rows: number
}

export interface DatasetManifestEntry {
  rows: number
  sha256: string
  path: string
}

export interface DayManifestEntry {
  captured_at: string
  datasets: Record<string, DatasetManifestEntry>
}

export interface ArchiveManifest {
  version: number
  updated_at: string
  days: Record<string, DayManifestEntry>
}

export function emptyManifest(nowIso: string): ArchiveManifest {
  return { version: ARCHIVE_SCHEMA_VERSION, updated_at: nowIso, days: {} }
}

export function buildDayEntry(
  date: string,
  datasets: readonly DatasetSnapshotInput[],
  capturedAtIso: string,
): DayManifestEntry {
  const base = archiveDatePath(date)
  const entries: Record<string, DatasetManifestEntry> = {}
  for (const dataset of datasets) {
    entries[dataset.name] = {
      rows: dataset.rows,
      sha256: sha256Hex(dataset.content),
      path: `${base}/${dataset.name}.jsonl`,
    }
  }
  return { captured_at: capturedAtIso, datasets: entries }
}

/**
 * Return a new manifest with one day's entry replaced (or added). Every other
 * day is carried over untouched — re-running a date can never disturb the
 * record of any other date.
 */
export function mergeManifest(
  manifest: ArchiveManifest,
  date: string,
  dayEntry: DayManifestEntry,
  nowIso: string,
): ArchiveManifest {
  if (!isArchiveDate(date)) {
    throw new Error(`Invalid archive date: ${JSON.stringify(date)} (expected YYYY-MM-DD)`)
  }
  return {
    version: ARCHIVE_SCHEMA_VERSION,
    updated_at: nowIso,
    days: { ...manifest.days, [date]: dayEntry },
  }
}

export function parseManifest(raw: string, nowIso: string): ArchiveManifest {
  const trimmed = raw.trim()
  if (trimmed === '') return emptyManifest(nowIso)
  const parsed = JSON.parse(trimmed) as Partial<ArchiveManifest>
  if (typeof parsed !== 'object' || parsed === null || typeof parsed.days !== 'object' || parsed.days === null) {
    throw new Error('Archive manifest is corrupt: missing "days" object')
  }
  return {
    version: ARCHIVE_SCHEMA_VERSION,
    updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : nowIso,
    days: parsed.days as Record<string, DayManifestEntry>,
  }
}

/**
 * Drive a keyset (cursor) paginated fetch to completion.
 *
 * Offset paging (LIMIT n OFFSET m) re-scans and re-sorts the whole matching
 * set for every page; on the dated fact tables (millions of rows) that is
 * what timed out Archive Snapshot run #1 (Nov 6, 2026). Keyset paging —
 * `WHERE key > <last key of the previous page> ORDER BY key LIMIT n` — makes
 * every page a bounded index range scan of at most pageSize rows, however
 * deep into the set it is. For a stable total order the row sequence (and
 * therefore the archived bytes) is identical to offset paging.
 *
 * `fetchPage(null)` must return the first page; later calls receive the
 * cursor produced by `cursorAfter` for the previous page. Fetching stops at
 * the first short page (an exactly-full final page costs one extra fetch,
 * which returns zero rows). If a full page's cursor does not advance, the
 * source is ignoring the cursor — throw rather than loop forever.
 */
export async function collectKeysetPages<T, C>(
  pageSize: number,
  fetchPage: (cursor: C | null) => Promise<readonly T[]>,
  cursorAfter: (page: readonly T[]) => C,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`pageSize must be a positive integer, got ${pageSize}`)
  }
  const all: T[] = []
  let cursor: C | null = null
  for (;;) {
    const page = await fetchPage(cursor)
    all.push(...page)
    if (page.length < pageSize) return all
    const next = cursorAfter(page)
    if (cursor !== null && JSON.stringify(next) === JSON.stringify(cursor)) {
      throw new Error('Keyset cursor failed to advance — the page source is ignoring the cursor')
    }
    cursor = next
  }
}

/** Cursor after a page of id-ordered rows: the last row's id. */
export function idCursorAfter(rows: readonly Record<string, unknown>[]): string {
  return String(rows[rows.length - 1].id)
}

/** Position in the model_metrics series: the (snapshot_date, model_key) primary key. */
export interface ModelMetricsCursor {
  snapshotDate: string
  modelKey: string
}

/** Cursor after a page of model_metrics rows ordered by (snapshot_date, model_key). */
export function modelCursorAfter(rows: readonly Record<string, unknown>[]): ModelMetricsCursor {
  const last = rows[rows.length - 1]
  return { snapshotDate: String(last.snapshot_date), modelKey: String(last.model_key) }
}

/**
 * PostgREST `or` filter selecting model_metrics rows strictly after the
 * cursor in (snapshot_date, model_key) order:
 * a later date, or the same date with a greater model key.
 */
export function modelCursorOrFilter(cursor: ModelMetricsCursor): string {
  const key = cursor.modelKey.replace(/"/g, '')
  return `snapshot_date.gt.${cursor.snapshotDate},and(snapshot_date.eq.${cursor.snapshotDate},model_key.gt."${key}")`
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Dates strictly between the first and last recorded days that have no entry.
 * Days before the archive started (or after its latest entry) are not gaps —
 * the archive cannot be blamed for existing before it existed.
 */
export function findMissingDates(manifest: ArchiveManifest): string[] {
  const recorded = Object.keys(manifest.days).filter(isArchiveDate).sort()
  if (recorded.length < 2) return []
  const present = new Set(recorded)
  const missing: string[] = []
  let cursor = recorded[0]
  const last = recorded[recorded.length - 1]
  while (cursor < last) {
    cursor = nextDay(cursor)
    if (cursor < last && !present.has(cursor)) missing.push(cursor)
  }
  return missing
}
