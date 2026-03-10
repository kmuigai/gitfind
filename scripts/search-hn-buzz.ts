// Track Hacker News mention counts per AI coding tool
// Uses the HN Algolia API (free, no auth, 10K req/hr)
// Stores 7-day story counts and total points per tool.
//
// Run: npx tsx scripts/search-hn-buzz.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const TOOLS = [
  { name: 'Claude Code', queries: ['"claude code"', '"claude cli"'] },
  { name: 'Cursor', queries: ['"cursor ai"', '"cursor editor"'] },
  { name: 'GitHub Copilot', queries: ['"github copilot"'] },
  { name: 'Aider', queries: ['"aider ai"', '"aider coding"'] },
  { name: 'Gemini CLI', queries: ['"gemini cli"', '"gemini code assist"'] },
  { name: 'Devin', queries: ['"devin ai"'] },
  { name: 'Codex', queries: ['"openai codex" OR "codex cli"'] },
  { name: 'Windsurf', queries: ['"windsurf ai"', '"windsurf editor"'] },
] as const

interface HNSearchResponse {
  nbHits: number
  hits: Array<{
    points: number | null
    num_comments: number | null
  }>
}

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
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

  // Search window: last 7 days
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400

  log(`Searching HN stories for AI coding tools (last 7 days)`)

  for (const tool of TOOLS) {
    let totalHits = 0
    let totalPoints = 0
    let totalComments = 0

    for (const query of tool.queries) {
      const params = new URLSearchParams({
        query,
        tags: 'story',
        numericFilters: `created_at_i>${sevenDaysAgo}`,
        hitsPerPage: '100',
      })

      const url = `https://hn.algolia.com/api/v1/search?${params.toString()}`

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'GitFind/1.0' },
        })

        if (!response.ok) {
          log(`  Error for ${tool.name} query "${query}": ${response.status}`)
          continue
        }

        const data = (await response.json()) as HNSearchResponse
        totalHits += data.nbHits

        for (const hit of data.hits) {
          totalPoints += hit.points ?? 0
          totalComments += hit.num_comments ?? 0
        }
      } catch (err) {
        log(`  Fetch error for ${tool.name}: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Small delay to be polite (HN Algolia allows 10K/hr but no need to hammer)
      await new Promise((r) => setTimeout(r, 500))
    }

    // Store mention count with [hn-buzz] suffix
    const toolNameMentions = `${tool.name} [hn-buzz]`
    const { error: mentionErr } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: toolNameMentions,
        commit_count: totalHits,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )

    if (mentionErr) {
      log(`  ERROR upserting ${toolNameMentions}: ${mentionErr.message}`)
    }

    // Store engagement (points) with [hn-points] suffix
    const toolNamePoints = `${tool.name} [hn-points]`
    const { error: pointsErr } = await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: toolNamePoints,
        commit_count: totalPoints,
        month: today,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )

    if (pointsErr) {
      log(`  ERROR upserting ${toolNamePoints}: ${pointsErr.message}`)
    }

    log(`  ${tool.name}: ${totalHits} stories, ${totalPoints} points, ${totalComments} comments`)
  }

  log(`\nDone! Stored HN buzz data for ${TOOLS.length} tools.`)
}

main().catch((err: unknown) => {
  console.error('Search HN buzz failed:', err)
  process.exit(1)
})
