// Fetch daily Claude Code commit counts using GitHub Search API
// Fills the gap from where BigQuery data ends (Oct 8, 2025) to today
//
// Run: npx tsx scripts/search-commits.ts
//
// Note: GitHub Search API has a 30 requests/min rate limit.
// Each day = 1 request, so ~130 days takes ~5 minutes.

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

  // Upsert the placeholder repo — creates it if missing, no-ops if it exists
  const { data: placeholder, error: pErr } = await db
    .from('repos')
    .upsert(
      {
        github_id: 0,
        name: '_bigquery_aggregate',
        owner: '_gitfind',
        description: 'Aggregate Claude Code commit data (all public GitHub repos)',
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

  // Find the last date we have data for
  const { data: latest } = await db
    .from('tool_contributions')
    .select('month')
    .eq('repo_id', repoId)
    .eq('tool_name', 'Claude Code')
    .order('month', { ascending: false })
    .limit(1)

  const lastDate = latest && latest.length > 0
    ? (latest[0] as unknown as { month: string }).month
    : '2025-10-08'

  // Start from the day after the last date we have (all dates in UTC)
  const startDate = new Date(lastDate + 'T00:00:00Z')
  startDate.setUTCDate(startDate.getUTCDate() + 1)

  // Stop at yesterday (not today) — GitHub's search index can lag ~24h,
  // so collecting "today" or even "yesterday at midnight" risks partial counts.
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const cutoffDate = new Date(cutoffStr + 'T00:00:00Z')

  log(`Filling gap from ${startDate.toISOString().slice(0, 10)} to ${cutoffStr}`)

  let imported = 0
  const current = new Date(startDate)

  while (current < cutoffDate) {
    const dateStr = current.toISOString().slice(0, 10)

    try {
      const url = `https://api.github.com/search/commits?q=${encodeURIComponent(`"Co-Authored-By: Claude" committer-date:${dateStr}`)}&per_page=1`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.cloak-preview+json',
          'User-Agent': 'GitFind/1.0',
        },
      })

      if (response.status === 403) {
        const remaining = response.headers.get('X-RateLimit-Remaining')
        if (remaining === '0') {
          const reset = response.headers.get('X-RateLimit-Reset')
          const waitMs = reset ? (parseInt(reset) * 1000 - Date.now()) : 60000
          log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`)
          await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)))
          continue // Retry this date
        }
      }

      if (!response.ok) {
        log(`Error for ${dateStr}: ${response.status}`)
        current.setUTCDate(current.getUTCDate() + 1)
        continue
      }

      const data = await response.json() as { total_count: number }
      const count = data.total_count

      await db.from('tool_contributions').upsert(
        {
          repo_id: repoId,
          tool_name: 'Claude Code',
          commit_count: count,
          month: dateStr,
        },
        { onConflict: 'repo_id,tool_name,month' }
      )

      log(`${dateStr}: ${count.toLocaleString()} commits`)
      imported++

      // Respect rate limit: 30 requests/min = 2s between requests
      await new Promise((r) => setTimeout(r, 2200))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`Error for ${dateStr}: ${msg}`)
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  log(`\nDone! Imported ${imported} days of data.`)
}

main().catch((err) => {
  console.error('Search commits failed:', err)
  process.exit(1)
})
