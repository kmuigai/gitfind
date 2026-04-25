// Anomaly Watcher — daily detector pass
// Scans recent GitFind data for 4 kinds of "this is unusual" events:
//   1. stars_breakout         — stars_7d well above this repo's recent baseline
//   2. downloads_accel        — package downloads_7d well above 30d-extrapolated baseline
//   3. maintainer_silent      — weekly commit count collapsed vs prior week
//   4. release_cadence_shift  — repo with regular release rhythm has gone quiet
//
// Then asks Claude to write a one-sentence "why this matters" for the top 5
// most severe new anomalies, and writes everything to the `anomalies` table.
//
// Run locally: npx tsx scripts/detect-anomalies.ts
// Dry run:    npx tsx scripts/detect-anomalies.ts --dry-run
// Daily cron: see .github/workflows/anomaly-watcher.yml
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import { config } from 'dotenv'
config({ path: '.env.local' })

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, AnomalyType } from '../lib/database.types.js'

type ServiceClient = SupabaseClient<Database>

const COOLDOWN_DAYS = 7
const TOP_N_FOR_NARRATIVE = 5
const NARRATIVE_MAX_CHARS = 120
const DRY_RUN = process.argv.includes('--dry-run')

// Tunable thresholds. Phase 1 starts loose; tighten after a week of feedback.
const STARS_BREAKOUT = {
  candidatePoolSize: 300,
  historyDays: 14,
  minHistoryDays: 7,
  minTodayStars7d: 50,
  ratioThreshold: 3.0,
}
const DOWNLOADS_ACCEL = {
  minDownloads30d: 1000,
  ratioThreshold: 2.0,
}
const MAINTAINER_SILENT = {
  minPriorCommits: 20,
  ratioThreshold: 0.3, // latest <30% of prior
  weeklyHistoryDays: 21,
}
const RELEASE_PAUSE = {
  minDaysSinceLastRelease: 60,
  minHistoricalReleases: 3,
  maxHistoricalIntervalDays: 30,
  weeklyHistoryDays: 365,
}

interface DetectedAnomaly {
  repo_id: string
  type: AnomalyType
  severity: number
  metadata: Record<string, number | string | null>
}

interface RepoLite {
  id: string
  owner: string
  name: string
}

interface EnrichmentLite {
  repo_id: string
  summary: string
  why_it_matters: string
  category: string
}

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${ts}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

function cap(value: number, max: number): number {
  return value > max ? max : value
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
}

async function loadEnrichedRepoIds(db: ServiceClient): Promise<Set<string>> {
  const rows: Array<{ repo_id: string }> = []
  let offset = 0
  while (true) {
    const { data } = await db
      .from('enrichments')
      .select('repo_id')
      .range(offset, offset + 999)
    const typed = (data ?? []) as unknown as Array<{ repo_id: string }>
    rows.push(...typed)
    if (typed.length < 1000) break
    offset += 1000
  }
  return new Set(rows.map((r) => r.repo_id))
}

// ================== DETECTORS ==================

async function detectStarsBreakout(
  db: ServiceClient,
  enrichedIds: Set<string>,
): Promise<DetectedAnomaly[]> {
  const { data: latest } = await db
    .from('repo_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
  const latestRow = (latest ?? []) as unknown as Array<{ snapshot_date: string }>
  if (latestRow.length === 0) {
    log('stars_breakout: no snapshots found')
    return []
  }
  const latestDate = latestRow[0].snapshot_date

  // Top candidates by today's stars_7d.
  const { data: candidates } = await db
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', latestDate)
    .gte('stars_7d', STARS_BREAKOUT.minTodayStars7d)
    .order('stars_7d', { ascending: false })
    .limit(STARS_BREAKOUT.candidatePoolSize)

  const typedCandidates = (candidates ?? []) as unknown as Array<{ repo_id: string; stars_7d: number }>
  const eligible = typedCandidates.filter((c) => enrichedIds.has(c.repo_id))
  if (eligible.length === 0) return []

  // Pull last `historyDays` of snapshots for those candidates.
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - STARS_BREAKOUT.historyDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const candidateIds = eligible.map((e) => e.repo_id)

  const history: Array<{ repo_id: string; snapshot_date: string; stars_7d: number }> = []
  for (let i = 0; i < candidateIds.length; i += 100) {
    const batch = candidateIds.slice(i, i + 100)
    const { data } = await db
      .from('repo_snapshots')
      .select('repo_id, snapshot_date, stars_7d')
      .in('repo_id', batch)
      .gte('snapshot_date', cutoffStr)
      .lt('snapshot_date', latestDate)
    history.push(...((data ?? []) as unknown as typeof history))
  }

  const byRepo = new Map<string, number[]>()
  for (const row of history) {
    const arr = byRepo.get(row.repo_id) ?? []
    arr.push(row.stars_7d)
    byRepo.set(row.repo_id, arr)
  }

  const out: DetectedAnomaly[] = []
  for (const cand of eligible) {
    const prior = byRepo.get(cand.repo_id) ?? []
    if (prior.length < STARS_BREAKOUT.minHistoryDays) continue
    const mean = prior.reduce((s, n) => s + n, 0) / prior.length
    if (mean <= 0) continue
    const ratio = cand.stars_7d / mean
    if (ratio < STARS_BREAKOUT.ratioThreshold) continue
    out.push({
      repo_id: cand.repo_id,
      type: 'stars_breakout',
      severity: Math.round(cap(ratio * 25, 100) * 10) / 10,
      metadata: {
        today_stars_7d: cand.stars_7d,
        baseline_mean: Math.round(mean * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        history_days: prior.length,
      },
    })
  }
  log(`stars_breakout: ${out.length} candidates after ratio filter`)
  return out
}

async function detectDownloadsAccel(
  db: ServiceClient,
  enrichedIds: Set<string>,
): Promise<DetectedAnomaly[]> {
  const { data: latest } = await db
    .from('package_downloads')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
  const latestRow = (latest ?? []) as unknown as Array<{ snapshot_date: string }>
  if (latestRow.length === 0) {
    log('downloads_accel: no package_downloads found')
    return []
  }
  const latestDate = latestRow[0].snapshot_date

  const all: Array<{
    repo_id: string
    package_name: string
    registry: string
    downloads_7d: number
    downloads_30d: number
  }> = []
  let offset = 0
  while (true) {
    const { data } = await db
      .from('package_downloads')
      .select('repo_id, package_name, registry, downloads_7d, downloads_30d')
      .eq('snapshot_date', latestDate)
      .gte('downloads_30d', DOWNLOADS_ACCEL.minDownloads30d)
      .range(offset, offset + 999)
    const typed = (data ?? []) as unknown as typeof all
    all.push(...typed)
    if (typed.length < 1000) break
    offset += 1000
  }

  const out: DetectedAnomaly[] = []
  for (const row of all) {
    if (!enrichedIds.has(row.repo_id)) continue
    const baseline7d = (row.downloads_30d / 30) * 7
    if (baseline7d <= 0) continue
    const ratio = row.downloads_7d / baseline7d
    if (ratio < DOWNLOADS_ACCEL.ratioThreshold) continue
    out.push({
      repo_id: row.repo_id,
      type: 'downloads_accel',
      severity: Math.round(cap(ratio * 25, 100) * 10) / 10,
      metadata: {
        package: `${row.registry}:${row.package_name}`,
        downloads_7d: row.downloads_7d,
        baseline_7d: Math.round(baseline7d),
        ratio: Math.round(ratio * 100) / 100,
      },
    })
  }
  log(`downloads_accel: ${out.length} candidates after ratio filter`)
  return out
}

async function detectMaintainerSilent(
  db: ServiceClient,
  enrichedIds: Set<string>,
): Promise<DetectedAnomaly[]> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - MAINTAINER_SILENT.weeklyHistoryDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const all: Array<{ repo_id: string; snapshot_date: string; commit_count_4w: number }> = []
  let offset = 0
  while (true) {
    const { data } = await db
      .from('weekly_stats')
      .select('repo_id, snapshot_date, commit_count_4w')
      .gte('snapshot_date', cutoffStr)
      .order('snapshot_date', { ascending: false })
      .range(offset, offset + 999)
    const typed = (data ?? []) as unknown as typeof all
    all.push(...typed)
    if (typed.length < 1000) break
    offset += 1000
  }

  const byRepo = new Map<string, Array<{ snapshot_date: string; commit_count_4w: number }>>()
  for (const row of all) {
    if (!enrichedIds.has(row.repo_id)) continue
    const arr = byRepo.get(row.repo_id) ?? []
    arr.push({ snapshot_date: row.snapshot_date, commit_count_4w: row.commit_count_4w })
    byRepo.set(row.repo_id, arr)
  }

  const out: DetectedAnomaly[] = []
  for (const [repo_id, rows] of byRepo) {
    if (rows.length < 2) continue
    const sorted = rows.sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))
    const latest = sorted[0]
    const prior = sorted[1]
    if (prior.commit_count_4w < MAINTAINER_SILENT.minPriorCommits) continue
    const ratio = latest.commit_count_4w / prior.commit_count_4w
    if (ratio >= MAINTAINER_SILENT.ratioThreshold) continue
    out.push({
      repo_id,
      type: 'maintainer_silent',
      severity: Math.round((1 - ratio) * 100 * 10) / 10,
      metadata: {
        latest_date: latest.snapshot_date,
        latest_commits_4w: latest.commit_count_4w,
        prior_date: prior.snapshot_date,
        prior_commits_4w: prior.commit_count_4w,
        ratio: Math.round(ratio * 100) / 100,
      },
    })
  }
  log(`maintainer_silent: ${out.length} candidates after ratio filter`)
  return out
}

async function detectReleaseCadenceShift(
  db: ServiceClient,
  enrichedIds: Set<string>,
): Promise<DetectedAnomaly[]> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RELEASE_PAUSE.weeklyHistoryDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const all: Array<{ repo_id: string; snapshot_date: string; last_release_date: string | null }> = []
  let offset = 0
  while (true) {
    const { data } = await db
      .from('weekly_stats')
      .select('repo_id, snapshot_date, last_release_date')
      .gte('snapshot_date', cutoffStr)
      .not('last_release_date', 'is', null)
      .order('snapshot_date', { ascending: false })
      .range(offset, offset + 999)
    const typed = (data ?? []) as unknown as typeof all
    all.push(...typed)
    if (typed.length < 1000) break
    offset += 1000
  }

  const byRepo = new Map<string, Array<{ snapshot_date: string; last_release_date: string }>>()
  for (const row of all) {
    if (!enrichedIds.has(row.repo_id)) continue
    if (!row.last_release_date) continue
    const arr = byRepo.get(row.repo_id) ?? []
    arr.push({ snapshot_date: row.snapshot_date, last_release_date: row.last_release_date })
    byRepo.set(row.repo_id, arr)
  }

  const today = new Date()
  const out: DetectedAnomaly[] = []
  for (const [repo_id, rows] of byRepo) {
    const uniqueReleases = Array.from(new Set(rows.map((r) => r.last_release_date)))
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime())
    if (uniqueReleases.length < RELEASE_PAUSE.minHistoricalReleases) continue
    const mostRecent = uniqueReleases[0]
    const daysSince = daysBetween(today, mostRecent)
    if (daysSince < RELEASE_PAUSE.minDaysSinceLastRelease) continue
    let regularIntervals = 0
    for (let i = 0; i < uniqueReleases.length - 1; i++) {
      const interval = daysBetween(uniqueReleases[i], uniqueReleases[i + 1])
      if (interval > 0 && interval <= RELEASE_PAUSE.maxHistoricalIntervalDays) regularIntervals++
    }
    if (regularIntervals < RELEASE_PAUSE.minHistoricalReleases - 1) continue
    out.push({
      repo_id,
      type: 'release_cadence_shift',
      severity: Math.round(cap(daysSince - RELEASE_PAUSE.minDaysSinceLastRelease, 100) * 10) / 10,
      metadata: {
        days_since_last_release: Math.round(daysSince),
        last_release_date: mostRecent.toISOString().slice(0, 10),
        prior_regular_intervals: regularIntervals,
        history_releases: uniqueReleases.length,
      },
    })
  }
  log(`release_cadence_shift: ${out.length} candidates after pause filter`)
  return out
}

// ================== COOLDOWN + INSERT ==================

async function filterByCooldown(
  db: ServiceClient,
  candidates: DetectedAnomaly[],
): Promise<DetectedAnomaly[]> {
  if (candidates.length === 0) return []
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - COOLDOWN_DAYS)
  const cutoffIso = cutoff.toISOString()

  const candidateRepoIds = Array.from(new Set(candidates.map((c) => c.repo_id)))
  const recent: Array<{ repo_id: string; type: AnomalyType }> = []
  for (let i = 0; i < candidateRepoIds.length; i += 100) {
    const batch = candidateRepoIds.slice(i, i + 100)
    const { data } = await db
      .from('anomalies')
      .select('repo_id, type')
      .in('repo_id', batch)
      .gte('detected_at', cutoffIso)
    recent.push(...((data ?? []) as unknown as typeof recent))
  }
  const blocked = new Set(recent.map((r) => `${r.repo_id}|${r.type}`))
  const fresh = candidates.filter((c) => !blocked.has(`${c.repo_id}|${c.type}`))
  log(`cooldown: ${candidates.length} candidates → ${fresh.length} fresh (${candidates.length - fresh.length} blocked)`)
  return fresh
}

async function insertAnomalies(
  db: ServiceClient,
  fresh: DetectedAnomaly[],
): Promise<Array<{ id: string; repo_id: string; severity: number }>> {
  if (fresh.length === 0) return []
  const { data, error } = await db
    .from('anomalies')
    .insert(
      fresh.map((f) => ({
        repo_id: f.repo_id,
        type: f.type,
        severity: f.severity,
        metadata: f.metadata,
      })),
    )
    .select('id, repo_id, severity')
  if (error) {
    logError('insert failed', error)
    return []
  }
  return (data ?? []) as unknown as Array<{ id: string; repo_id: string; severity: number }>
}

// ================== NARRATIVE ==================

interface NarrativeInput {
  anomaly_id: string
  repo: RepoLite
  enrichment: EnrichmentLite
  type: AnomalyType
  metadata: Record<string, number | string | null>
}

function buildNarrativePrompt(items: NarrativeInput[]): string {
  const blocks = items
    .map((it, i) => {
      const meta = Object.entries(it.metadata)
        .map(([k, v]) => `   ${k}: ${v}`)
        .join('\n')
      return `Anomaly ${i + 1}: ${it.repo.owner}/${it.repo.name}
- Detector: ${it.type}
- What it does: ${it.enrichment.summary}
- Why it matters (general): ${it.enrichment.why_it_matters}
- Detector readings:
${meta}`
    })
    .join('\n\n')

  return `You are writing one-sentence explanations for anomalies surfaced by GitFind's daily watcher. The reader is a non-technical builder/founder. They need to know in 5 seconds whether to look closer.

${blocks}

For each anomaly, write ONE short sentence (max ${NARRATIVE_MAX_CHARS} chars) explaining why this is notable RIGHT NOW. Don't restate the numbers — explain the SO WHAT. Plain English, no jargon, no markdown.

Respond with valid JSON only, no fences or extra text. The "narratives" array MUST contain exactly ${items.length} items in the same order as the anomalies above (Anomaly 1 → narratives[0], Anomaly 2 → narratives[1], etc).

{"narratives": ["one sentence for Anomaly 1", "one sentence for Anomaly 2", ...]}`
}

async function narrateTopAnomalies(
  db: ServiceClient,
  inserted: Array<{ id: string; repo_id: string; severity: number }>,
  fresh: DetectedAnomaly[],
): Promise<void> {
  if (inserted.length === 0) return
  const top = inserted
    .slice()
    .sort((a, b) => b.severity - a.severity)
    .slice(0, TOP_N_FOR_NARRATIVE)

  const insertedToFresh = new Map<string, DetectedAnomaly>()
  for (const ins of top) {
    const match = fresh.find(
      (f) => f.repo_id === ins.repo_id && Math.abs(f.severity - ins.severity) < 0.05,
    )
    if (match) insertedToFresh.set(ins.id, match)
  }
  if (insertedToFresh.size === 0) return

  const repoIds = Array.from(new Set(top.map((t) => t.repo_id)))
  const [{ data: repos }, { data: enrichments }] = await Promise.all([
    db.from('repos').select('id, owner, name').in('id', repoIds),
    db.from('enrichments').select('repo_id, summary, why_it_matters, category').in('repo_id', repoIds),
  ])
  const repoMap = new Map(
    ((repos ?? []) as unknown as RepoLite[]).map((r) => [r.id, r]),
  )
  const enrichMap = new Map(
    ((enrichments ?? []) as unknown as EnrichmentLite[]).map((e) => [e.repo_id, e]),
  )

  const items: NarrativeInput[] = []
  for (const ins of top) {
    const repo = repoMap.get(ins.repo_id)
    const enrichment = enrichMap.get(ins.repo_id)
    const detected = insertedToFresh.get(ins.id)
    if (!repo || !enrichment || !detected) continue
    items.push({
      anomaly_id: ins.id,
      repo,
      enrichment,
      type: detected.type,
      metadata: detected.metadata,
    })
  }
  if (items.length === 0) return

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  log(`narrating ${items.length} anomalies with Claude...`)
  let parsed: { narratives: string[] }
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: buildNarrativePrompt(items) }],
    })
    const content = message.content[0]
    if (!content || content.type !== 'text') {
      log('narrator: unexpected response shape, skipping')
      return
    }
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch (err) {
    logError('narrator: Claude call or JSON parse failed', err)
    return
  }

  // Match by array position — items[i] corresponds to narratives[i].
  const pairs = items.slice(0, parsed.narratives?.length ?? 0).map((it, i) => ({
    anomaly_id: it.anomaly_id,
    narrative: parsed.narratives[i],
  }))

  let written = 0
  for (const p of pairs) {
    if (!p.narrative) continue
    const trimmed = p.narrative.length > NARRATIVE_MAX_CHARS + 20
      ? p.narrative.slice(0, NARRATIVE_MAX_CHARS).trim() + '…'
      : p.narrative
    const { error } = await db
      .from('anomalies')
      .update({ narrative: trimmed })
      .eq('id', p.anomaly_id)
    if (error) {
      logError(`narrator: update failed for ${p.anomaly_id}`, error)
      continue
    }
    written++
  }
  log(`narrator: wrote ${written} narratives`)
}

// ================== MAIN ==================

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  log('=== Anomaly Watcher Starting ===')
  if (DRY_RUN) log('DRY RUN — no writes will happen')

  const enrichedIds = await loadEnrichedRepoIds(db)
  log(`loaded ${enrichedIds.size} enriched repos`)
  if (enrichedIds.size === 0) {
    log('no enriched repos — nothing to do')
    return
  }

  const candidates: DetectedAnomaly[] = []
  candidates.push(...(await detectStarsBreakout(db, enrichedIds)))
  candidates.push(...(await detectDownloadsAccel(db, enrichedIds)))
  candidates.push(...(await detectMaintainerSilent(db, enrichedIds)))
  candidates.push(...(await detectReleaseCadenceShift(db, enrichedIds)))
  log(`total candidates across detectors: ${candidates.length}`)

  const fresh = await filterByCooldown(db, candidates)
  if (fresh.length === 0) {
    log('no fresh anomalies after cooldown — exiting')
    return
  }

  if (DRY_RUN) {
    log('--- DRY RUN preview ---')
    const top = fresh.slice().sort((a, b) => b.severity - a.severity).slice(0, 10)
    for (const f of top) {
      log(`  [${f.type} sev=${f.severity}] repo=${f.repo_id} ${JSON.stringify(f.metadata)}`)
    }
    return
  }

  const inserted = await insertAnomalies(db, fresh)
  log(`inserted ${inserted.length} anomalies`)

  await narrateTopAnomalies(db, inserted, fresh)
  log('=== Anomaly Watcher Complete ===')
}

main().catch((err) => {
  console.error('Anomaly Watcher failed:', err)
  process.exit(1)
})
