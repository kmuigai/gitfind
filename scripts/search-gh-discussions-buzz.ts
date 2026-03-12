// Track GitHub Discussions mention counts per AI coding tool
// Uses GitHub GraphQL API (requires GITHUB_TOKEN)
// Stores 7-day discussion counts per tool.
//
// Run: npx tsx scripts/search-gh-discussions-buzz.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const TOOLS = [
  { name: 'Claude Code', queries: ['"claude code"', '"claude cli"'] },
  { name: 'Cursor', queries: ['"cursor ai"', '"cursor editor"'] },
  { name: 'GitHub Copilot', queries: ['"github copilot"'] },
  { name: 'Aider', queries: ['"aider" coding'] },
  { name: 'Gemini CLI', queries: ['"gemini cli"', '"gemini code assist"'] },
  { name: 'Devin', queries: ['"devin ai"'] },
  { name: 'Codex', queries: ['"openai codex"', '"codex cli"'] },
  { name: 'Windsurf', queries: ['"windsurf" editor'] },
] as const

interface GHGraphQLResponse {
  data?: {
    search: {
      discussionCount: number
    }
  }
  errors?: Array<{ message: string }>
}

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

async function searchDiscussions(query: string, since: string, token: string): Promise<number> {
  const gqlQuery = `
    query($q: String!) {
      search(query: $q, type: DISCUSSION) {
        discussionCount
      }
    }
  `

  const searchQuery = `${query} created:>${since}`

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GitFind/1.0',
    },
    body: JSON.stringify({
      query: gqlQuery,
      variables: { q: searchQuery },
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub GraphQL API returned ${response.status}`)
  }

  const data = (await response.json()) as GHGraphQLResponse

  if (data.errors) {
    throw new Error(data.errors.map((e) => e.message).join(', '))
  }

  return data.data?.search.discussionCount ?? 0
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITFIND_GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN or GITFIND_GITHUB_TOKEN is required')
    process.exit(1)
  }

  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

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

  // 7 days ago in YYYY-MM-DD format
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10)

  log(`Searching GitHub Discussions for AI coding tools (since ${sevenDaysAgo})`)

  for (const tool of TOOLS) {
    let totalCount = 0

    for (const query of tool.queries) {
      try {
        const count = await searchDiscussions(query, sevenDaysAgo, token)
        totalCount += count
      } catch (err) {
        log(`  Error for ${tool.name} query "${query}": ${err instanceof Error ? err.message : String(err)}`)
      }

      // Respect rate limits — wait 1s between requests
      await new Promise((r) => setTimeout(r, 1000))
    }

    // Store mention count with [gh-discussions-buzz] suffix
    const toolNameMentions = `${tool.name} [gh-discussions-buzz]`
    const { error: mentionErr } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: toolNameMentions,
        commit_count: totalCount,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )

    if (mentionErr) {
      log(`  ERROR upserting ${toolNameMentions}: ${mentionErr.message}`)
    }

    log(`  ${tool.name}: ${totalCount} discussions`)
  }

  log(`\nDone! Stored GitHub Discussions buzz data for ${TOOLS.length} tools.`)
}

main().catch((err: unknown) => {
  console.error('Search GH Discussions buzz failed:', err)
  process.exit(1)
})
