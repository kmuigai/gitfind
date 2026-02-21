// Hacker News Ingestion
// Queries HN Algolia API for GitHub repo links posted in the last 24 hours.
// Fetches metadata from GitHub API for new repos, inserts into DB.
//
// GitHub API cost: ~20-50 calls/day (one per new HN-discovered repo)
// Expected yield: 50-200 repos/day, high quality (HN-validated)
//
// Run locally: npx tsx scripts/ingest-hn.ts
// Run nightly: GitHub Actions (before main pipeline)

import { config } from 'dotenv'
config({ path: '.env.local' })

const HN_API_BASE = 'https://hn.algolia.com/api/v1'

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

interface AlgoliaHit {
  objectID: string
  title?: string
  url?: string
  story_text?: string
  comment_text?: string
}

interface AlgoliaSearchResult {
  hits: AlgoliaHit[]
  nbHits: number
  nbPages: number
}

// Extract owner/repo from GitHub URLs
const GITHUB_REPO_RE = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/

function extractGitHubRepos(text: string): Array<{ owner: string; name: string }> {
  const results: Array<{ owner: string; name: string }> = []
  const matches = text.matchAll(new RegExp(GITHUB_REPO_RE, 'g'))
  for (const match of matches) {
    const owner = match[1]
    let name = match[2]
    // Strip common suffixes
    name = name.replace(/\.git$/, '').replace(/[#?].*$/, '')
    // Skip non-repo paths
    if (['issues', 'pull', 'blob', 'tree', 'wiki', 'releases', 'actions', 'settings'].includes(name)) continue
    if (owner && name && name.length > 0) {
      results.push({ owner, name })
    }
  }
  return results
}

async function main(): Promise<void> {
  const [
    { githubFetch },
    { createServiceClient },
  ] = await Promise.all([
    import('../lib/github.js'),
    import('../lib/supabase.js'),
  ])

  const db = createServiceClient()

  const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60

  log('=== HN Ingestion ===')

  // Collect unique repos from stories and comments
  const repoSet = new Map<string, { owner: string; name: string }>()

  // Search stories with GitHub links
  for (const tag of ['story', 'comment']) {
    const url = `${HN_API_BASE}/search?query=github.com&tags=${tag}&numericFilters=created_at_i>${oneDayAgo}&hitsPerPage=100`

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'GitFind/1.0' },
      })

      if (!response.ok) {
        log(`  HN API returned ${response.status} for ${tag} search`)
        continue
      }

      const data = (await response.json()) as AlgoliaSearchResult
      log(`  HN ${tag}s: ${data.nbHits} hits (fetched ${data.hits.length})`)

      for (const hit of data.hits) {
        // Check URL field
        if (hit.url) {
          for (const repo of extractGitHubRepos(hit.url)) {
            repoSet.set(`${repo.owner}/${repo.name}`, repo)
          }
        }
        // Check title
        if (hit.title) {
          for (const repo of extractGitHubRepos(hit.title)) {
            repoSet.set(`${repo.owner}/${repo.name}`, repo)
          }
        }
        // Check story/comment text
        const text = hit.story_text || hit.comment_text || ''
        if (text.includes('github.com')) {
          for (const repo of extractGitHubRepos(text)) {
            repoSet.set(`${repo.owner}/${repo.name}`, repo)
          }
        }
      }
    } catch (err) {
      log(`  Failed to fetch HN ${tag}s: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  log(`\nUnique GitHub repos from HN: ${repoSet.size}`)

  if (repoSet.size === 0) {
    log('No repos found. Done.')
    return
  }

  // Check which repos already exist (by owner + name)
  const repos = Array.from(repoSet.values())
  const existingKeys = new Set<string>()

  // Query in batches — use owner+name pairs
  for (let i = 0; i < repos.length; i += 100) {
    const batch = repos.slice(i, i + 100)
    // Check by owner+name combinations
    for (const repo of batch) {
      const { data } = await db
        .from('repos')
        .select('owner, name')
        .eq('owner', repo.owner)
        .eq('name', repo.name)
        .maybeSingle()

      if (data) {
        existingKeys.add(`${repo.owner}/${repo.name}`)
      }
    }
  }

  const newRepos = repos.filter((r) => !existingKeys.has(`${r.owner}/${r.name}`))
  log(`Already in DB: ${existingKeys.size}`)
  log(`New repos to fetch from GitHub: ${newRepos.length}`)

  // Fetch metadata from GitHub API for each new repo
  let inserted = 0
  let failed = 0

  for (const repo of newRepos) {
    try {
      interface GitHubRepoResponse {
        id: number
        stargazers_count: number
        forks_count: number
        language: string | null
        description: string | null
        html_url: string
      }

      const data = await githubFetch<GitHubRepoResponse>(`/repos/${repo.owner}/${repo.name}`)

      const { error } = await db.from('repos').upsert(
        {
          github_id: data.id,
          owner: repo.owner,
          name: repo.name,
          description: data.description,
          stars: data.stargazers_count,
          forks: data.forks_count,
          language: data.language,
          url: data.html_url,
        },
        { onConflict: 'github_id', ignoreDuplicates: true }
      )

      if (error) {
        log(`  Failed to insert ${repo.owner}/${repo.name}: ${error.message}`)
        failed++
      } else {
        inserted++
        log(`  Inserted ${repo.owner}/${repo.name} (${data.stargazers_count.toLocaleString()} stars)`)
      }

      // Small delay to be respectful of GitHub rate limit
      await new Promise((r) => setTimeout(r, 100))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // 404 = repo deleted or private, skip silently
      if (!msg.includes('not found')) {
        log(`  Failed to fetch ${repo.owner}/${repo.name}: ${msg}`)
      }
      failed++
    }
  }

  log(`\n=== HN Ingestion Complete ===`)
  log(`Inserted: ${inserted} new repos`)
  log(`Skipped (already in DB): ${existingKeys.size}`)
  log(`Failed: ${failed}`)
}

main().catch((err) => {
  console.error('HN ingestion failed:', err)
  process.exit(1)
})
