// Track Reddit mention counts per AI coding tool
// Uses Reddit's public JSON API (no auth, ~3-5 req/min)
// Stores 7-day post counts per tool.
//
// Run: npx tsx scripts/search-reddit-buzz.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const TOOLS = [
  { name: 'Claude Code', queries: ['"claude code"', '"claude cli"'] },
  { name: 'Cursor', queries: ['"cursor ai" editor', '"cursor editor" ai'] },
  { name: 'GitHub Copilot', queries: ['"github copilot"'] },
  { name: 'Aider', queries: ['"aider" ai coding'] },
  { name: 'Gemini CLI', queries: ['"gemini cli"', '"gemini code assist"'] },
  { name: 'Devin', queries: ['"devin ai"'] },
  { name: 'Codex', queries: ['"openai codex"', '"codex cli"'] },
  { name: 'Windsurf', queries: ['"windsurf" ai editor'] },
] as const

interface RedditSearchResponse {
  data: {
    children: Array<{
      data: {
        score: number
        num_comments: number
      }
    }>
    after: string | null
  }
}

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

async function searchReddit(query: string): Promise<{ posts: number; score: number }> {
  const params = new URLSearchParams({
    q: query,
    t: 'week',
    sort: 'relevance',
    limit: '100',
    type: 'link',
  })

  const url = `https://www.reddit.com/search.json?${params.toString()}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GitFind/1.0 (https://gitfind.ai)',
    },
  })

  if (!response.ok) {
    throw new Error(`Reddit API returned ${response.status}`)
  }

  const data = (await response.json()) as RedditSearchResponse
  let totalScore = 0

  for (const child of data.data.children) {
    totalScore += child.data.score ?? 0
  }

  return { posts: data.data.children.length, score: totalScore }
}

async function main(): Promise<void> {
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

  log(`Searching Reddit for AI coding tools (last 7 days)`)

  for (const tool of TOOLS) {
    let totalPosts = 0
    let totalScore = 0

    for (const query of tool.queries) {
      try {
        const result = await searchReddit(query)
        totalPosts += result.posts
        totalScore += result.score
      } catch (err) {
        log(`  Error for ${tool.name} query "${query}": ${err instanceof Error ? err.message : String(err)}`)
      }

      // Respect rate limits — wait 1.5s between requests
      await new Promise((r) => setTimeout(r, 1500))
    }

    // Store mention count with [reddit-buzz] suffix
    const toolNameMentions = `${tool.name} [reddit-buzz]`
    const { error: mentionErr } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: toolNameMentions,
        commit_count: totalPosts,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )

    if (mentionErr) {
      log(`  ERROR upserting ${toolNameMentions}: ${mentionErr.message}`)
    }

    log(`  ${tool.name}: ${totalPosts} posts, ${totalScore} score`)
  }

  log(`\nDone! Stored Reddit buzz data for ${TOOLS.length} tools.`)
}

main().catch((err: unknown) => {
  console.error('Search Reddit buzz failed:', err)
  process.exit(1)
})
