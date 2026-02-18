// HN (Hacker News) mention fetcher
// Uses the HN Algolia API — free, no authentication required
// Docs: https://hn.algolia.com/api

const HN_API_BASE = 'https://hn.algolia.com/api/v1'

export interface HNMentions {
  mentions_7d: number
  mentions_30d: number
}

interface AlgoliaHit {
  objectID: string
  title?: string
  url?: string
  comment_text?: string
  created_at: string
  num_comments?: number
  points?: number
}

interface AlgoliaSearchResult {
  hits: AlgoliaHit[]
  nbHits: number
}

// Build a search query that matches the repo by owner/name or just name
function buildQuery(owner: string, repoName: string): string {
  // Match "owner/repo" or just "repo name"
  return `${owner}/${repoName}`
}

async function fetchHNMentions(
  query: string,
  afterTimestamp: number
): Promise<number> {
  const encodedQuery = encodeURIComponent(query)
  const url = `${HN_API_BASE}/search?query=${encodedQuery}&numericFilters=created_at_i>${afterTimestamp}&hitsPerPage=1`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'GitFind/1.0' },
  })

  if (!response.ok) {
    return 0
  }

  const data = (await response.json()) as AlgoliaSearchResult
  return data.nbHits
}

// Get the number of HN posts and comments mentioning this repo
// in the last 7 days and 30 days
export async function getHNMentions(owner: string, repoName: string): Promise<HNMentions> {
  const now = Math.floor(Date.now() / 1000)
  const sevenDaysAgo = now - 7 * 24 * 60 * 60
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60

  const query = buildQuery(owner, repoName)

  const [mentions_7d, mentions_30d] = await Promise.all([
    fetchHNMentions(query, sevenDaysAgo),
    fetchHNMentions(query, thirtyDaysAgo),
  ])

  return { mentions_7d, mentions_30d }
}
