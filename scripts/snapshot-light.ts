// Light Snapshot Script
// Fetches current star/fork counts for ALL repos in the DB via GitHub GraphQL API.
// Upserts into repo_snapshots with today's date. Calculates stars_7d from snapshot diff.
//
// GitHub API cost: ~1 GraphQL point per 100 repos. 10K repos ≈ 100 queries ≈ 2 minutes.
// (Previously used REST: 1 call per repo = 2 hours for 10K repos.)
//
// Run locally: npx tsx scripts/snapshot-light.ts
// Run nightly: GitHub Actions at 06:00 UTC (separate workflow)

import { config } from 'dotenv'
config({ path: '.env.local' })

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GRAPHQL_BATCH_SIZE = 100 // Max repos per GraphQL query
const DB_BATCH_SIZE = 100 // Batch size for DB upserts

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

interface RepoRow {
  id: string
  github_id: number
  owner: string
  name: string
  stars: number
  forks: number
}

interface GraphQLRepoResult {
  nameWithOwner: string
  stargazerCount: number
  forkCount: number
  openIssues: { totalCount: number }
  watchers: { totalCount: number }
  licenseInfo: { spdxId: string } | null
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> }
  isArchived: boolean
  pushedAt: string | null
}

interface GraphQLResponse {
  data?: {
    search?: {
      nodes: Array<GraphQLRepoResult | null>
    }
    rateLimit?: {
      cost: number
      remaining: number
      resetAt: string
    }
  }
  errors?: Array<{ message: string }>
}

// Build a GraphQL search query for a batch of repos
function buildQuery(repos: RepoRow[]): string {
  const repoQueries = repos.map((r) => `repo:${r.owner}/${r.name}`).join(' ')

  return `query {
    rateLimit { cost remaining resetAt }
    search(type: REPOSITORY, query: "${repoQueries}", first: ${repos.length}) {
      nodes {
        ... on Repository {
          nameWithOwner
          stargazerCount
          forkCount
          openIssues: issues(states: OPEN) { totalCount }
          watchers { totalCount }
          licenseInfo { spdxId }
          repositoryTopics(first: 20) {
            nodes { topic { name } }
          }
          isArchived
          pushedAt
        }
      }
    }
  }`
}

// Execute a GraphQL query with rate limit handling
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
    // Rate limited or server error — wait and retry
    log(`  GitHub returned ${response.status}, waiting 60s before retry...`)
    await new Promise((r) => setTimeout(r, 60_000))
    return graphqlQuery(query)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GraphQL request failed: ${response.status} ${text}`)
  }

  const result = (await response.json()) as GraphQLResponse

  // Check rate limit
  const rateLimit = result.data?.rateLimit
  if (rateLimit) {
    if (rateLimit.remaining < 100) {
      const resetTime = new Date(rateLimit.resetAt).getTime()
      const sleepMs = Math.max(resetTime - Date.now() + 5000, 10000)
      log(`  GraphQL rate limit low (${rateLimit.remaining} remaining) — sleeping ${Math.round(sleepMs / 1000)}s...`)
      await new Promise((r) => setTimeout(r, sleepMs))
    }
  }

  return result
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const todayStr = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  log('=== Light Snapshot Script (GraphQL) ===')
  log(`Date: ${todayStr}`)

  // Fetch all repos from DB, paginated
  let allRepos: RepoRow[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await db
      .from('repos')
      .select('id, github_id, owner, name, stars, forks')
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
    log('No repos to snapshot. Done.')
    return
  }

  // Fetch 7-day-ago snapshots in batch for stars_7d calculation
  const snapshots7d = new Map<string, number>() // repo_id → stars 7 days ago

  for (let i = 0; i < allRepos.length; i += DB_BATCH_SIZE) {
    const batch = allRepos.slice(i, i + DB_BATCH_SIZE)
    const repoIds = batch.map((r) => r.id)

    const { data } = await db
      .from('repo_snapshots')
      .select('repo_id, stars')
      .in('repo_id', repoIds)
      .eq('snapshot_date', sevenDaysAgoStr)

    if (data) {
      for (const row of data) {
        snapshots7d.set(row.repo_id as string, row.stars as number)
      }
    }
  }

  log(`Found ${snapshots7d.size} snapshots from 7 days ago for diff calculation`)

  // Build a lookup map: "owner/name" → RepoRow
  const repoLookup = new Map<string, RepoRow>()
  for (const repo of allRepos) {
    repoLookup.set(`${repo.owner}/${repo.name}`.toLowerCase(), repo)
  }

  // Process repos in GraphQL batches of 100
  let updated = 0
  let notFound = 0
  let errors = 0
  let totalCost = 0
  const promotionCandidates: Array<{ owner: string; name: string; stars: number; stars_7d: number }> = []

  for (let i = 0; i < allRepos.length; i += GRAPHQL_BATCH_SIZE) {
    const batch = allRepos.slice(i, i + GRAPHQL_BATCH_SIZE)
    const batchNum = Math.floor(i / GRAPHQL_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(allRepos.length / GRAPHQL_BATCH_SIZE)

    try {
      const query = buildQuery(batch)
      const result = await graphqlQuery(query)

      if (result.data?.rateLimit) {
        totalCost += result.data.rateLimit.cost
      }

      if (result.errors) {
        log(`  Batch ${batchNum}/${totalBatches} — GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`)
        errors += batch.length
        continue
      }

      const nodes = result.data?.search?.nodes ?? []

      // Track which repos were returned by GraphQL
      const foundRepos = new Set<string>()

      // Process returned repos
      const repoUpdates: Array<{ id: string; stars: number; forks: number; watchers: number; license: string | null; topics: string[]; archived: boolean; pushed_at: string | null }> = []
      const snapshotUpserts: Array<{ repo_id: string; snapshot_date: string; stars: number; forks: number; stars_7d: number; open_issues: number }> = []

      for (const node of nodes) {
        if (!node || !node.nameWithOwner) continue

        const key = node.nameWithOwner.toLowerCase()
        const repo = repoLookup.get(key)
        if (!repo) continue

        foundRepos.add(key)

        const currentStars = node.stargazerCount
        const currentForks = node.forkCount
        const currentOpenIssues = node.openIssues.totalCount
        const watchers = node.watchers.totalCount
        const license = node.licenseInfo?.spdxId ?? null
        const topics = node.repositoryTopics.nodes.map((t) => t.topic.name)
        const archived = node.isArchived
        const pushedAt = node.pushedAt

        // Calculate stars_7d from snapshot diff
        const stars7dAgo = snapshots7d.get(repo.id)
        const stars_7d = stars7dAgo !== undefined ? currentStars - stars7dAgo : 0

        repoUpdates.push({
          id: repo.id,
          stars: currentStars,
          forks: currentForks,
          watchers,
          license,
          topics,
          archived,
          pushed_at: pushedAt,
        })

        snapshotUpserts.push({
          repo_id: repo.id,
          snapshot_date: todayStr,
          stars: currentStars,
          forks: currentForks,
          stars_7d,
          open_issues: currentOpenIssues,
        })

        // Check promotion candidates (high-growth repos without enrichment)
        if (stars_7d >= 50 || currentStars >= 500) {
          promotionCandidates.push({
            owner: repo.owner,
            name: repo.name,
            stars: currentStars,
            stars_7d,
          })
        }
      }

      // Count repos not returned (deleted/private)
      for (const repo of batch) {
        if (!foundRepos.has(`${repo.owner}/${repo.name}`.toLowerCase())) {
          notFound++
        }
      }

      // Batch update repos
      for (const update of repoUpdates) {
        const { error: updateError } = await db
          .from('repos')
          .update({
            stars: update.stars,
            forks: update.forks,
            watchers: update.watchers,
            license: update.license,
            topics: update.topics,
            archived: update.archived,
            pushed_at: update.pushed_at,
          })
          .eq('id', update.id)

        if (updateError) errors++
      }

      // Batch upsert snapshots
      if (snapshotUpserts.length > 0) {
        const { error: snapError } = await db.from('repo_snapshots').upsert(
          snapshotUpserts,
          { onConflict: 'repo_id,snapshot_date', ignoreDuplicates: true }
        )

        if (snapError) {
          log(`  Batch ${batchNum} snapshot upsert error: ${snapError.message}`)
          errors += snapshotUpserts.length
        } else {
          updated += snapshotUpserts.length
        }
      }

      // Progress log
      log(`  Batch ${batchNum}/${totalBatches} — ${nodes.length} repos fetched, ${updated} updated total (cost: ${result.data?.rateLimit?.cost ?? '?'} pts, ${result.data?.rateLimit?.remaining ?? '?'} remaining)`)
    } catch (err) {
      log(`  Batch ${batchNum}/${totalBatches} — error: ${err instanceof Error ? err.message : String(err)}`)
      errors += batch.length
    }
  }

  // Filter promotion candidates — check which ones lack enrichments
  const filteredCandidates: typeof promotionCandidates = []
  for (let i = 0; i < promotionCandidates.length; i += DB_BATCH_SIZE) {
    const batch = promotionCandidates.slice(i, i + DB_BATCH_SIZE)
    const repoIds = batch
      .map((c) => repoLookup.get(`${c.owner}/${c.name}`.toLowerCase())?.id)
      .filter((id): id is string => !!id)

    if (repoIds.length === 0) continue

    const { data: enriched } = await db
      .from('enrichments')
      .select('repo_id')
      .in('repo_id', repoIds)

    const enrichedSet = new Set((enriched ?? []).map((e) => e.repo_id as string))

    for (let j = 0; j < batch.length; j++) {
      const repoId = repoLookup.get(`${batch[j].owner}/${batch[j].name}`.toLowerCase())?.id
      if (repoId && !enrichedSet.has(repoId)) {
        filteredCandidates.push(batch[j])
      }
    }
  }

  log(`\n=== Light Snapshot Complete (GraphQL) ===`)
  log(`Updated: ${updated}`)
  log(`Not found (deleted/private): ${notFound}`)
  log(`Errors: ${errors}`)
  log(`Total GraphQL cost: ${totalCost} points`)

  if (filteredCandidates.length > 0) {
    log(`\n── Promotion Candidates (no enrichment, high growth) ──`)
    for (const c of filteredCandidates.slice(0, 50)) {
      log(`  ${c.owner}/${c.name} — ${c.stars.toLocaleString()} stars, +${c.stars_7d} in 7d`)
    }
    if (filteredCandidates.length > 50) {
      log(`  ... and ${filteredCandidates.length - 50} more`)
    }
  }
}

main().catch((err) => {
  console.error('Light snapshot failed:', err)
  process.exit(1)
})
