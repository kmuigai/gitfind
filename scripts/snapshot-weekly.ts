// Weekly Stats Script
// Fetches contributor count, 4-week commit count, and latest release for ALL repos.
// Upserts into weekly_stats table.
//
// OPTIMIZED: Uses GraphQL batching for commits + releases (~2 min for all repos),
// REST only for contributor count (1 call/repo, ~105 min at 5K/hour for 8.8K repos).
// Previous version: 5 REST calls/repo = ~9 hours for 8.8K repos.
//
// Runs weekly on Sundays at 08:00 UTC via GitHub Actions.
// Run locally: npx tsx scripts/snapshot-weekly.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const RATE_LIMIT_FLOOR = 100
const GRAPHQL_BATCH_SIZE = 50 // Repos per GraphQL query
const DB_BATCH_SIZE = 100

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitFind/1.0',
  }
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  }
  return headers
}

async function checkRateLimit(response: Response): Promise<void> {
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '5000', 10)
  const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10)

  if (remaining < RATE_LIMIT_FLOOR && resetAt > 0) {
    const now = Math.floor(Date.now() / 1000)
    const sleepSeconds = Math.max(resetAt - now + 5, 10)
    log(`  REST rate limit low (${remaining}) — sleeping ${sleepSeconds}s...`)
    await new Promise((r) => setTimeout(r, sleepSeconds * 1000))
  }
}

// ── REST: Get contributor count from Link header ──
async function getContributorCount(owner: string, name: string): Promise<number> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/contributors?per_page=1&anon=true`,
    { headers: githubHeaders() }
  )

  await checkRateLimit(response)

  if (!response.ok) return 0

  const linkHeader = response.headers.get('Link')
  if (!linkHeader) {
    const data = await response.json()
    return Array.isArray(data) ? data.length : 0
  }

  const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
  if (lastMatch) {
    return parseInt(lastMatch[1], 10)
  }

  return 1
}

// ── GraphQL types ──
interface GraphQLRepoNode {
  nameWithOwner: string
  defaultBranchRef: {
    target: {
      history: { totalCount: number }
    }
  } | null
  releases: {
    nodes: Array<{
      publishedAt: string | null
      tagName: string
    }>
  }
}

interface GraphQLResponse {
  data?: {
    [key: string]: GraphQLRepoNode | { cost: number; remaining: number; resetAt: string }
    rateLimit: { cost: number; remaining: number; resetAt: string }
  }
  errors?: Array<{ message: string; type?: string }>
}

// ── GraphQL: Build batched query for commits + releases ──
function buildGraphQLQuery(repos: RepoRow[], since: string): string {
  const repoQueries = repos.map((r, i) => {
    // Sanitize owner/name for GraphQL alias (replace hyphens/dots with underscores)
    const alias = `r${i}`
    return `${alias}: repository(owner: "${r.owner}", name: "${r.name}") {
      nameWithOwner
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: "${since}") { totalCount }
          }
        }
      }
      releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          publishedAt
          tagName
        }
      }
    }`
  })

  return `query {
    rateLimit { cost remaining resetAt }
    ${repoQueries.join('\n    ')}
  }`
}

// ── GraphQL: Execute query with rate limit handling ──
async function graphqlQuery(query: string): Promise<GraphQLResponse> {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GitFind/1.0',
    },
    body: JSON.stringify({ query }),
  })

  if (response.status === 403 || response.status === 502) {
    log(`  GitHub returned ${response.status}, waiting 60s before retry...`)
    await new Promise((r) => setTimeout(r, 60_000))
    return graphqlQuery(query)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GraphQL request failed: ${response.status} ${text}`)
  }

  const result = (await response.json()) as GraphQLResponse

  const rateLimit = result.data?.rateLimit as { cost: number; remaining: number; resetAt: string } | undefined
  if (rateLimit && rateLimit.remaining < 100) {
    const resetTime = new Date(rateLimit.resetAt).getTime()
    const sleepMs = Math.max(resetTime - Date.now() + 5000, 10000)
    log(`  GraphQL rate limit low (${rateLimit.remaining}) — sleeping ${Math.round(sleepMs / 1000)}s...`)
    await new Promise((r) => setTimeout(r, sleepMs))
  }

  return result
}

interface RepoRow {
  id: string
  owner: string
  name: string
}

interface GraphQLData {
  commitCount4w: number
  releaseDate: string | null
  releaseTag: string | null
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const todayStr = new Date().toISOString().split('T')[0]
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const sinceDate = fourWeeksAgo.toISOString()

  log('=== Weekly Stats Script (GraphQL + REST) ===')
  log(`Date: ${todayStr}`)

  // Fetch all repos from DB, paginated
  let allRepos: RepoRow[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await db
      .from('repos')
      .select('id, owner, name')
      .order('id')
      .range(offset, offset + pageSize - 1)

    if (error) {
      log(`Failed to fetch repos: ${error.message}`)
      break
    }

    if (!data || data.length === 0) break
    allRepos = allRepos.concat(data as unknown as RepoRow[])
    offset += data.length

    if (data.length < pageSize) break
  }

  log(`Total repos in DB: ${allRepos.length.toLocaleString()}`)

  if (allRepos.length === 0) {
    log('No repos to process. Done.')
    return
  }

  // ── Phase 1: GraphQL batched queries for commits + releases ──
  log('\n── Phase 1: Fetching commits + releases (GraphQL) ──')

  const graphqlData = new Map<string, GraphQLData>() // keyed by "owner/name" lowercase
  let graphqlErrors = 0
  let totalCost = 0

  for (let i = 0; i < allRepos.length; i += GRAPHQL_BATCH_SIZE) {
    const batch = allRepos.slice(i, i + GRAPHQL_BATCH_SIZE)
    const batchNum = Math.floor(i / GRAPHQL_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(allRepos.length / GRAPHQL_BATCH_SIZE)

    try {
      const query = buildGraphQLQuery(batch, sinceDate)
      const result = await graphqlQuery(query)

      const rateLimit = result.data?.rateLimit as { cost: number; remaining: number; resetAt: string } | undefined
      if (rateLimit) {
        totalCost += rateLimit.cost
      }

      // Handle partial errors (some repos may be deleted/private)
      if (result.errors) {
        for (const err of result.errors) {
          if (err.type !== 'NOT_FOUND') {
            log(`  Batch ${batchNum} GraphQL error: ${err.message}`)
          }
        }
      }

      // Extract data from aliased responses
      for (let j = 0; j < batch.length; j++) {
        const alias = `r${j}`
        const node = result.data?.[alias] as GraphQLRepoNode | null | undefined

        if (!node || !node.nameWithOwner) continue

        const key = node.nameWithOwner.toLowerCase()
        const commitCount = node.defaultBranchRef?.target?.history?.totalCount ?? 0
        const release = node.releases?.nodes?.[0]

        graphqlData.set(key, {
          commitCount4w: commitCount,
          releaseDate: release?.publishedAt ? release.publishedAt.split('T')[0] : null,
          releaseTag: release?.tagName ?? null,
        })
      }

      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        log(`  Batch ${batchNum}/${totalBatches} — ${graphqlData.size} repos fetched (cost: ${totalCost} pts)`)
      }
    } catch (err) {
      log(`  Batch ${batchNum}/${totalBatches} — error: ${err instanceof Error ? err.message : String(err)}`)
      graphqlErrors += batch.length
    }
  }

  log(`GraphQL phase complete: ${graphqlData.size} repos, ${totalCost} total points, ${graphqlErrors} errors`)

  // ── Phase 2: REST calls for contributor counts + DB upserts ──
  log('\n── Phase 2: Fetching contributors (REST) + upserting ──')

  let updated = 0
  let errors = 0

  for (let i = 0; i < allRepos.length; i++) {
    const repo = allRepos[i]
    const label = `${repo.owner}/${repo.name}`
    const key = label.toLowerCase()

    try {
      const contributors = await getContributorCount(repo.owner, repo.name)

      // Update repos.contributors for scoring
      await db.from('repos').update({ contributors }).eq('id', repo.id)

      // Get GraphQL data (may be missing if repo was deleted/private)
      const gql = graphqlData.get(key)

      const { error: upsertError } = await db.from('weekly_stats').upsert(
        {
          repo_id: repo.id,
          snapshot_date: todayStr,
          contributors,
          commit_count_4w: gql?.commitCount4w ?? 0,
          last_release_date: gql?.releaseDate ?? null,
          last_release_tag: gql?.releaseTag ?? null,
        },
        { onConflict: 'repo_id,snapshot_date' }
      )

      if (upsertError) {
        log(`  ${label} → upsert error: ${upsertError.message}`)
        errors++
      } else {
        updated++
      }

      // Progress log every 500 repos
      if ((i + 1) % 500 === 0) {
        log(`  Progress: ${i + 1}/${allRepos.length} (${updated} updated, ${errors} errors)`)
      }
    } catch (err) {
      log(`  ${label} → error: ${err instanceof Error ? err.message : String(err)}`)
      errors++
    }
  }

  log(`\n=== Weekly Stats Complete ===`)
  log(`Updated: ${updated}`)
  log(`Errors: ${errors}`)
  log(`GraphQL cost: ${totalCost} points`)
}

main().catch((err) => {
  console.error('Weekly stats failed:', err)
  process.exit(1)
})
