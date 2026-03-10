// Track deduplicated total repos with ANY AI tool presence
// Uses OR queries so GitHub deduplicates across tools for us.
//
// Two aggregate counts:
//   1. Config files: repos with any AI config file (CLAUDE.md, .cursorrules, etc.)
//   2. Commits: commits with any AI co-author attribution (yesterday)
//
// Run: npx tsx scripts/search-aggregate.ts
//
// Rate limit: 1 code search (10 req/min) + 1 commit search (30 req/min) = 2 requests total

import { config } from 'dotenv'
config({ path: '.env.local' })

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

  // Upsert the placeholder repo
  const { data: placeholder, error: pErr } = await db
    .from('repos')
    .upsert(
      {
        github_id: 0,
        name: '_bigquery_aggregate',
        owner: '_gitfind',
        description: 'Aggregate AI coding tool commit data (all public GitHub repos)',
        stars: 0,
        forks: 0,
        contributors: 0,
        url: 'https://github.com',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_id' }
    )
    .select('id')
    .single()

  if (pErr || !placeholder) {
    console.error('Failed to upsert placeholder repo:', pErr)
    process.exit(1)
  }

  const repoId = placeholder.id
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

  // ── 1. Aggregate config file count (OR query) ──
  log('Fetching aggregate config file count...')
  const configQuery = [
    'filename:CLAUDE.md path:/',
    'filename:AGENTS.md path:/',
    'filename:.cursorrules',
    'filename:copilot-instructions.md path:.github',
    'filename:.windsurfrules',
    'filename:.aider.conf.yml',
  ].join(' OR ')

  const configUrl = `https://api.github.com/search/code?q=${encodeURIComponent(configQuery)}&per_page=1`

  let configCount: number | null = null
  let configSuccess = false
  while (!configSuccess) {
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
      log(`  Error fetching config aggregate: ${response.status} ${response.statusText}`)
      configSuccess = true
      continue
    }

    const data = (await response.json()) as { total_count: number; incomplete_results: boolean }
    configCount = data.total_count

    if (data.incomplete_results) {
      log('  WARNING: incomplete results for config aggregate')
    }

    log(`  Config aggregate: ${configCount.toLocaleString()} repos`)
    configSuccess = true
  }

  if (configCount !== null) {
    const { error } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: 'All Tools [config-aggregate]',
        commit_count: configCount,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )
    if (error) log(`  ERROR upserting config aggregate: ${error.message}`)
  }

  // 6.5s delay — code search and commit search share a combined budget
  await new Promise((r) => setTimeout(r, 6500))

  // ── 2. Aggregate commit count (OR query for a single day) ──
  log(`Fetching aggregate commit count for ${commitDate}...`)
  const commitQuery = [
    `"Co-Authored-By: Claude"`,
    `"Co-authored-by: Cursor"`,
    `"Co-authored-by: aider"`,
    `"Co-authored-by: Codex"`,
    `"gemini-code-assist"`,
  ].join(' OR ')
  const fullCommitQuery = `${commitQuery} committer-date:${commitDate}`

  const commitUrl = `https://api.github.com/search/commits?q=${encodeURIComponent(fullCommitQuery)}&per_page=1`

  let commitCount: number | null = null
  let commitSuccess = false
  while (!commitSuccess) {
    const response = await fetch(commitUrl, {
      headers: {
        ...headers,
        Accept: 'application/vnd.github.cloak-preview+json',
      },
    })

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
      log(`  Error fetching commit aggregate: ${response.status} ${response.statusText}`)
      commitSuccess = true
      continue
    }

    const data = (await response.json()) as { total_count: number }
    commitCount = data.total_count

    log(`  Commit aggregate: ${commitCount.toLocaleString()} commits`)
    commitSuccess = true
  }

  if (commitCount !== null) {
    const { error } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: 'All Tools [commit-aggregate]',
        commit_count: commitCount,
        month: commitDate,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )
    if (error) log(`  ERROR upserting commit aggregate: ${error.message}`)
  }

  log('\nDone! Stored aggregate counts.')
}

main().catch((err: unknown) => {
  console.error('Search aggregate failed:', err)
  process.exit(1)
})
