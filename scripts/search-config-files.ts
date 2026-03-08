// Track AI tool config file adoption across GitHub using Code Search API
// Searches for root-level config files (AGENTS.md, .cursorrules, etc.) and
// stores daily totals in tool_contributions with "[config]" suffix.
//
// Run: npx tsx scripts/search-config-files.ts
//
// Note: GitHub Code Search API allows 10 requests/min.
// 7 queries → ~45s total with 6.5s delays.

import { config } from 'dotenv'
config({ path: '.env.local' })

interface ConfigQuery {
  label: string
  tool: string
  query: string
}

const CONFIG_QUERIES: ConfigQuery[] = [
  {
    label: 'AGENTS.md',
    tool: 'Claude Code',
    query: 'filename:AGENTS.md path:/',
  },
  {
    label: 'CLAUDE.md',
    tool: 'Claude Code',
    query: 'filename:CLAUDE.md path:/',
  },
  {
    label: '.cursorrules',
    tool: 'Cursor',
    query: 'filename:.cursorrules',
  },
  {
    label: '.cursor/rules',
    tool: 'Cursor',
    query: 'path:.cursor filename:rules',
  },
  {
    label: 'copilot-instructions.md',
    tool: 'GitHub Copilot',
    query: 'filename:copilot-instructions.md path:.github',
  },
  {
    label: '.windsurfrules',
    tool: 'Windsurf',
    query: 'filename:.windsurfrules',
  },
  {
    label: '.aider.conf.yml',
    tool: 'Aider',
    query: 'filename:.aider.conf.yml',
  },
]

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

// 6.5s delay between requests (Code Search: 10 req/min)
function rateLimitDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 6500))
}

interface CodeSearchResponse {
  total_count: number
  incomplete_results: boolean
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const token = process.env.GITFIND_GITHUB_TOKEN
  if (!token) {
    console.error('GITFIND_GITHUB_TOKEN not set')
    process.exit(1)
  }

  // Upsert the placeholder repo — same one used by search-commits.ts
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

  log(`Searching config files — storing results for ${today}`)

  // Fetch total_count for each query
  const counts = new Map<string, number>()

  for (let i = 0; i < CONFIG_QUERIES.length; i++) {
    const q = CONFIG_QUERIES[i]
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(q.query)}&per_page=1`

    let success = false
    while (!success) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'GitFind/1.0',
        },
      })

      if (response.status === 403) {
        const remaining = response.headers.get('X-RateLimit-Remaining')
        if (remaining === '0') {
          const reset = response.headers.get('X-RateLimit-Reset')
          const waitMs = reset ? parseInt(reset) * 1000 - Date.now() : 60000
          log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`)
          await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)))
          continue // Retry same query
        }
      }

      if (!response.ok) {
        log(`Error for ${q.label}: ${response.status} ${response.statusText}`)
        success = true // Skip this query
        continue
      }

      const data = (await response.json()) as CodeSearchResponse
      const count = data.total_count

      if (data.incomplete_results) {
        log(`  WARNING: incomplete results for ${q.label}`)
      }

      log(`${q.label}: ${count.toLocaleString()} repos`)
      counts.set(q.label, count)
      success = true
    }

    // Rate limit delay (skip after last request)
    if (i < CONFIG_QUERIES.length - 1) {
      await rateLimitDelay()
    }
  }

  // Combine counts by tool
  const toolTotals = new Map<string, number>()

  for (const q of CONFIG_QUERIES) {
    const count = counts.get(q.label) ?? 0
    toolTotals.set(q.tool, (toolTotals.get(q.tool) ?? 0) + count)
  }

  // Upsert combined totals into tool_contributions with "[config]" suffix
  log('\nUpserting combined totals:')

  for (const [tool, total] of toolTotals) {
    const toolName = `${tool} [config]`

    const { error } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: toolName,
        commit_count: total,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )

    if (error) {
      log(`  ERROR upserting ${toolName}: ${error.message}`)
    } else {
      log(`  ${toolName}: ${total.toLocaleString()} repos`)
    }
  }

  log(`\nDone! Stored ${toolTotals.size} config adoption entries for ${today}.`)
}

main().catch((err: unknown) => {
  console.error('Search config files failed:', err)
  process.exit(1)
})
