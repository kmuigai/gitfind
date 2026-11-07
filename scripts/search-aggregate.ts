// Track deduplicated total repos with ANY AI tool presence
// Uses OR queries so GitHub deduplicates across tools for us.
//
// Two aggregate counts:
//   1. Config files: repos with any AI config file (CLAUDE.md, .cursorrules, etc.)
//   2. Commits: commits with any AI co-author attribution (yesterday)
//
// Run: npx tsx scripts/search-aggregate.ts
//
// Rate limit: 1 code search (10 req/min) + 1 commit search (30 req/min) on a
// normal day; days spent backfilling aggregate gaps add 1 commit search each.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { upsertPlaceholderRepo } from './upsert-placeholder.js'

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN not set')
    process.exit(1)
  }

  const repoId = await upsertPlaceholderRepo(db)
  const today = new Date().toISOString().slice(0, 10)

  // T-2 for commit search (same as search-commits.ts)
  const twoDaysAgo = new Date()
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)
  const commitDate = twoDaysAgo.toISOString().slice(0, 10)

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GitFind/1.0',
  }

  // ── 1. Aggregate config file count ──
  // GitHub Code Search doesn't support OR with filename: qualifiers via REST API.
  // Instead, query each config file individually and sum (includes overlap).
  log('Fetching aggregate config file count...')
  const configQueries = [
    'filename:CLAUDE.md path:/',
    'filename:AGENTS.md path:/',
    'filename:.cursorrules',
    'filename:copilot-instructions.md path:.github',
    'filename:.windsurfrules',
    'filename:.aider.conf.yml',
  ]

  let configTotal = 0
  const seenTools = new Set<string>()

  for (const q of configQueries) {
    const configUrl = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=1`

    let querySuccess = false
    while (!querySuccess) {
      const response = await fetch(configUrl, { headers })

      if (response.status === 403) {
        const remaining = response.headers.get('X-RateLimit-Remaining')
        if (remaining === '0') {
          const reset = response.headers.get('X-RateLimit-Reset')
          const waitMs = reset ? parseInt(reset) * 1000 - Date.now() : 60000
          log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`)
          await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)))
          continue
        }
      }

      if (!response.ok) {
        log(`  Error fetching ${q}: ${response.status} ${response.statusText}`)
        querySuccess = true
        continue
      }

      const data = (await response.json()) as { total_count: number; incomplete_results: boolean }
      configTotal += data.total_count
      seenTools.add(q)

      if (data.incomplete_results) {
        log(`  WARNING: incomplete results for ${q}`)
      }

      log(`  ${q}: ${data.total_count.toLocaleString()} repos`)
      querySuccess = true
    }

    // 6.5s delay between code search requests (10 req/min)
    await new Promise((r) => setTimeout(r, 6500))
  }

  log(`  Config aggregate (sum, may include overlap): ${configTotal.toLocaleString()} repos`)

  if (seenTools.size > 0) {
    const { error } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: 'All Tools [config-aggregate]',
        commit_count: configTotal,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )
    if (error) log(`  ERROR upserting config aggregate: ${error.message}`)
  }

  // ── 2. Aggregate commit count (OR query for a single day) ──
  const commitQuery = [
    `"Co-Authored-By: Claude"`,
    `"Co-authored-by: Cursor"`,
    `"Co-authored-by: aider"`,
    `"Co-authored-by: Codex"`,
    `"gemini-code-assist"`,
  ].join(' OR ')

  // Fetch the deduplicated aggregate commit count for one date.
  // Returns null on a hard API error so the caller can skip the day.
  async function fetchCommitAggregate(dateStr: string): Promise<number | null> {
    const url = `https://api.github.com/search/commits?q=${encodeURIComponent(`${commitQuery} committer-date:${dateStr}`)}&per_page=1`

    while (true) {
      const response = await fetch(url, {
        headers: {
          ...headers,
          Accept: 'application/vnd.github.cloak-preview+json',
        },
      })

      if (response.status === 403) {
        const remaining = response.headers.get('X-RateLimit-Remaining')
        if (remaining === '0') {
          // Primary rate limit — wait until reset
          const reset = response.headers.get('X-RateLimit-Reset')
          const waitMs = reset ? parseInt(reset) * 1000 - Date.now() : 60000
          log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`)
          await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)))
          continue
        }
        // Secondary rate limit — wait and retry (same as search-commits.ts)
        log(`Secondary rate limit for aggregate ${dateStr} — waiting 90s...`)
        await new Promise((r) => setTimeout(r, 90000))
        continue
      }

      if (!response.ok) {
        log(`  Error fetching commit aggregate for ${dateStr}: ${response.status} ${response.statusText}`)
        return null
      }

      const data = (await response.json()) as { total_count: number }
      return data.total_count
    }
  }

  async function upsertCommitAggregate(dateStr: string, count: number): Promise<void> {
    const { error } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: 'All Tools [commit-aggregate]',
        commit_count: count,
        month: dateStr,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )
    if (error) log(`  ERROR upserting commit aggregate for ${dateStr}: ${error.message}`)
  }

  log(`Fetching aggregate commit count for ${commitDate}...`)
  const commitCount = await fetchCommitAggregate(commitDate)

  if (commitCount !== null) {
    log(`  Commit aggregate: ${commitCount.toLocaleString()} commits`)
    await upsertCommitAggregate(commitDate, commitCount)
  }

  // ── 3. Backfill interior gaps in the commit-aggregate series ──
  // When the Chart Data workflow doesn't run for a stretch (e.g. the
  // Sep 30 – Nov 4, 2026 freeze), every missed day is missing for good:
  // the pass above only ever writes T-2. The per-tool rows for those days
  // are complete, and the OR query is date-scoped, so a missing aggregate
  // day can be recomputed exactly. Fill only dates inside the stored
  // range — never extend the series before its first row.
  const { data: aggRows } = await db
    .from('tool_contributions')
    .select('month')
    .eq('repo_id', repoId)
    .eq('tool_name', 'All Tools [commit-aggregate]')
    .order('month', { ascending: true })

  if (aggRows && aggRows.length > 0) {
    const months = (aggRows as unknown as Array<{ month: string }>).map((r) => r.month)
    const present = new Set(months)

    const missingDates: string[] = []
    const cur = new Date(months[0] + 'T00:00:00Z')
    const end = new Date(commitDate + 'T00:00:00Z')
    cur.setUTCDate(cur.getUTCDate() + 1)
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10)
      if (!present.has(d)) missingDates.push(d)
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    if (missingDates.length === 0) {
      log('Commit aggregate: no interior gaps')
    } else {
      log(`Commit aggregate: backfilling ${missingDates.length} missing day(s)...`)
      let backfilled = 0
      for (const dateStr of missingDates) {
        const count = await fetchCommitAggregate(dateStr)
        if (count === null) continue
        // Zero-guard: the OR query spans five tools, so a 0 means a broken
        // query string (see issue #41), not a real zero. Leave the day
        // missing so a later run retries it instead of storing a bogus 0.
        if (count === 0) {
          log(`  [backfill] WARNING: ${dateStr}: API returned 0 — skipping, will retry next run`)
          continue
        }
        await upsertCommitAggregate(dateStr, count)
        log(`  [backfill] ${dateStr}: ${count.toLocaleString()} commits`)
        backfilled++
        // Respect the commit search rate limit: 30 requests/min
        await new Promise((r) => setTimeout(r, 2200))
      }
      log(`Commit aggregate: backfilled ${backfilled} day(s)`)
    }
  }

  log('\nDone! Stored aggregate counts.')
}

main().catch((err: unknown) => {
  console.error('Search aggregate failed:', err)
  process.exit(1)
})
