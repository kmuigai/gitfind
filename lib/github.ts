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
  topics?: string[]
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
  'ai-ml': ['ai', 'machine-learning', 'llm', 'artificial-intelligence', 'deep-learning', 'generative-ai', 'assistant'],
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

export async function githubFetch<T>(path: string, accept?: string): Promise<T> {
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
  topics?: string[]
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

  // Pick first 3 topics per category (24 calls total, within budget)
  for (const topic of topics.slice(0, 3)) {
    const query = encodeURIComponent(`topic:${topic} stars:>50 pushed:>${dateStr}`)
    const data = await githubFetch<GitHubSearchResult>(
      `/search/repositories?q=${query}&sort=stars&order=desc&per_page=30`
    )

    for (const item of data.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        repos.push(mapSearchItem(item))
      }
    }

    // Respect secondary rate limit — small delay between searches
    await new Promise((r) => setTimeout(r, 250))
  }

  // Return top 30 by star count
  return repos.sort((a, b) => b.stars - a.stars).slice(0, 30)
}

function mapSearchItem(item: GitHubSearchItem): GitHubRepo {
  return {
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
    topics: item.topics ?? [],
  }
}

// Layer 2: Mid-tier repos (100–10k stars) pushed recently, segmented by language
export async function searchTrendingMidTier(): Promise<GitHubRepo[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]

  const TRACKED_LANGUAGES = ['Python', 'TypeScript', 'Rust', 'Go']
  const excludeLangs = TRACKED_LANGUAGES.map((l) => `-language:${l}`).join(' ')

  const queries = [
    ...TRACKED_LANGUAGES.map(
      (lang) => `stars:100..2000 pushed:>${dateStr} language:${lang}`
    ),
    `stars:100..2000 pushed:>${dateStr} ${excludeLangs}`,
    `stars:2000..10000 pushed:>${dateStr}`,
  ]

  const seen = new Set<number>()
  const repos: GitHubRepo[] = []

  for (const q of queries) {
    const query = encodeURIComponent(q)
    const data = await githubFetch<GitHubSearchResult>(
      `/search/repositories?q=${query}&sort=updated&order=desc&per_page=50`
    )

    for (const item of data.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        repos.push(mapSearchItem(item))
      }
    }

    await new Promise((r) => setTimeout(r, 250))
  }

  return repos
}

// Layer 3: Brand-new repos with early traction
export async function searchNewbornRockets(): Promise<GitHubRepo[]> {
  const now = new Date()
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(now.getDate() - 90)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)

  const date90 = ninetyDaysAgo.toISOString().split('T')[0]
  const date30 = thirtyDaysAgo.toISOString().split('T')[0]
  const date7 = sevenDaysAgo.toISOString().split('T')[0]

  const queries = [
    `created:>${date90} stars:50..500`,
    `created:>${date90} stars:500..5000`,
    `created:>${date30} stars:>20 pushed:>${date7}`,
  ]

  const seen = new Set<number>()
  const repos: GitHubRepo[] = []

  for (const q of queries) {
    const query = encodeURIComponent(q)
    const data = await githubFetch<GitHubSearchResult>(
      `/search/repositories?q=${query}&sort=stars&order=desc&per_page=50`
    )

    for (const item of data.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        repos.push(mapSearchItem(item))
      }
    }

    await new Promise((r) => setTimeout(r, 250))
  }

  return repos
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

interface ReadmeResponse {
  content: string
  encoding: string
}

// Fetch raw README markdown for a repo. Returns null if not found or on error.
export async function getReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const data = await githubFetch<ReadmeResponse>(`/repos/${owner}/${repo}/readme`)
    if (data.encoding !== 'base64' || !data.content) return null
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  } catch {
    return null
  }
}

// Headings whose sections are noise for PM-facing summaries
const SKIP_SECTION_HEADING = /^#{1,4}\s+(install|installation|getting\s+started|usage|requirements|setup|quick\s+start|prerequisites|license|contributing|changelog|faq|troubleshoot)/i

// Headings that introduce the useful "what is this" content
const INTRO_SECTION_HEADING = /^#{1,4}\s+(overview|about|introduction|what\s+is|description)/i

function extractIntro(text: string): string {
  const lines = text.split('\n')
  const firstHeadingIdx = lines.findIndex((l) => /^#{1,4}\s/.test(l))

  // Content before the first heading is usually the most PM-relevant
  const preHeading =
    firstHeadingIdx > 0
      ? lines.slice(0, firstHeadingIdx).join('\n').trim()
      : firstHeadingIdx === -1
        ? text.trim()
        : ''

  if (preHeading.length >= 100) return preHeading.slice(0, 2000)

  // Fall back to a named intro section
  const sectionIdx = lines.findIndex((l) => INTRO_SECTION_HEADING.test(l))
  if (sectionIdx !== -1) {
    const start = sectionIdx + 1
    const nextHeading = lines.slice(start).findIndex((l) => /^#{1,4}\s/.test(l))
    const end = nextHeading !== -1 ? start + nextHeading : lines.length
    const section = lines.slice(start, end).join('\n').trim()
    if (section.length >= 100) return section.slice(0, 2000)
  }

  return text.slice(0, 2000)
}

// Clean a raw README and return up to 2,000 chars of PM-relevant content.
// Returns empty string if the result is below the quality threshold (< 100 chars).
export function cleanReadme(raw: string): string {
  const lines = raw.split('\n')
  const cleaned: string[] = []
  let inCodeBlock = false
  let skipSection = false

  for (const line of lines) {
    // Track fenced code blocks
    if (/^(```|~~~)/.test(line)) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // Skip indented code (4 spaces or a tab)
    if (/^( {4}|\t)/.test(line)) continue

    // Heading — decide whether to keep or skip the following section
    if (/^#{1,4}\s/.test(line)) {
      if (SKIP_SECTION_HEADING.test(line)) {
        skipSection = true
      } else {
        skipSection = false
        cleaned.push(line)
      }
      continue
    }

    if (skipSection) continue

    // Badge lines
    if (line.includes('[![') || line.includes('img.shields.io')) continue

    // Pure image lines
    if (/^\s*!\[.*?\]\(.*?\)\s*$/.test(line)) continue

    // Strip inline HTML tags
    const stripped = line.replace(/<[^>]+>/g, '').trim()

    // Collapse consecutive blank lines
    if (stripped === '' && (cleaned.length === 0 || cleaned[cleaned.length - 1] === '')) continue

    cleaned.push(stripped)
  }

  const result = cleaned.join('\n').trim()
  const excerpt = extractIntro(result)
  return excerpt.length >= 100 ? excerpt : ''
}

// Detect the published package name for a repo based on its language
// Returns the registry and package name, or null if not found
export async function detectPackageName(
  owner: string,
  repo: string,
  language: string | null
): Promise<{ registry: 'npm' | 'pypi' | 'crates'; name: string } | null> {
  if (!language) return null

  try {
    if (language === 'TypeScript' || language === 'JavaScript') {
      const data = await githubFetch<{ content: string; encoding: string }>(
        `/repos/${owner}/${repo}/contents/package.json`
      )
      if (data.encoding !== 'base64' || !data.content) return null
      const json = JSON.parse(
        Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      )
      if (typeof json.name === 'string' && json.name && !json.private) {
        return { registry: 'npm', name: json.name }
      }
    } else if (language === 'Python') {
      // Try pyproject.toml first
      try {
        const data = await githubFetch<{ content: string; encoding: string }>(
          `/repos/${owner}/${repo}/contents/pyproject.toml`
        )
        if (data.encoding === 'base64' && data.content) {
          const text = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
          const nameMatch = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m)
          if (nameMatch) {
            return { registry: 'pypi', name: nameMatch[1] }
          }
        }
      } catch {
        // pyproject.toml not found, try setup.cfg
        try {
          const data = await githubFetch<{ content: string; encoding: string }>(
            `/repos/${owner}/${repo}/contents/setup.cfg`
          )
          if (data.encoding === 'base64' && data.content) {
            const text = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
            const nameMatch = text.match(/^\s*name\s*=\s*(.+)/m)
            if (nameMatch) {
              return { registry: 'pypi', name: nameMatch[1].trim() }
            }
          }
        } catch {
          // setup.cfg not found either, skip
        }
      }
    } else if (language === 'Rust') {
      const data = await githubFetch<{ content: string; encoding: string }>(
        `/repos/${owner}/${repo}/contents/Cargo.toml`
      )
      if (data.encoding === 'base64' && data.content) {
        const text = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
        const nameMatch = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m)
        if (nameMatch) {
          return { registry: 'crates', name: nameMatch[1] }
        }
      }
    }
  } catch {
    // File not found or parse error — this repo doesn't have a detectable package
  }

  return null
}

// Known AI coding tool patterns in Co-Authored-By headers
const TOOL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /claude/i, name: 'Claude Code' },
  { pattern: /copilot/i, name: 'GitHub Copilot' },
  { pattern: /cursor/i, name: 'Cursor' },
  { pattern: /codeium/i, name: 'Codeium' },
]

interface CommitEntry {
  commit: {
    message: string
    author: { date: string }
  }
}

export interface ToolContributionsByMonth {
  [month: string]: Record<string, number>
}

// Parse Co-Authored-By headers from recent commits to identify AI tool usage
// Returns contributions grouped by month → tool_name → commit_count
export async function getCoAuthoredByTools(
  owner: string,
  repo: string
): Promise<ToolContributionsByMonth> {
  try {
    const commits = await githubFetch<CommitEntry[]>(
      `/repos/${owner}/${repo}/commits?per_page=100`
    )

    const result: ToolContributionsByMonth = {}

    for (const entry of commits) {
      const message = entry.commit.message
      const date = entry.commit.author.date
      const month = date.slice(0, 10) // 'YYYY-MM-DD'

      // Look for Co-Authored-By lines
      const coAuthorLines = message.match(/Co-Authored-By:\s*.+/gi)
      if (!coAuthorLines) continue

      for (const line of coAuthorLines) {
        for (const { pattern, name } of TOOL_PATTERNS) {
          if (pattern.test(line)) {
            if (!result[month]) result[month] = {}
            result[month][name] = (result[month][name] ?? 0) + 1
            break // One match per Co-Authored-By line
          }
        }
      }
    }

    return result
  } catch {
    return {}
  }
}
