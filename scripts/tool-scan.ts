// Tool Scan — Broad Co-Authored-By scanner for high-star public repos
// Scans repos beyond GitFind's 8 categories for AI tool attribution data.
// Writes only to `tool_contributions` (+ minimal `repos` rows for FK).
//
// Run: npx tsx scripts/tool-scan.ts
// Run with --force to re-scan repos already scanned this month

import { config } from 'dotenv'
config({ path: '.env.local' })

const forceRescan = process.argv.includes('--force')

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

interface SearchItem {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  html_url: string
}

interface SearchResult {
  total_count: number
  items: SearchItem[]
}

async function main(): Promise<void> {
  const [
    { githubFetch, getCoAuthoredByTools },
    { createServiceClient },
  ] = await Promise.all([
    import('../lib/github.js'),
    import('../lib/supabase.js'),
  ])

  const db = createServiceClient()

  // Search for high-star repos pushed in the last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const dateStr = sixMonthsAgo.toISOString().split('T')[0]

  const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  let totalScanned = 0
  let totalWithContributions = 0
  let totalSkipped = 0

  // GitHub Search API: max 1,000 results, 100 per page = 10 pages
  const perPage = 100
  const maxPages = 10

  log('=== Tool Scan Starting ===')
  log(`Searching repos with stars:>500 pushed:>${dateStr}`)

  for (let page = 1; page <= maxPages; page++) {
    const query = encodeURIComponent(`stars:>500 pushed:>${dateStr}`)

    let data: SearchResult
    try {
      data = await githubFetch<SearchResult>(
        `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${perPage}&page=${page}`
      )
    } catch (err) {
      logError(`Search page ${page} failed`, err)
      break
    }

    if (data.items.length === 0) break

    log(`Page ${page}: ${data.items.length} repos (total available: ${data.total_count.toLocaleString()})`)

    for (const item of data.items) {
      const label = `${item.owner.login}/${item.name}`

      try {
        // Upsert minimal row into repos table for FK
        const { data: upsertedRepo, error: repoError } = await db
          .from('repos')
          .upsert(
            {
              github_id: item.id,
              name: item.name,
              owner: item.owner.login,
              description: item.description,
              stars: item.stargazers_count,
              forks: item.forks_count,
              language: item.language,
              url: item.html_url,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'github_id' }
          )
          .select('id')
          .single()

        if (repoError || !upsertedRepo) {
          logError(`Failed to upsert repo ${label}`, repoError)
          continue
        }

        const repoId = upsertedRepo.id

        // Check if already scanned this month (skip unless --force)
        if (!forceRescan) {
          const { data: existing } = await db
            .from('tool_contributions')
            .select('id')
            .eq('repo_id', repoId)
            .eq('month', currentMonth)
            .limit(1)

          if (existing && existing.length > 0) {
            totalSkipped++
            continue
          }
        }

        // Scan for Co-Authored-By
        const contributions = await getCoAuthoredByTools(item.owner.login, item.name)
        const months = Object.keys(contributions)

        if (months.length > 0) {
          for (const month of months) {
            for (const [toolName, commitCount] of Object.entries(contributions[month])) {
              await db.from('tool_contributions').upsert(
                {
                  repo_id: repoId,
                  tool_name: toolName,
                  commit_count: commitCount,
                  month,
                },
                { onConflict: 'repo_id,tool_name,month' }
              )
            }
          }
          totalWithContributions++
          log(`  ${label} — found tool contributions (${months.length} months)`)
        }

        totalScanned++

        // Rate limit delay
        await new Promise((r) => setTimeout(r, 500))
      } catch (err) {
        logError(`Failed to process ${label}`, err)
      }
    }

    // Respect search API secondary rate limit
    await new Promise((r) => setTimeout(r, 2000))
  }

  log(`\n=== Tool Scan Complete ===`)
  log(`Scanned: ${totalScanned} repos`)
  log(`Skipped (already scanned): ${totalSkipped}`)
  log(`With AI tool contributions: ${totalWithContributions}`)
}

main().catch((err) => {
  console.error('Tool scan failed:', err)
  process.exit(1)
})
