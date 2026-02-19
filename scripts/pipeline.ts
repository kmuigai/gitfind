// GitFind Data Pipeline
// Fetches repos from GitHub, scores them, enriches with Claude, saves to Supabase.
//
// Run locally: npx tsx scripts/pipeline.ts
// Run nightly: GitHub Actions cron (see .github/workflows/pipeline.yml)
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, ANTHROPIC_API_KEY

import { config } from 'dotenv'
config({ path: '.env.local' })

// NOTE: All imports that touch Supabase/Anthropic/GitHub clients are done via
// dynamic import() inside main() — this ensures dotenv has populated env vars
// before those modules initialise their clients. Static imports are hoisted
// before any module body code runs, which breaks dotenv in CJS mode.

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
    { searchReposByCategory, searchTrendingMidTier, searchNewbornRockets, getStarVelocity, getContributorCount, getCommitFrequency, getReadme, cleanReadme, getCoAuthoredByTools },
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

  async function processRepo(db: DB, repoData: Repo): Promise<void> {
    const { owner, name: repoName, github_id } = repoData
    const label = `${owner}/${repoName}`

    try {
      log(`  Processing ${label}...`)

      const [starVelocity, contributorCount, commitFrequency, hnMentions, rawReadme] =
        await Promise.all([
          getStarVelocity(owner, repoName, repoData.stars),
          getContributorCount(owner, repoName),
          getCommitFrequency(owner, repoName),
          getHNMentions(owner, repoName),
          getReadme(owner, repoName),
        ])

      const readmeExcerpt = rawReadme ? cleanReadme(rawReadme) : undefined

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
            contributors: contributorCount,
            language: repoData.language,
            url: repoData.url,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'github_id' }
        )
        .select('id')
        .single()

      if (repoError || !upsertedRepo) {
        logError(`Failed to upsert repo ${label}`, repoError)
        return
      }

      const repoId = upsertedRepo.id

      // Fetch snapshots from 7 and 14 days ago for acceleration signals
      const today = new Date()
      const date7dAgo = new Date(today)
      date7dAgo.setDate(today.getDate() - 7)
      const date14dAgo = new Date(today)
      date14dAgo.setDate(today.getDate() - 14)

      const [{ data: snap7d }, { data: snap14d }] = await Promise.all([
        db.from('repo_snapshots')
          .select('stars_7d, forks')
          .eq('repo_id', repoId)
          .eq('snapshot_date', date7dAgo.toISOString().split('T')[0])
          .maybeSingle(),
        db.from('repo_snapshots')
          .select('stars_7d, forks')
          .eq('repo_id', repoId)
          .eq('snapshot_date', date14dAgo.toISOString().split('T')[0])
          .maybeSingle(),
      ])

      // Derive fork deltas from snapshots
      const forks_7d = snap7d ? repoData.forks - snap7d.forks : undefined
      const forks_7d_prev = (snap7d && snap14d) ? snap7d.forks - snap14d.forks : undefined
      const stars_7d_prev = snap7d ? snap7d.stars_7d : undefined

      const { score, breakdown } = calculateScore({
        stars: repoData.stars,
        stars_7d: starVelocity.stars_7d,
        stars_30d: starVelocity.stars_30d,
        contributors: contributorCount,
        forks: repoData.forks,
        hn_mentions_7d: hnMentions.mentions_7d,
        hn_mentions_30d: hnMentions.mentions_30d,
        commits_30d: commitFrequency,
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

      // Extract AI tool contributions from Co-Authored-By headers
      const toolContributions = await getCoAuthoredByTools(owner, repoName)
      const months = Object.keys(toolContributions)
      if (months.length > 0) {
        for (const month of months) {
          for (const [toolName, commitCount] of Object.entries(toolContributions[month])) {
            await db.from('tool_contributions').upsert(
              {
                repo_id: repoId,
                tool_name: toolName,
                commit_count: commitCount,
                month,
              },
              { onConflict: 'repo_id,tool_name,month' }
            )
          }
        }
        log(`  ${label} tool contributions recorded (${months.length} months)`)
      }

      // Insert today's snapshot (ON CONFLICT DO NOTHING for re-run safety)
      const { error: snapError } = await db.from('repo_snapshots').upsert(
        {
          repo_id: repoId,
          snapshot_date: today.toISOString().split('T')[0],
          stars: repoData.stars,
          forks: repoData.forks,
          stars_7d: starVelocity.stars_7d,
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

  // Layer 1: Category search (existing)
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
  log('\n── Phase 2: Processing ──')
  let totalProcessed = 0

  for (const repo of discovered.values()) {
    await processRepo(db, repo)
    totalProcessed++
    await new Promise((r) => setTimeout(r, 500))
  }

  log(`\n=== Pipeline Complete ===`)
  log(`Discovered: ${discovered.size} unique repos`)
  log(`Processed: ${totalProcessed} repos`)
  log(`Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Pipeline failed with unexpected error:', err)
  process.exit(1)
})
