// GitHub REST API client
// Rate limit: 5,000 requests/hour with token — this client uses the GITHUB_TOKEN env var
// Keep all GitHub API calls isolated here. Do NOT call GitHub directly from other modules.

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export interface GitHubRepo {
  github_id: number
  name: string
  owner: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  url: string
  pushed_at: string
  created_at: string
}

export interface StarVelocity {
  stars_7d: number
  stars_30d: number
}

export interface ForkVelocity {
  forks_7d: number
}

export interface CommitActivity {
  commits_30d: number
}

// Category → GitHub search topics mapping
const CATEGORY_TOPICS: Record<string, string[]> = {
  'ai-ml': ['machine-learning', 'llm', 'artificial-intelligence', 'deep-learning', 'generative-ai'],
  'developer-tools': ['developer-tools', 'cli', 'devtools', 'productivity', 'code-editor'],
  'security': ['security', 'cybersecurity', 'cryptography', 'penetration-testing', 'privacy'],
  'data-analytics': ['data-science', 'analytics', 'database', 'data-visualization', 'etl'],
  'web-frameworks': ['web-framework', 'frontend', 'backend', 'api', 'fullstack'],
  'infrastructure-devops': ['devops', 'kubernetes', 'docker', 'infrastructure', 'cloud'],
  'mobile': ['ios', 'android', 'react-native', 'flutter', 'mobile'],
  'open-source-utilities': ['utility', 'automation', 'tools', 'open-source', 'productivity'],
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitFind/1.0',
  }
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  }
  return headers
}

async function githubFetch<T>(path: string, accept?: string): Promise<T> {
  const headers = githubHeaders()
  if (accept) headers['Accept'] = accept

  const response = await fetch(`${GITHUB_API_BASE}${path}`, { headers })

  if (response.status === 403) {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (remaining === '0') {
      const reset = response.headers.get('X-RateLimit-Reset')
      throw new Error(`GitHub rate limit exceeded. Resets at ${reset ? new Date(parseInt(reset) * 1000).toISOString() : 'unknown'}`)
    }
  }

  if (response.status === 404) {
    throw new Error(`GitHub resource not found: ${path}`)
  }

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${await response.text()}`)
  }

  return response.json() as Promise<T>
}

interface GitHubSearchResult {
  total_count: number
  items: GitHubSearchItem[]
}

interface GitHubSearchItem {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  html_url: string
  pushed_at: string
  created_at: string
}

// Fetch repos for a given category slug, ordered by stars, pushed in last 90 days
export async function searchReposByCategory(categorySlug: string): Promise<GitHubRepo[]> {
  const topics = CATEGORY_TOPICS[categorySlug]
  if (!topics) throw new Error(`Unknown category slug: ${categorySlug}`)

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const dateStr = ninetyDaysAgo.toISOString().split('T')[0]

  // Search once per topic and deduplicate
  const seen = new Set<number>()
  const repos: GitHubRepo[] = []

  // Pick first 2 topics to avoid burning rate limit
  for (const topic of topics.slice(0, 2)) {
    const query = encodeURIComponent(`topic:${topic} stars:>50 pushed:>${dateStr}`)
    const data = await githubFetch<GitHubSearchResult>(
      `/search/repositories?q=${query}&sort=stars&order=desc&per_page=30`
    )

    for (const item of data.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        repos.push({
          github_id: item.id,
          name: item.name,
          owner: item.owner.login,
          description: item.description,
          stars: item.stargazers_count,
          forks: item.forks_count,
          language: item.language,
          url: item.html_url,
          pushed_at: item.pushed_at,
          created_at: item.created_at,
        })
      }
    }

    // Respect secondary rate limit — small delay between searches
    await new Promise((r) => setTimeout(r, 250))
  }

  // Return top 30 by star count
  return repos.sort((a, b) => b.stars - a.stars).slice(0, 30)
}

interface StargazerEntry {
  starred_at: string
  user: { login: string }
}

// Calculate how many new stars a repo gained in the last 7 and 30 days
// Fetches the most recent pages of stargazers and counts those within each window
export async function getStarVelocity(owner: string, repo: string, totalStars: number): Promise<StarVelocity> {
  if (totalStars === 0) return { stars_7d: 0, stars_30d: 0 }

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  let stars_7d = 0
  let stars_30d = 0

  // Stargazers are returned oldest first. To get recent ones, we start from the last page.
  const perPage = 100
  const totalPages = Math.ceil(totalStars / perPage)
  // Check last 3 pages at most to stay within rate limits
  const startPage = Math.max(1, totalPages - 2)

  try {
    for (let page = startPage; page <= totalPages; page++) {
      const data = await githubFetch<StargazerEntry[]>(
        `/repos/${owner}/${repo}/stargazers?per_page=${perPage}&page=${page}`,
        'application/vnd.github.v3.star+json'
      )

      for (const entry of data) {
        const starredAt = new Date(entry.starred_at).getTime()
        if (starredAt >= thirtyDaysAgo) stars_30d++
        if (starredAt >= sevenDaysAgo) stars_7d++
      }

      // If the oldest entry on this page is older than 30 days, no point checking earlier pages
      if (data.length > 0) {
        const oldest = new Date(data[0]!.starred_at).getTime()
        if (oldest < thirtyDaysAgo) break
      }

      await new Promise((r) => setTimeout(r, 100))
    }
  } catch {
    // If we can't get velocity (e.g. empty repo), return zeros
    return { stars_7d: 0, stars_30d: 0 }
  }

  return { stars_7d, stars_30d }
}

interface Contributor {
  login: string
  contributions: number
}

// Get the number of unique contributors to a repo
export async function getContributorCount(owner: string, repo: string): Promise<number> {
  try {
    // GitHub returns up to 500 contributors per_page=100, max 5 pages
    let count = 0
    for (let page = 1; page <= 5; page++) {
      const data = await githubFetch<Contributor[]>(
        `/repos/${owner}/${repo}/contributors?per_page=100&page=${page}`
      )
      count += data.length
      if (data.length < 100) break
    }
    return count
  } catch {
    return 0
  }
}

interface RepoDetails {
  forks_count: number
  stargazers_count: number
  open_issues_count: number
  pushed_at: string
}

// Get current fork and star counts (for fork velocity relative to stars)
export async function getRepoDetails(owner: string, repo: string): Promise<RepoDetails | null> {
  try {
    return await githubFetch<RepoDetails>(`/repos/${owner}/${repo}`)
  } catch {
    return null
  }
}

interface WeeklyCommitActivity {
  days: number[]
  total: number
  week: number
}

// Get number of commits in the last 30 days using GitHub's stats API
// Returns the weekly commit activity for the past year
export async function getCommitFrequency(owner: string, repo: string): Promise<number> {
  try {
    // This endpoint can return 202 if stats are being computed — retry once
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/commit_activity`, {
      headers: githubHeaders(),
    })

    if (response.status === 202) {
      // Stats are being generated, wait and retry
      await new Promise((r) => setTimeout(r, 2000))
      const retry = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/commit_activity`, {
        headers: githubHeaders(),
      })
      if (!retry.ok) return 0
      const data = (await retry.json()) as WeeklyCommitActivity[]
      return sumRecentCommits(data)
    }

    if (!response.ok) return 0

    const data = (await response.json()) as WeeklyCommitActivity[]
    return sumRecentCommits(data)
  } catch {
    return 0
  }
}

function sumRecentCommits(weeklyData: WeeklyCommitActivity[]): number {
  if (!Array.isArray(weeklyData) || weeklyData.length === 0) return 0
  // Last 4 weeks = last 30 days (approximately)
  const recent = weeklyData.slice(-4)
  return recent.reduce((sum, week) => sum + week.total, 0)
}
