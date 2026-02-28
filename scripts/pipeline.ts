// GitFind Data Pipeline
// Discovers repos from GitHub Search, scores them using DB data, enriches with Claude.
//
// OPTIMIZED: Scoring uses data already captured by snapshot-light (daily) and
// snapshot-weekly (Sundays). The only GitHub REST calls in Phase 2 are:
//   - getReadme() — 1 call, only when Claude enrichment is triggered
//   - detectPackageName() — 1-3 calls, one-time per repo
//   - getHNMentions() — HN Algolia API (not GitHub, doesn't count)
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
    { searchReposByCategory, searchTrendingMidTier, searchNewbornRockets, getReadme, cleanReadme, detectPackageName },
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

  let skippedStale = 0

  async function processRepo(db: DB, repoData: Repo): Promise<void> {
    const { owner, name: repoName, github_id } = repoData
    const label = `${owner}/${repoName}`

    try {
      // ── Stale skip: if repo exists, has enrichment, and stars haven't changed, skip ──
      const { data: existingRepo } = await db
        .from('repos')
        .select('id, stars, contributors')
        .eq('github_id', github_id)
        .maybeSingle()

      if (existingRepo) {
        const { data: lastSnap } = await db
          .from('repo_snapshots')
          .select('stars, forks, stars_7d, snapshot_date')
          .eq('repo_id', existingRepo.id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        const { data: hasEnrichment } = await db
          .from('enrichments')
          .select('id')
          .eq('repo_id', existingRepo.id)
          .maybeSingle()

        if (lastSnap && hasEnrichment && lastSnap.stars === repoData.stars) {
          // Stars unchanged — carry forward snapshot, skip expensive processing
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
          // Update basic repo fields (description, forks may change even if stars don't)
          await db.from('repos').update({
            description: repoData.description,
            forks: repoData.forks,
            language: repoData.language,
            updated_at: new Date().toISOString(),
          }).eq('id', existingRepo.id)

          log(`  ${label} → stale skip (stars unchanged at ${repoData.stars.toLocaleString()})`)
          skippedStale++
          return
        }
      }

      // ── Full processing: repo is new or stars changed ──
      log(`  Processing ${label}...`)

      // Upsert repo first so we have the ID for DB lookups
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
        return
      }

      const repoId = upsertedRepo.id

      // ── Read scoring data from DB (no GitHub API calls) ──
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const date7dAgo = new Date(today)
      date7dAgo.setDate(today.getDate() - 7)
      const date14dAgo = new Date(today)
      date14dAgo.setDate(today.getDate() - 14)
      const date30dAgo = new Date(today)
      date30dAgo.setDate(today.getDate() - 30)

      // Parallel DB reads: snapshots + weekly stats + HN mentions (HN is external API, not GitHub)
      const [
        { data: snap7d },
        { data: snap14d },
        { data: snap30d },
        { data: latestSnap },
        { data: weeklyStats },
        hnMentions,
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
      ])

      // Derive scoring inputs from DB data
      // stars_7d: prefer latest snapshot value, fall back to calculating from 7d-ago snapshot
      const stars_7d = latestSnap?.stars_7d
        ?? (snap7d ? repoData.stars - (snap7d.stars as number) : 0)

      // stars_30d: calculate from 30d-ago snapshot
      const stars_30d = snap30d ? repoData.stars - (snap30d.stars as number) : 0

      // contributors: from repos table (updated by snapshot-weekly)
      const contributorCount = (upsertedRepo.contributors as number) ?? 0

      // commits_30d: from weekly_stats (updated by snapshot-weekly)
      const commits_30d = (weeklyStats?.commit_count_4w as number) ?? 0

      // Derive fork/star deltas from snapshots
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

      log(`  ${label} → score: ${score}`)

      const { data: existing } = await db
        .from('enrichments')
        .select('early_signal_score')
        .eq('repo_id', repoId)
        .maybeSingle()

      const needsEnrichment =
        !existing || Math.abs(existing.early_signal_score - score) > 10

      if (needsEnrichment) {
        // Only fetch README when we actually need Claude enrichment (1 GitHub API call)
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
        }, score, breakdown)
        log(`  ${label} enriched ✓`)
      } else {
        await db
          .from('enrichments')
          .update({
            early_signal_score: score,
            score_breakdown: JSON.parse(JSON.stringify(breakdown)),
            scored_at: new Date().toISOString(),
          })
          .eq('repo_id', repoId)
        log(`  ${label} score updated (no re-enrichment needed)`)
      }

      // Detect package name (one-time per repo, 1-3 GitHub API calls)
      const { data: repoRow } = await db
        .from('repos')
        .select('package_registry')
        .eq('id', repoId)
        .single()
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

      // Insert today's snapshot (ON CONFLICT DO NOTHING for re-run safety)
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
    } catch (err) {
      logError(`Failed to process ${label}`, err)
    }
  }

  log('=== GitFind Pipeline Starting ===')

  const db = createServiceClient()
  let totalErrors = 0

  // ── Phase 1: Discovery ──────────────────────────────────────────────
  const discovered = new Map<number, Repo>()

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

  // Layer 3: Newborn rockets
  // Wait for search rate limit window to reset (30 req/min)
  log('Waiting 60s for search rate limit window...')
  await new Promise((r) => setTimeout(r, 60_000))
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

  log(`\n── Discovery complete: ${discovered.size} unique repos ──`)

  // ── Phase 2: Processing ─────────────────────────────────────────────
  // No inter-repo delay — rate limiting is handled by GitHub's headers,
  // and most processing is now DB reads (not API calls).
  log('\n── Phase 2: Processing ──')
  let totalProcessed = 0

  for (const repo of discovered.values()) {
    await processRepo(db, repo)
    totalProcessed++
  }

  log(`\n=== Pipeline Complete ===`)
  log(`Discovered: ${discovered.size} unique repos`)
  log(`Processed: ${totalProcessed} repos (${skippedStale} skipped as stale)`)
  log(`Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Pipeline failed with unexpected error:', err)
  process.exit(1)
})
