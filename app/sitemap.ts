import type { MetadataRoute } from 'next'
import { getAllReposForSitemap, getSnapshotDates } from '@/lib/queries'

const BASE_URL = 'https://gitfind.ai'

const AI_TOOL_SLUGS = [
  'claude-code', 'cursor', 'copilot', 'aider', 'gemini-cli', 'devin', 'codex',
]

const COMPARE_SLUGS: string[] = []
for (let i = 0; i < AI_TOOL_SLUGS.length; i++) {
  for (let j = i + 1; j < AI_TOOL_SLUGS.length; j++) {
    COMPARE_SLUGS.push(`${AI_TOOL_SLUGS[i]}-vs-${AI_TOOL_SLUGS[j]}`)
  }
}

const CATEGORY_SLUGS = [
  'ai-ml',
  'developer-tools',
  'security',
  'data-analytics',
  'web-frameworks',
  'infrastructure-devops',
  'mobile',
  'open-source-utilities',
]

// Convert snapshot dates to unique week Sundays (YYYY-MM-DD)
function getWeeklyDates(snapshotDates: string[]): string[] {
  const weeks = new Set<string>()
  for (const date of snapshotDates) {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay()) // Roll back to Sunday
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    weeks.add(`${y}-${m}-${day}`)
  }
  return Array.from(weeks).sort().reverse()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/ai-code-index`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/submit`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/category/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    ...COMPARE_SLUGS.map((slug) => ({
      url: `${BASE_URL}/ai-code-index/compare/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ]

  const [repos, snapshotDates] = await Promise.all([
    getAllReposForSitemap(),
    getSnapshotDates(),
  ])

  const projectRoutes: MetadataRoute.Sitemap = repos.map((repo) => ({
    url: `${BASE_URL}/project/${repo.owner}/${repo.name}`,
    lastModified: new Date(repo.updated_at),
    changeFrequency: 'weekly' as const,
    priority: repo.has_enrichment ? 0.7 : 0.3,
  }))

  // Insights pages
  const insightsRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/insights`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/insights/breakout-repos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Weekly rising pages — one per snapshot week (use Sundays)
    ...getWeeklyDates(snapshotDates).map((date) => ({
      url: `${BASE_URL}/insights/rising-this-week/${date}`,
      lastModified: new Date(date),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]

  return [...staticRoutes, ...insightsRoutes, ...projectRoutes]
}
