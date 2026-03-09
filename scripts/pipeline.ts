// GitFind Data Pipeline
// Discovers repos from GitHub Search, scores them using DB data, enriches with Claude.
//
// TWO-PASS ARCHITECTURE:
//   Pass 1 (Score): All discovered repos scored concurrently (DB + HN only, no GitHub REST)
//   Pass 2 (Enrich): Top N unenriched repos by score, concurrently (README + Claude)
//
// Run locally: npx tsx scripts/pipeline.ts
// Run nightly: GitHub Actions cron (see .github/workflows/pipeline.yml)
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, ANTHROPIC_API_KEY

import { config } from 'dotenv'
config({ path: '.env.local' })

const CATEGORY_SLUGS = [
  'ai-ml',
  'developer-tools',
  'security',
  'data-analytics',
  'web-frameworks',
  'infrastructure-devops',
  'mobile',
  'open-source-utilities',
] as const

type CategorySlug = (typeof CATEGORY_SLUGS)[number]

const CATEGORY_NAMES: Record<CategorySlug, string> = {
  'ai-ml': 'AI / Machine Learning',
  'developer-tools': 'Developer Tools',
  'security': 'Security',
  'data-analytics': 'Data & Analytics',
  'web-frameworks': 'Web Frameworks',
  'infrastructure-devops': 'Infrastructure & DevOps',
  'mobile': 'Mobile',
  'open-source-utilities': 'Open Source Utilities',
}

// ── Tuning constants ──
const SCORE_CONCURRENCY = 10
const ENRICH_CONCURRENCY = 5
const MAX_ENRICHMENTS_PER_RUN = 50

// ── Concurrency limiter (async semaphore, no external deps) ──
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

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

async function main(): Promise<void> {
  // Dynamic imports — evaluated after dotenv.config() has run
  const [
    { searchReposByCategory, searchTrendingMidTier, searchMidHighRepos, searchNewbornRockets, searchHighStarRepos, getReadme, cleanReadme, detectPackageName },
    { calculateScore },
    { getHNMentions },
    { enrichRepo },
    { createServiceClient },
  ] = await Promise.all([
    import('../lib/github.js'),
    import('../lib/score.js'),
    import('../lib/hn.js'),
    import('../lib/enrichment.js'),
    import('../lib/supabase.js'),
  ])

  type Repo = Awaited<ReturnType<typeof searchReposByCategory>>[number]
  type DB = ReturnType<typeof createServiceClient>

  interface ScoreResult {
    repoId: string
    label: string
    score: number
    breakdown: ReturnType<typeof calculateScore>['breakdown']
    repoData: Repo
    contributorCount: number
  }

  let skippedStale = 0
  let scored = 0
  let enriched = 0

  // ── Pass 1: Score a single repo ──
  async function scoreRepo(db: DB, repoData: Repo): Promise<ScoreResult | null> {
    const { owner, name: repoName, github_id } = repoData
    const label = `${owner}/${repoName}`

    try {
      // ── Stale skip: batch the existence + snapshot + enrichment checks ──
      const { data: existingRepo } = await db
        .from('repos')
        .select('id, stars, contributors')
        .eq('github_id', github_id)
        .maybeSingle()

      if (existingRepo) {
        const [{ data: lastSnap }, { data: hasEnrichment }] = await Promise.all([
          db.from('repo_snapshots')
            .select('stars, forks, stars_7d, snapshot_date')
            .eq('repo_id', existingRepo.id)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          db.from('enrichments')
            .select('id')
            .eq('repo_id', existingRepo.id)
            .maybeSingle(),
        ])

        if (lastSnap && hasEnrichment && lastSnap.stars === repoData.stars) {
          const todayStr = new Date().toISOString().split('T')[0]
          if (lastSnap.snapshot_date !== todayStr) {
            await db.from('repo_snapshots').upsert(
              {
                repo_id: existingRepo.id,
                snapshot_date: todayStr,
                stars: repoData.stars,
                forks: repoData.forks,
                stars_7d: lastSnap.stars_7d,
              },
              { onConflict: 'repo_id,snapshot_date', ignoreDuplicates: true }
            )
          }
          await db.from('repos').update({
            description: repoData.description,
            forks: repoData.forks,
            language: repoData.language,
            updated_at: new Date().toISOString(),
          }).eq('id', existingRepo.id)

          log(`  ${label} → stale skip (stars unchanged at ${repoData.stars.toLocaleString()})`)
          skippedStale++
          return null
        }
      }

      // ── Full scoring: repo is new or stars changed ──
      log(`  Scoring ${label}...`)

      const { data: upsertedRepo, error: repoError } = await db
        .from('repos')
        .upsert(
          {
            github_id,
            name: repoName,
            owner,
            description: repoData.description,
            stars: repoData.stars,
            forks: repoData.forks,
            language: repoData.language,
            url: repoData.url,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'github_id' }
        )
        .select('id, contributors')
        .single()

      if (repoError || !upsertedRepo) {
        logError(`Failed to upsert repo ${label}`, repoError)
        return null
      }

      const repoId = upsertedRepo.id

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const date7dAgo = new Date(today)
      date7dAgo.setDate(today.getDate() - 7)
      const date14dAgo = new Date(today)
      date14dAgo.setDate(today.getDate() - 14)
      const date30dAgo = new Date(today)
      date30dAgo.setDate(today.getDate() - 30)

      // Parallel DB reads + HN mentions + package detection
      const [
        { data: snap7d },
        { data: snap14d },
        { data: snap30d },
        { data: latestSnap },
        { data: weeklyStats },
        hnMentions,
        { data: repoRow },
      ] = await Promise.all([
        db.from('repo_snapshots')
          .select('stars, stars_7d, forks')
          .eq('repo_id', repoId)
          .eq('snapshot_date', date7dAgo.toISOString().split('T')[0])
          .maybeSingle(),
        db.from('repo_snapshots')
          .select('stars_7d, forks')
          .eq('repo_id', repoId)
          .eq('snapshot_date', date14dAgo.toISOString().split('T')[0])
          .maybeSingle(),
        db.from('repo_snapshots')
          .select('stars')
          .eq('repo_id', repoId)
          .eq('snapshot_date', date30dAgo.toISOString().split('T')[0])
          .maybeSingle(),
        db.from('repo_snapshots')
          .select('stars_7d')
          .eq('repo_id', repoId)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db.from('weekly_stats')
          .select('commit_count_4w')
          .eq('repo_id', repoId)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        getHNMentions(owner, repoName),
        db.from('repos')
          .select('package_registry')
          .eq('id', repoId)
          .single(),
      ])

      // Package detection (one-time, 1-3 GitHub REST calls)
      if (repoRow && !(repoRow as unknown as { package_registry: string | null }).package_registry) {
        const pkg = await detectPackageName(owner, repoName, repoData.language)
        if (pkg) {
          await db
            .from('repos')
            .update({ package_registry: pkg.registry, package_name: pkg.name })
            .eq('id', repoId)
          log(`  ${label} → package detected: ${pkg.registry}/${pkg.name}`)
        }
      }

      // Derive scoring inputs
      const stars_7d = latestSnap?.stars_7d
        ?? (snap7d ? repoData.stars - (snap7d.stars as number) : 0)
      const stars_30d = snap30d ? repoData.stars - (snap30d.stars as number) : 0
      const contributorCount = (upsertedRepo.contributors as number) ?? 0
      const commits_30d = (weeklyStats?.commit_count_4w as number) ?? 0
      const forks_7d = snap7d ? repoData.forks - (snap7d.forks as number) : undefined
      const forks_7d_prev = (snap7d && snap14d) ? (snap7d.forks as number) - (snap14d.forks as number) : undefined
      const stars_7d_prev = snap7d ? (snap7d.stars_7d as number) : undefined

      const { score, breakdown } = calculateScore({
        stars: repoData.stars,
        stars_7d,
        stars_30d,
        contributors: contributorCount,
        forks: repoData.forks,
        hn_mentions_7d: hnMentions.mentions_7d,
        hn_mentions_30d: hnMentions.mentions_30d,
        commits_30d,
        stars_7d_prev: stars_7d_prev ?? undefined,
        forks_7d: forks_7d != null && forks_7d >= 0 ? forks_7d : undefined,
        forks_7d_prev: forks_7d_prev != null && forks_7d_prev >= 0 ? forks_7d_prev : undefined,
      })

      // Insert today's snapshot
      const { error: snapError } = await db.from('repo_snapshots').upsert(
        {
          repo_id: repoId,
          snapshot_date: todayStr,
          stars: repoData.stars,
          forks: repoData.forks,
          stars_7d,
        },
        { onConflict: 'repo_id,snapshot_date', ignoreDuplicates: true }
      )
      if (snapError) {
        logError(`Failed to insert snapshot for ${label}`, snapError)
      }

      // Check if enrichment exists and is still fresh
      const { data: existing } = await db
        .from('enrichments')
        .select('early_signal_score')
        .eq('repo_id', repoId)
        .maybeSingle()

      const needsEnrichment =
        !existing || Math.abs(existing.early_signal_score - score) > 10

      if (needsEnrichment) {
        log(`  ${label} → score: ${score} (needs enrichment)`)
        scored++
        return { repoId, label, score, breakdown, repoData, contributorCount }
      } else {
        // Update score on existing enrichment
        await db
          .from('enrichments')
          .update({
            early_signal_score: score,
            score_breakdown: JSON.parse(JSON.stringify(breakdown)),
            scored_at: new Date().toISOString(),
          })
          .eq('repo_id', repoId)
        log(`  ${label} → score: ${score} (updated, no re-enrichment needed)`)
        scored++
        return null
      }
    } catch (err) {
      logError(`Failed to score ${label}`, err)
      return null
    }
  }

  // ── Pass 2: Enrich a single repo ──
  async function enrichRepoPass(db: DB, item: ScoreResult): Promise<void> {
    const { repoId, label, score, breakdown, repoData, contributorCount } = item
    const { owner, name: repoName, github_id } = repoData

    try {
      const rawReadme = await getReadme(owner, repoName)
      const readmeExcerpt = rawReadme ? cleanReadme(rawReadme) : undefined

      log(`  Enriching ${label} with Claude...`)
      await enrichRepo(repoId, {
        github_id,
        name: repoName,
        owner,
        description: repoData.description,
        stars: repoData.stars,
        forks: repoData.forks,
        contributors: contributorCount,
        language: repoData.language,
        topics: repoData.topics,
        readme_excerpt: readmeExcerpt || undefined,
      }, score, breakdown, true) // forceRefresh=true — we already checked
      log(`  ${label} enriched ✓`)
      enriched++
    } catch (err) {
      logError(`Failed to enrich ${label}`, err)
    }
  }

  log('=== GitFind Pipeline Starting ===')

  const db = createServiceClient()
  let totalErrors = 0

  // ── Phase 1: Discovery ──────────────────────────────────────────────
  const discovered = new Map<number, Repo>()
  const discoveryStartedAt = Date.now()

  // Layer 1: Category search
  log('\n── Layer 1: Category Search ──')
  for (const categorySlug of CATEGORY_SLUGS) {
    const categoryName = CATEGORY_NAMES[categorySlug]
    try {
      const repos = await searchReposByCategory(categorySlug)
      for (const repo of repos) {
        if (!discovered.has(repo.github_id)) discovered.set(repo.github_id, repo)
      }
      log(`  ${categoryName}: ${repos.length} repos`)
    } catch (err) {
      logError(`Failed to fetch repos for ${categoryName}`, err)
      totalErrors++
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`Layer 1 total: ${discovered.size} unique repos`)

  // Layer 2: Mid-tier velocity hunters
  log('\n── Layer 2: Mid-Tier Velocity Hunters ──')
  try {
    const midTier = await searchTrendingMidTier()
    let added = 0
    for (const repo of midTier) {
      if (!discovered.has(repo.github_id)) {
        discovered.set(repo.github_id, repo)
        added++
      }
    }
    log(`Layer 2: ${midTier.length} found, ${added} new (${discovered.size} total unique)`)
  } catch (err) {
    logError('Layer 2 failed', err)
    totalErrors++
  }

  // Rate limit gate: Layers 1+2 used ~30 search requests. Wait for the 30-req/min window to reset.
  const elapsedMs = Date.now() - discoveryStartedAt
  const waitMs = Math.max(0, 62_000 - elapsedMs)
  if (waitMs > 0) {
    log(`Waiting ${Math.ceil(waitMs / 1000)}s for search rate limit window...`)
    await new Promise((r) => setTimeout(r, waitMs))
  } else {
    log('Search rate limit window already cleared, continuing...')
  }

  // Layer 2.5: Mid-high repos (10k–100k stars, pushed recently)
  log('\n── Layer 2.5: Mid-High Active Repos ──')
  try {
    const midHigh = await searchMidHighRepos()
    let added = 0
    for (const repo of midHigh) {
      if (!discovered.has(repo.github_id)) {
        discovered.set(repo.github_id, repo)
        added++
      }
    }
    log(`Layer 2.5: ${midHigh.length} found, ${added} new (${discovered.size} total unique)`)
  } catch (err) {
    logError('Layer 2.5 failed', err)
    totalErrors++
  }

  // Layer 3: Newborn rockets
  log('\n── Layer 3: Newborn Rockets ──')
  try {
    const newborn = await searchNewbornRockets()
    let added = 0
    for (const repo of newborn) {
      if (!discovered.has(repo.github_id)) {
        discovered.set(repo.github_id, repo)
        added++
      }
    }
    log(`Layer 3: ${newborn.length} found, ${added} new (${discovered.size} total unique)`)
  } catch (err) {
    logError('Layer 3 failed', err)
    totalErrors++
  }

  // Rate limit gate: Layers 2.5+3 used ~5 requests. Layer 4 needs 10. Wait for window reset.
  const elapsed2Ms = Date.now() - discoveryStartedAt
  const wait2Ms = Math.max(0, 124_000 - elapsed2Ms) // 2 full 62s windows from start
  if (wait2Ms > 0) {
    log(`Waiting ${Math.ceil(wait2Ms / 1000)}s for search rate limit window...`)
    await new Promise((r) => setTimeout(r, wait2Ms))
  } else {
    log('Search rate limit window already cleared, continuing...')
  }

  // Layer 4: High-star legends (established repos >10k stars)
  log('\n── Layer 4: High-Star Legends ──')
  try {
    const legends = await searchHighStarRepos()
    let added = 0
    for (const repo of legends) {
      if (!discovered.has(repo.github_id)) {
        discovered.set(repo.github_id, repo)
        added++
      }
    }
    log(`Layer 4: ${legends.length} found, ${added} new (${discovered.size} total unique)`)
  } catch (err) {
    logError('Layer 4 failed', err)
    totalErrors++
  }

  log(`\n── Discovery complete: ${discovered.size} unique repos ──`)

  // ── Phase 2a: Score all repos concurrently ────────────────────────────
  log('\n── Phase 2a: Scoring ──')
  const scoreLimiter = createLimiter(SCORE_CONCURRENCY)
  const repos = Array.from(discovered.values())

  const scoreResults = await Promise.all(
    repos.map((repo) => scoreLimiter(() => scoreRepo(db, repo)))
  )

  const enrichmentCandidates = scoreResults
    .filter((r): r is ScoreResult => r !== null)
    .sort((a, b) => b.score - a.score)

  log(`\n── Scoring complete: ${scored} scored, ${skippedStale} stale-skipped, ${enrichmentCandidates.length} need enrichment ──`)

  // ── Phase 2b: Enrich top N by score ───────────────────────────────────
  const toEnrich = enrichmentCandidates.slice(0, MAX_ENRICHMENTS_PER_RUN)
  log(`\n── Phase 2b: Enriching top ${toEnrich.length} repos (of ${enrichmentCandidates.length} candidates) ──`)

  if (toEnrich.length > 0) {
    const enrichLimiter = createLimiter(ENRICH_CONCURRENCY)
    await Promise.all(
      toEnrich.map((item) => enrichLimiter(() => enrichRepoPass(db, item)))
    )
  }

  // ── Phase 2c: Backfill unenriched DB repos (highest stars first) ──────
  const backfillSlots = MAX_ENRICHMENTS_PER_RUN - enriched
  if (backfillSlots > 0) {
    log(`\n── Phase 2c: Backfilling unenriched DB repos (${backfillSlots} slots) ──`)

    // Find repos that exist in DB but have no enrichment, ordered by stars
    const { data: unenrichedRows } = await db
      .rpc('get_unenriched_repos' as never, { row_limit: backfillSlots } as never) as unknown as {
        data: Array<{
          id: string; github_id: number; name: string; owner: string;
          description: string | null; stars: number; forks: number;
          contributors: number; language: string | null; url: string;
          topics: string[] | null;
        }> | null
      }

    // Fallback: if the RPC doesn't exist, query manually
    let backfillRepos = unenrichedRows
    if (!backfillRepos) {
      // Left-anti-join: repos without enrichments, sorted by stars desc
      const { data: allRepoIds } = await db
        .from('repos')
        .select('id')
        .order('stars', { ascending: false })
        .limit(backfillSlots * 3)

      if (allRepoIds && allRepoIds.length > 0) {
        const ids = (allRepoIds as unknown as Array<{ id: string }>).map((r) => r.id)
        const { data: enrichedIds } = await db
          .from('enrichments')
          .select('repo_id')
          .in('repo_id', ids)

        const enrichedSet = new Set(
          ((enrichedIds ?? []) as unknown as Array<{ repo_id: string }>).map((e) => e.repo_id)
        )
        const unenrichedIds = ids.filter((id) => !enrichedSet.has(id)).slice(0, backfillSlots)

        if (unenrichedIds.length > 0) {
          const { data: rows } = await db
            .from('repos')
            .select('id, github_id, name, owner, description, stars, forks, contributors, language, url')
            .in('id', unenrichedIds)
            .order('stars', { ascending: false })

          backfillRepos = (rows ?? []) as unknown as typeof backfillRepos
        }
      }
    }

    if (backfillRepos && backfillRepos.length > 0) {
      log(`  Found ${backfillRepos.length} unenriched repos to backfill`)
      const backfillLimiter = createLimiter(ENRICH_CONCURRENCY)

      await Promise.all(
        backfillRepos.map((row) => {
          const item: ScoreResult = {
            repoId: row.id,
            label: `${row.owner}/${row.name}`,
            score: 0, // will be calculated by enrichRepo
            breakdown: calculateScore({
              stars: row.stars, stars_7d: 0, stars_30d: 0,
              contributors: row.contributors ?? 0, forks: row.forks,
              hn_mentions_7d: 0, hn_mentions_30d: 0, commits_30d: 0,
            }).breakdown,
            repoData: {
              github_id: row.github_id,
              name: row.name,
              owner: row.owner,
              description: row.description,
              stars: row.stars,
              forks: row.forks,
              language: row.language,
              url: row.url,
              pushed_at: '',
              created_at: '',
              topics: row.topics ?? undefined,
            },
            contributorCount: row.contributors ?? 0,
          }
          // Recalculate score properly
          const { score, breakdown } = calculateScore({
            stars: row.stars, stars_7d: 0, stars_30d: 0,
            contributors: row.contributors ?? 0, forks: row.forks,
            hn_mentions_7d: 0, hn_mentions_30d: 0, commits_30d: 0,
          })
          item.score = score
          item.breakdown = breakdown
          return backfillLimiter(() => enrichRepoPass(db, item))
        })
      )
      log(`  Backfill complete`)
    } else {
      log('  No unenriched repos found for backfill')
    }
  }

  log(`\n=== Pipeline Complete ===`)
  log(`Discovered: ${discovered.size} unique repos`)
  log(`Scored: ${scored} | Stale-skipped: ${skippedStale} | Enriched: ${enriched}`)
  log(`Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Pipeline failed with unexpected error:', err)
  process.exit(1)
})
