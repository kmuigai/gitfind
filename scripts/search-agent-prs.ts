// Track daily PR counts created by autonomous AI agent apps
// Uses GitHub Issues Search API (PRs are issues) to count PRs per bot per day.
//
// Run: npx tsx scripts/search-agent-prs.ts
//
// Note: GitHub Search API has a 30 requests/min rate limit.
// ~5 bots × 1 day = 5 requests for nightly runs.

import { config } from 'dotenv'
config({ path: '.env.local' })

const AGENTS = [
  {
    name: 'GitHub Copilot',
    slug: 'copilot-swe-agent',
    startDate: '2025-10-08',
  },
  {
    name: 'Devin',
    slug: 'devin-ai-integration',
    startDate: '2025-10-08',
  },
  {
    name: 'CodeRabbit',
    slug: 'coderabbitai',
    startDate: '2025-10-08',
  },
  {
    name: 'Sweep',
    slug: 'sweep-ai',
    startDate: '2025-10-08',
  },
] as const

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

  // Query yesterday's PRs (today's data is incomplete)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const dateStr = yesterday.toISOString().slice(0, 10)

  log(`Searching AI agent PRs for ${dateStr}`)

  for (let i = 0; i < AGENTS.length; i++) {
    const agent = AGENTS[i]
    const query = `author:app/${agent.slug} is:pr created:${dateStr}`
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=1`

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

      if (response.status === 422) {
        log(`  ${agent.name} (${agent.slug}): app not found or invalid query — skipping`)
        success = true
        continue
      }

      if (!response.ok) {
        log(`  Error for ${agent.name}: ${response.status} ${response.statusText}`)
        success = true
        continue
      }

      const data = (await response.json()) as { total_count: number }
      const count = data.total_count

      const toolName = `${agent.name} [pr]`
      const { error } = await db.from('tool_contributions').upsert(
        {
          repo_id: repoId,
          tool_name: toolName,
          commit_count: count,
          month: dateStr,
        },
        { onConflict: 'repo_id,tool_name,month' }
      )

      if (error) {
        log(`  ERROR upserting ${toolName}: ${error.message}`)
      } else {
        log(`  ${agent.name}: ${count.toLocaleString()} PRs`)
      }

      success = true
    }

    // 2.2s delay between requests (30 req/min limit)
    if (i < AGENTS.length - 1) {
      await new Promise((r) => setTimeout(r, 2200))
    }
  }

  log(`\nDone! Stored ${AGENTS.length} agent PR entries for ${dateStr}.`)
}

main().catch((err: unknown) => {
  console.error('Search agent PRs failed:', err)
  process.exit(1)
})
