// Seed script — one-time bulk import of high-star repos
// Fetches top 500 repos by stars from GitHub Search API, upserts them,
// scores with calculateScore(), and enriches unenriched ones with Claude.
//
// Run: npx tsx scripts/seed-top-repos.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const ENRICH_CONCURRENCY = 5
const PER_PAGE = 100
const TOTAL_PAGES = 5 // 5 × 100 = 500 repos

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

interface GitHubSearchResult {
  total_count: number
  items: Array<{
    id: number
    name: string
    full_name: string
    owner: { login: string }
    description: string | null
    stargazers_count: number
    forks_count: number
    language: string | null
    html_url: string
    pushed_at: string
    created_at: string
    topics?: string[]
  }>
}

async function main(): Promise<void> {
  const [
    { githubFetch, getReadme, cleanReadme },
    { calculateScore },
    { enrichRepo },
    { createServiceClient },
  ] = await Promise.all([
    import('../lib/github.js'),
    import('../lib/score.js'),
    import('../lib/enrichment.js'),
    import('../lib/supabase.js'),
  ])

  const db = createServiceClient()

  // ── Step 1: Fetch top repos from GitHub Search API ──
  log('=== Seed Top Repos Starting ===')
  log(`Fetching top ${PER_PAGE * TOTAL_PAGES} repos by stars...`)

  type GitHubRepo = Awaited<ReturnType<typeof import('../lib/github.js').searchHighStarRepos>>[number]

  const repos: GitHubRepo[] = []
  const seen = new Set<number>()

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const query = encodeURIComponent('stars:>5000')
    const data = await githubFetch<GitHubSearchResult>(
      `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`
    )

    for (const item of data.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        repos.push({
          github_id: item.id,
          name: item.name,
          owner: item.owner.login,
          description: item.description,
          stars: item.stargazers_count,
          forks: item.forks_count,
          language: item.language,
          url: item.html_url,
          pushed_at: item.pushed_at,
          created_at: item.created_at,
          topics: item.topics ?? [],
        })
      }
    }

    log(`  Page ${page}/${TOTAL_PAGES}: ${data.items.length} results (${repos.length} total unique)`)
    await new Promise((r) => setTimeout(r, 250))
  }

  log(`Fetched ${repos.length} unique repos`)

  // ── Step 2: Upsert all repos and identify unenriched ones ──
  log('\nUpserting repos and checking enrichment status...')

  interface NeedsEnrichment {
    repoId: string
    repo: GitHubRepo
  }

  const needsEnrichment: NeedsEnrichment[] = []
  let alreadyEnriched = 0

  for (const repo of repos) {
    const { data: upserted, error } = await db
      .from('repos')
      .upsert(
        {
          github_id: repo.github_id,
          name: repo.name,
          owner: repo.owner,
          description: repo.description,
          stars: repo.stars,
          forks: repo.forks,
          language: repo.language,
          url: repo.url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'github_id' }
      )
      .select('id')
      .single()

    if (error || !upserted) {
      logError(`Failed to upsert ${repo.owner}/${repo.name}`, error)
      continue
    }

    // Check if already enriched
    const { data: existing } = await db
      .from('enrichments')
      .select('id')
      .eq('repo_id', upserted.id)
      .maybeSingle()

    if (existing) {
      alreadyEnriched++
    } else {
      needsEnrichment.push({ repoId: upserted.id, repo })
    }
  }

  log(`Already enriched: ${alreadyEnriched}`)
  log(`Needs enrichment: ${needsEnrichment.length}`)

  if (needsEnrichment.length === 0) {
    log('\n=== All repos already enriched. Done! ===')
    return
  }

  // ── Step 3: Score and enrich ──
  log(`\nEnriching ${needsEnrichment.length} repos (concurrency: ${ENRICH_CONCURRENCY})...`)

  let enriched = 0
  let errors = 0
  const limiter = createLimiter(ENRICH_CONCURRENCY)

  await Promise.all(
    needsEnrichment.map(({ repoId, repo }) =>
      limiter(async () => {
        const label = `${repo.owner}/${repo.name}`
        try {
          // Score with minimal data (no velocity — same as Phase 2c backfill)
          const { score, breakdown } = calculateScore({
            stars: repo.stars,
            stars_7d: 0,
            stars_30d: 0,
            contributors: 0,
            forks: repo.forks,
            hn_mentions_7d: 0,
            hn_mentions_30d: 0,
            commits_30d: 0,
          })

          // Insert today's snapshot
          const todayStr = new Date().toISOString().split('T')[0]
          await db.from('repo_snapshots').upsert(
            {
              repo_id: repoId,
              snapshot_date: todayStr,
              stars: repo.stars,
              forks: repo.forks,
              stars_7d: 0,
            },
            { onConflict: 'repo_id,snapshot_date', ignoreDuplicates: true }
          )

          // Fetch README
          const rawReadme = await getReadme(repo.owner, repo.name)
          const readmeExcerpt = rawReadme ? cleanReadme(rawReadme) : undefined

          // Enrich with Claude
          log(`  Enriching ${label} (${repo.stars.toLocaleString()} stars)...`)
          await enrichRepo(
            repoId,
            {
              github_id: repo.github_id,
              name: repo.name,
              owner: repo.owner,
              description: repo.description,
              stars: repo.stars,
              forks: repo.forks,
              contributors: 0,
              language: repo.language,
              topics: repo.topics,
              readme_excerpt: readmeExcerpt || undefined,
            },
            score,
            breakdown,
            true
          )

          enriched++
          log(`  ${label} enriched (${enriched}/${needsEnrichment.length})`)
        } catch (err) {
          errors++
          logError(`Failed to enrich ${label}`, err)
        }
      })
    )
  )

  log(`\n=== Seed Complete ===`)
  log(`Enriched: ${enriched} | Errors: ${errors} | Already had: ${alreadyEnriched}`)
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
