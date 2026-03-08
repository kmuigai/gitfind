// Track AI SDK dependency adoption across GitHub using Code Search API
// Searches for SDK packages in package.json / requirements.txt and
// stores daily totals in tool_contributions with "[sdk]" suffix.
//
// Run: npx tsx scripts/search-sdk-deps.ts
//
// Note: GitHub Code Search API allows 10 requests/min.
// 5 queries → ~35s total with 6.5s delays.

import { config } from 'dotenv'
config({ path: '.env.local' })

interface SDKQuery {
  label: string
  tool: string
  query: string
}

const SDK_QUERIES: SDKQuery[] = [
  {
    label: '@anthropic-ai/sdk (npm)',
    tool: 'Anthropic',
    query: '"@anthropic-ai/sdk" filename:package.json',
  },
  {
    label: 'anthropic (PyPI)',
    tool: 'Anthropic',
    query: '"anthropic" filename:requirements.txt',
  },
  {
    label: 'openai (npm)',
    tool: 'OpenAI',
    query: '"openai" filename:package.json',
  },
  {
    label: 'openai (PyPI)',
    tool: 'OpenAI',
    query: '"openai" filename:requirements.txt',
  },
  {
    label: 'langchain (PyPI)',
    tool: 'LangChain',
    query: '"langchain" filename:requirements.txt',
  },
]

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

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

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN not set')
    process.exit(1)
  }

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

  log(`Searching SDK dependencies — storing results for ${today}`)

  const counts = new Map<string, number>()

  for (let i = 0; i < SDK_QUERIES.length; i++) {
    const q = SDK_QUERIES[i]
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
          continue
        }
      }

      if (!response.ok) {
        log(`Error for ${q.label}: ${response.status} ${response.statusText}`)
        success = true
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

    if (i < SDK_QUERIES.length - 1) {
      await rateLimitDelay()
    }
  }

  // Combine counts by tool
  const toolTotals = new Map<string, number>()

  for (const q of SDK_QUERIES) {
    const count = counts.get(q.label) ?? 0
    toolTotals.set(q.tool, (toolTotals.get(q.tool) ?? 0) + count)
  }

  log('\nUpserting combined totals:')

  for (const [tool, total] of toolTotals) {
    const toolName = `${tool} [sdk]`

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

  log(`\nDone! Stored ${toolTotals.size} SDK adoption entries for ${today}.`)
}

main().catch((err: unknown) => {
  console.error('Search SDK deps failed:', err)
  process.exit(1)
})
