// Light Snapshot Script
// Fetches current star/fork counts for ALL repos in the DB via GitHub REST API.
// Upserts into repo_snapshots with today's date. Calculates stars_7d from snapshot diff.
//
// GitHub API cost: 1 call per repo. 10K repos ≈ 2 hours at 5K/hour.
// Built-in rate limiter: reads X-RateLimit-Remaining, sleeps when low.
//
// Run locally: npx tsx scripts/snapshot-light.ts
// Run nightly: GitHub Actions at 06:00 UTC (separate workflow)

import { config } from 'dotenv'
config({ path: '.env.local' })

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const RATE_LIMIT_FLOOR = 100 // Sleep when remaining drops below this
const BATCH_SIZE = 100 // Process repos in batches for DB queries

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

// Sleep until the rate limit resets
async function sleepUntilReset(resetTimestamp: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const sleepSeconds = Math.max(resetTimestamp - now + 5, 10) // +5s buffer
  log(`  Rate limit low — sleeping ${sleepSeconds}s until reset...`)
  await new Promise((r) => setTimeout(r, sleepSeconds * 1000))
}

interface RepoRow {
  id: string
  github_id: number
  owner: string
  name: string
  stars: number
  forks: number
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const todayStr = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  log('=== Light Snapshot Script ===')
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

  for (let i = 0; i < allRepos.length; i += BATCH_SIZE) {
    const batch = allRepos.slice(i, i + BATCH_SIZE)
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

  // Process each repo
  let updated = 0
  const skipped = 0
  let deleted = 0
  let errors = 0
  const promotionCandidates: Array<{ owner: string; name: string; stars: number; stars_7d: number }> = []

  for (let i = 0; i < allRepos.length; i++) {
    const repo = allRepos[i]
    const label = `${repo.owner}/${repo.name}`

    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}`, {
        headers: githubHeaders(),
      })

      // Check rate limit headers
      const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '5000', 10)
      const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10)

      if (remaining < RATE_LIMIT_FLOOR && resetAt > 0) {
        await sleepUntilReset(resetAt)
      }

      if (response.status === 404) {
        // Repo deleted or made private
        log(`  ${label} → 404 (deleted/private), skipping`)
        deleted++
        continue
      }

      if (response.status === 403 && remaining === 0) {
        // Rate limited — sleep and retry this repo
        if (resetAt > 0) {
          await sleepUntilReset(resetAt)
          i-- // Retry this repo
          continue
        }
      }

      if (!response.ok) {
        log(`  ${label} → HTTP ${response.status}, skipping`)
        errors++
        continue
      }

      const data = (await response.json()) as {
        stargazers_count: number
        forks_count: number
      }

      const currentStars = data.stargazers_count
      const currentForks = data.forks_count

      // Calculate stars_7d from snapshot diff
      const stars7dAgo = snapshots7d.get(repo.id)
      const stars_7d = stars7dAgo !== undefined ? currentStars - stars7dAgo : 0

      // Update repo row with current stats
      await db
        .from('repos')
        .update({
          stars: currentStars,
          forks: currentForks,
        })
        .eq('id', repo.id)

      // Upsert today's snapshot
      const { error: snapError } = await db.from('repo_snapshots').upsert(
        {
          repo_id: repo.id,
          snapshot_date: todayStr,
          stars: currentStars,
          forks: currentForks,
          stars_7d,
        },
        { onConflict: 'repo_id,snapshot_date', ignoreDuplicates: true }
      )

      if (snapError) {
        log(`  ${label} → snapshot error: ${snapError.message}`)
        errors++
      } else {
        updated++
      }

      // Check promotion candidates (high-growth repos without enrichment)
      if (stars_7d >= 50 || currentStars >= 500) {
        const { data: hasEnrichment } = await db
          .from('enrichments')
          .select('id')
          .eq('repo_id', repo.id)
          .maybeSingle()

        if (!hasEnrichment) {
          promotionCandidates.push({
            owner: repo.owner,
            name: repo.name,
            stars: currentStars,
            stars_7d,
          })
        }
      }

      // Progress log every 500 repos
      if ((i + 1) % 500 === 0) {
        log(`  Progress: ${i + 1}/${allRepos.length} (${updated} updated, ${deleted} deleted, ${errors} errors)`)
      }
    } catch (err) {
      log(`  ${label} → error: ${err instanceof Error ? err.message : String(err)}`)
      errors++
    }
  }

  log(`\n=== Light Snapshot Complete ===`)
  log(`Updated: ${updated}`)
  log(`Deleted/private: ${deleted}`)
  log(`Errors: ${errors}`)
  log(`Skipped: ${skipped}`)

  if (promotionCandidates.length > 0) {
    log(`\n── Promotion Candidates (no enrichment, high growth) ──`)
    for (const c of promotionCandidates.slice(0, 50)) {
      log(`  ${c.owner}/${c.name} — ${c.stars.toLocaleString()} stars, +${c.stars_7d} in 7d`)
    }
    if (promotionCandidates.length > 50) {
      log(`  ... and ${promotionCandidates.length - 50} more`)
    }
  }
}

main().catch((err) => {
  console.error('Light snapshot failed:', err)
  process.exit(1)
})
