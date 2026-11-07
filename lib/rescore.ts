// Early Signal Score recompute — score-only refresh for existing enrichments.
//
// Why this exists: enrichments.scored_at only advanced when the nightly pipeline
// happened to rediscover a repo, so by Nov 2026 ~90% of the 11,643 scores were
// more than 30 days old even though the underlying snapshots were fresh. This
// module recomputes every score from the same inputs the pipeline uses
// (repo_snapshots, weekly_stats, HN Algolia mentions) without calling Claude —
// summaries and categories are carried through unchanged. Repos whose score
// moves by more than 10 points are reported as "big movers"; refreshing their
// summary text stays with the pipeline's normal enrichment pass.
//
// Used by scripts/rescore-enrichments.ts (standalone sweep) and by the nightly
// pipeline (Phase 2d, stalest-first with a per-run limit) so scores stay fresh
// continuously instead of decaying between one-off sweeps.

import { calculateScore } from './score'
import { getHNMentions } from './hn'
import { createServiceClient } from './supabase'
import type { Database } from './database.types'

type DB = ReturnType<typeof createServiceClient>
type EnrichmentInsert = Database['public']['Tables']['enrichments']['Insert']

const PAGE_SIZE = 200
const DEFAULT_HN_CONCURRENCY = 8

export interface RescoreOptions {
  /** Max enrichments to process this run (stalest scored_at first). Default: all. */
  limit?: number
  /** Compute and report, but write nothing. */
  dryRun?: boolean
  hnConcurrency?: number
  log?: (msg: string) => void
}

export interface RescoreResult {
  processed: number
  updated: number
  bigMovers: number
  bigMoverLabels: string[]
  errors: number
}

interface EnrichmentRow {
  repo_id: string
  early_signal_score: number
  summary: string
  why_it_matters: string
  category: string
}

interface RepoRow {
  id: string
  owner: string
  name: string
  stars: number
  forks: number
  contributors: number
}

interface SnapshotRow {
  repo_id: string
  snapshot_date: string
  stars: number
  forks: number
  stars_7d: number
}

function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []

  function next() {
    if (queue.length > 0 && active < limit) {
      active++
      queue.shift()!()
    }
  }

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve))
    } else {
      active++
    }
    try {
      return await fn()
    } finally {
      active--
      next()
    }
  }
}

const isoDate = (d: Date): string => d.toISOString().split('T')[0]

export async function rescoreEnrichments(
  db: DB,
  opts: RescoreOptions = {}
): Promise<RescoreResult> {
  const log = opts.log ?? ((msg: string) => console.log(msg))
  const limit = opts.limit ?? Number.POSITIVE_INFINITY
  const dryRun = opts.dryRun ?? false
  const hnLimiter = createLimiter(opts.hnConcurrency ?? DEFAULT_HN_CONCURRENCY)

  const runStart = new Date()
  const runStartIso = runStart.toISOString()

  const today = new Date()
  const date7dAgo = new Date(today)
  date7dAgo.setDate(today.getDate() - 7)
  const date14dAgo = new Date(today)
  date14dAgo.setDate(today.getDate() - 14)
  const date30dAgo = new Date(today)
  date30dAgo.setDate(today.getDate() - 30)
  const date31dAgo = new Date(today)
  date31dAgo.setDate(today.getDate() - 31)
  const str7d = isoDate(date7dAgo)
  const str14d = isoDate(date14dAgo)
  const str30d = isoDate(date30dAgo)

  // Latest weekly_stats date (commits input), resolved once per run
  const { data: latestWeeklyRows } = await db
    .from('weekly_stats')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
  const weeklyDate = (latestWeeklyRows?.[0] as unknown as { snapshot_date: string } | undefined)
    ?.snapshot_date

  const result: RescoreResult = {
    processed: 0,
    updated: 0,
    bigMovers: 0,
    bigMoverLabels: [],
    errors: 0,
  }
  const attempted = new Set<string>()
  let dryRunOffset = 0

  while (result.processed < limit) {
    const pageSize = Math.min(PAGE_SIZE, limit - result.processed)

    // Write mode: rows already rescored this run have scored_at >= runStart and
    // drop out of the filter, so page 0 is always the stalest remaining rows.
    // Dry-run writes nothing, so it pages by offset instead.
    let query = db
      .from('enrichments')
      .select('repo_id, early_signal_score, summary, why_it_matters, category')
      .order('scored_at', { ascending: true })
    query = dryRun
      ? query.range(dryRunOffset, dryRunOffset + pageSize - 1)
      : query.lt('scored_at', runStartIso).limit(pageSize)

    const { data: pageData, error: pageError } = await query
    if (pageError) {
      throw new Error(`rescore: failed to page enrichments: ${pageError.message}`)
    }
    const page = ((pageData ?? []) as unknown as EnrichmentRow[]).filter(
      (r) => !attempted.has(r.repo_id)
    )
    if (page.length === 0) break
    dryRunOffset += pageSize
    for (const r of page) attempted.add(r.repo_id)

    const repoIds = page.map((r) => r.repo_id)

    const [{ data: repoRows }, { data: snapRows }, { data: weeklyRows }] =
      await Promise.all([
        db
          .from('repos')
          .select('id, owner, name, stars, forks, contributors')
          .in('id', repoIds),
        db
          .from('repo_snapshots')
          .select('repo_id, snapshot_date, stars, forks, stars_7d')
          .in('repo_id', repoIds)
          .gte('snapshot_date', isoDate(date31dAgo)),
        weeklyDate
          ? db
              .from('weekly_stats')
              .select('repo_id, commit_count_4w')
              .in('repo_id', repoIds)
              .eq('snapshot_date', weeklyDate)
          : Promise.resolve({ data: [] as Array<{ repo_id: string; commit_count_4w: number }> }),
      ])

    const repoById = new Map<string, RepoRow>()
    for (const row of (repoRows ?? []) as unknown as RepoRow[]) {
      repoById.set(row.id, row)
    }

    const snapsByRepo = new Map<string, Map<string, SnapshotRow>>()
    const latestSnapByRepo = new Map<string, SnapshotRow>()
    for (const row of (snapRows ?? []) as unknown as SnapshotRow[]) {
      let byDate = snapsByRepo.get(row.repo_id)
      if (!byDate) {
        byDate = new Map()
        snapsByRepo.set(row.repo_id, byDate)
      }
      byDate.set(row.snapshot_date, row)
      const current = latestSnapByRepo.get(row.repo_id)
      if (!current || row.snapshot_date > current.snapshot_date) {
        latestSnapByRepo.set(row.repo_id, row)
      }
    }

    const commitsByRepo = new Map<string, number>()
    for (const row of (weeklyRows ?? []) as unknown as Array<{
      repo_id: string
      commit_count_4w: number
    }>) {
      commitsByRepo.set(row.repo_id, row.commit_count_4w)
    }

    // Score the page (HN lookups are the only network calls — no GitHub, no Claude)
    const updates: EnrichmentInsert[] = []

    await Promise.all(
      page.map((enrichment) =>
        hnLimiter(async () => {
          const repo = repoById.get(enrichment.repo_id)
          if (!repo) {
            result.errors++
            return
          }
          try {
            const byDate = snapsByRepo.get(repo.id)
            const snap7d = byDate?.get(str7d)
            const snap14d = byDate?.get(str14d)
            const snap30d = byDate?.get(str30d)
            const latestSnap = latestSnapByRepo.get(repo.id)

            const stars_7d =
              latestSnap?.stars_7d ?? (snap7d ? repo.stars - snap7d.stars : 0)
            const stars_30d = snap30d ? repo.stars - snap30d.stars : 0
            const forks_7d = snap7d ? repo.forks - snap7d.forks : undefined
            const forks_7d_prev =
              snap7d && snap14d ? snap7d.forks - snap14d.forks : undefined
            const stars_7d_prev = snap7d?.stars_7d

            const hnMentions = await getHNMentions(repo.owner, repo.name)

            const { score, breakdown } = calculateScore({
              stars: repo.stars,
              stars_7d,
              stars_30d,
              contributors: repo.contributors ?? 0,
              forks: repo.forks,
              hn_mentions_7d: hnMentions.mentions_7d,
              hn_mentions_30d: hnMentions.mentions_30d,
              commits_30d: commitsByRepo.get(repo.id) ?? 0,
              stars_7d_prev: stars_7d_prev ?? undefined,
              forks_7d: forks_7d != null && forks_7d >= 0 ? forks_7d : undefined,
              forks_7d_prev:
                forks_7d_prev != null && forks_7d_prev >= 0 ? forks_7d_prev : undefined,
            })

            if (Math.abs(score - enrichment.early_signal_score) > 10) {
              result.bigMovers++
              if (result.bigMoverLabels.length < 25) {
                result.bigMoverLabels.push(
                  `${repo.owner}/${repo.name} (${enrichment.early_signal_score} → ${score})`
                )
              }
            }

            updates.push({
              repo_id: enrichment.repo_id,
              summary: enrichment.summary,
              why_it_matters: enrichment.why_it_matters,
              category: enrichment.category,
              early_signal_score: score,
              score_breakdown: JSON.parse(JSON.stringify(breakdown)),
              scored_at: new Date().toISOString(),
            })
          } catch (err) {
            result.errors++
            log(
              `  rescore failed for ${repo.owner}/${repo.name}: ${err instanceof Error ? err.message : String(err)}`
            )
          }
        })
      )
    )

    result.processed += page.length

    if (!dryRun && updates.length > 0) {
      const { error: upsertError } = await db
        .from('enrichments')
        .upsert(updates, { onConflict: 'repo_id' })
      if (upsertError) {
        result.errors += updates.length
        log(`  rescore upsert failed for page of ${updates.length}: ${upsertError.message}`)
      } else {
        result.updated += updates.length
      }
    }

    log(
      `  rescore: ${result.processed} processed (${result.updated} updated, ${result.bigMovers} big movers, ${result.errors} errors)`
    )

    if (page.length < pageSize) break
  }

  return result
}
