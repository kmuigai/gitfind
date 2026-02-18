// GitFind Data Pipeline
// Fetches repos from GitHub, scores them, enriches with Claude, saves to Supabase.
//
// Run locally: npx tsx scripts/pipeline.ts
// Run nightly: GitHub Actions cron (see .github/workflows/pipeline.yml)
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, ANTHROPIC_API_KEY

import 'dotenv/config'
import {
  searchReposByCategory,
  getStarVelocity,
  getContributorCount,
  getCommitFrequency,
} from '../lib/github.js'
import { calculateScore } from '../lib/score.js'
import { getHNMentions } from '../lib/hn.js'
import { enrichRepo } from '../lib/enrichment.js'
import { createServiceClient } from '../lib/supabase.js'

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

async function processRepo(
  db: ReturnType<typeof createServiceClient>,
  repoData: Awaited<ReturnType<typeof searchReposByCategory>>[number]
): Promise<void> {
  const { owner, name: repoName, github_id } = repoData
  const label = `${owner}/${repoName}`

  try {
    log(`  Processing ${label}...`)

    // Fetch enriching signals in parallel
    const [starVelocity, contributorCount, commitFrequency, hnMentions] =
      await Promise.all([
        getStarVelocity(owner, repoName, repoData.stars),
        getContributorCount(owner, repoName),
        getCommitFrequency(owner, repoName),
        getHNMentions(owner, repoName),
      ])

    // Calculate Early Signal Score
    const { score } = calculateScore({
      stars: repoData.stars,
      stars_7d: starVelocity.stars_7d,
      stars_30d: starVelocity.stars_30d,
      contributors: contributorCount,
      forks: repoData.forks,
      hn_mentions_7d: hnMentions.mentions_7d,
      hn_mentions_30d: hnMentions.mentions_30d,
      commits_30d: commitFrequency,
    })

    log(`  ${label} → score: ${score}`)

    // Upsert repo into database
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

    // Check if we need to enrich this repo
    // Re-enrich if: no existing enrichment, or score changed significantly (>10 points)
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
      }, score)
      log(`  ${label} enriched ✓`)
    } else {
      // Update just the score even if we skip re-enrichment
      await db
        .from('enrichments')
        .update({ early_signal_score: score, scored_at: new Date().toISOString() })
        .eq('repo_id', repoId)
      log(`  ${label} score updated (no re-enrichment needed)`)
    }
  } catch (err) {
    logError(`Failed to process ${label}`, err)
  }
}

async function runPipeline(): Promise<void> {
  log('=== GitFind Pipeline Starting ===')

  const db = createServiceClient()
  let totalProcessed = 0
  let totalErrors = 0

  for (const categorySlug of CATEGORY_SLUGS) {
    const categoryName = CATEGORY_NAMES[categorySlug]
    log(`\nFetching repos for category: ${categoryName}`)

    try {
      const repos = await searchReposByCategory(categorySlug)
      log(`Found ${repos.length} repos in ${categoryName}`)

      // Process repos sequentially to respect GitHub rate limits
      for (const repo of repos) {
        await processRepo(db, repo)
        totalProcessed++
        // Small delay between repos to avoid secondary rate limits
        await new Promise((r) => setTimeout(r, 500))
      }
    } catch (err) {
      logError(`Failed to fetch repos for ${categoryName}`, err)
      totalErrors++
    }

    // Delay between categories
    log(`Completed ${categoryName}. Waiting before next category...`)
    await new Promise((r) => setTimeout(r, 2000))
  }

  log(`\n=== Pipeline Complete ===`)
  log(`Processed: ${totalProcessed} repos`)
  log(`Errors: ${totalErrors}`)
}

// Entry point
runPipeline().catch((err) => {
  console.error('Pipeline failed with unexpected error:', err)
  process.exit(1)
})
