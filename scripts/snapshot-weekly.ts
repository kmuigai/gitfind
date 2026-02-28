// Weekly Stats Script
// Fetches contributor count, 4-week commit activity, and latest release for ALL repos.
// Upserts into weekly_stats table.
//
// GitHub API cost: 5 calls per repo. 8K repos ≈ 40K calls ≈ 8 hours at 5K/hour.
// Runs weekly on Sundays at 08:00 UTC via GitHub Actions.
//
// Run locally: npx tsx scripts/snapshot-weekly.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const RATE_LIMIT_FLOOR = 100

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

async function sleepUntilReset(resetTimestamp: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const sleepSeconds = Math.max(resetTimestamp - now + 5, 10)
  log(`  Rate limit low — sleeping ${sleepSeconds}s until reset...`)
  await new Promise((r) => setTimeout(r, sleepSeconds * 1000))
}

async function checkRateLimit(response: Response): Promise<void> {
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '5000', 10)
  const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10)

  if (remaining < RATE_LIMIT_FLOOR && resetAt > 0) {
    await sleepUntilReset(resetAt)
  }
}

// Get contributor count from Link header (avoids paginating all contributors)
async function getContributorCount(owner: string, name: string): Promise<number> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/contributors?per_page=1&anon=true`,
    { headers: githubHeaders() }
  )

  await checkRateLimit(response)

  if (!response.ok) return 0

  // Parse last page number from Link header to get total count
  const linkHeader = response.headers.get('Link')
  if (!linkHeader) {
    // No Link header = 1 page = check how many items
    const data = await response.json()
    return Array.isArray(data) ? data.length : 0
  }

  const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
  if (lastMatch) {
    return parseInt(lastMatch[1], 10)
  }

  return 1
}

// Get commit count for last 4 weeks from commit_activity stats
async function getCommitCount4w(owner: string, name: string): Promise<number> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/stats/commit_activity`,
    { headers: githubHeaders() }
  )

  await checkRateLimit(response)

  // GitHub returns 202 when stats are being computed — treat as 0
  if (response.status === 202 || !response.ok) return 0

  const data = (await response.json()) as Array<{ total: number; week: number }>
  if (!Array.isArray(data) || data.length === 0) return 0

  // Sum last 4 weeks
  const last4 = data.slice(-4)
  return last4.reduce((sum, week) => sum + week.total, 0)
}

// Get owner vs community commits for last 4 weeks from participation stats
async function getParticipation(
  owner: string,
  name: string
): Promise<{ ownerCommits: number; communityCommits: number }> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/stats/participation`,
    { headers: githubHeaders() }
  )

  await checkRateLimit(response)

  // GitHub returns 202 when stats are being computed
  if (response.status === 202 || !response.ok) return { ownerCommits: 0, communityCommits: 0 }

  const data = (await response.json()) as { owner: number[]; all: number[] }
  if (!data.owner || !data.all) return { ownerCommits: 0, communityCommits: 0 }

  // Last 4 weeks
  const ownerLast4 = data.owner.slice(-4)
  const allLast4 = data.all.slice(-4)

  const ownerCommits = ownerLast4.reduce((sum, w) => sum + w, 0)
  const totalCommits = allLast4.reduce((sum, w) => sum + w, 0)

  return { ownerCommits, communityCommits: totalCommits - ownerCommits }
}

// Get code additions/deletions for last 4 weeks from code frequency stats
async function getCodeFrequency(
  owner: string,
  name: string
): Promise<{ additions: number; deletions: number }> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/stats/code_frequency`,
    { headers: githubHeaders() }
  )

  await checkRateLimit(response)

  // GitHub returns 202 when stats are being computed
  if (response.status === 202 || !response.ok) return { additions: 0, deletions: 0 }

  // Returns array of [unix_timestamp, additions, deletions] per week
  const data = (await response.json()) as Array<[number, number, number]>
  if (!Array.isArray(data) || data.length === 0) return { additions: 0, deletions: 0 }

  // Last 4 weeks
  const last4 = data.slice(-4)
  const additions = last4.reduce((sum, week) => sum + week[1], 0)
  const deletions = last4.reduce((sum, week) => sum + Math.abs(week[2]), 0)

  return { additions, deletions }
}

// Get latest release date and tag
async function getLatestRelease(
  owner: string,
  name: string
): Promise<{ date: string | null; tag: string | null }> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/releases?per_page=1`,
    { headers: githubHeaders() }
  )

  await checkRateLimit(response)

  if (!response.ok) return { date: null, tag: null }

  const data = (await response.json()) as Array<{
    published_at: string | null
    tag_name: string
  }>

  if (!Array.isArray(data) || data.length === 0) return { date: null, tag: null }

  const release = data[0]
  return {
    date: release.published_at ? release.published_at.split('T')[0] : null,
    tag: release.tag_name || null,
  }
}

interface RepoRow {
  id: string
  owner: string
  name: string
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const todayStr = new Date().toISOString().split('T')[0]

  log('=== Weekly Stats Script ===')
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

  let updated = 0
  let errors = 0

  for (let i = 0; i < allRepos.length; i++) {
    const repo = allRepos[i]
    const label = `${repo.owner}/${repo.name}`

    try {
      // 5 API calls per repo
      const contributors = await getContributorCount(repo.owner, repo.name)
      const commitCount4w = await getCommitCount4w(repo.owner, repo.name)
      const release = await getLatestRelease(repo.owner, repo.name)
      const participation = await getParticipation(repo.owner, repo.name)
      const codeFreq = await getCodeFrequency(repo.owner, repo.name)

      const { error: upsertError } = await db.from('weekly_stats').upsert(
        {
          repo_id: repo.id,
          snapshot_date: todayStr,
          contributors,
          commit_count_4w: commitCount4w,
          last_release_date: release.date,
          last_release_tag: release.tag,
          owner_commits_4w: participation.ownerCommits,
          community_commits_4w: participation.communityCommits,
          additions_4w: codeFreq.additions,
          deletions_4w: codeFreq.deletions,
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
}

main().catch((err) => {
  console.error('Weekly stats failed:', err)
  process.exit(1)
})
