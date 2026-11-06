import type { MetadataRoute } from 'next'
import { getIndexableProjects, getSnapshotDates, getDigests } from '@/lib/queries'

const BASE_URL = 'https://gitfind.ai'

// Generated on demand, never at build time. The indexable-set fetch behind
// this route runs as the anon role (3s statement timeout), and its
// cold-cache latency (~3.8s: 650 nested-loop disk reads on a Micro instance
// with a nearly depleted Disk IO Budget) can exceed that limit — which
// intermittently killed builds with Postgres 57014 while the sitemap was
// being prerendered. force-dynamic takes the build out of that path (a
// route-level `revalidate` is ignored under force-dynamic, so it is
// removed). Freshness is unaffected: getIndexableProjects is wrapped in
// unstable_cache with revalidate 3600, so the gated set still refreshes at
// most hourly and sitemap responses reuse the cached fetch.
export const dynamic = 'force-dynamic'

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
      url: `${BASE_URL}/open-model-index`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/methodology`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/developers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/insights/briefing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.3,
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
  ]

  const [projects, snapshotDates, digestIssues] = await Promise.all([
    getIndexableProjects(),
    getSnapshotDates(),
    getDigests(52),
  ])

  // E1: only the gated top set is submitted (top 500 by Early Signal Score,
  // spam gate applied — see lib/index-gate.ts). Every other project page is
  // noindexed via its metadata instead of being listed here.
  // lastModified is when the page's content last changed: the later of the
  // repo row's updated_at and its enrichment's scored_at.
  const projectRoutes: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${BASE_URL}/project/${project.owner}/${project.name}`,
    lastModified: new Date(
      Math.max(
        new Date(project.updated_at).getTime(),
        project.scored_at ? new Date(project.scored_at).getTime() : 0
      )
    ),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const digestRoutes: MetadataRoute.Sitemap = digestIssues.map((issue) => ({
    url: `${BASE_URL}/insights/briefing/${issue.week_date}`,
    lastModified: new Date(issue.week_date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
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

  return [...staticRoutes, ...insightsRoutes, ...digestRoutes, ...projectRoutes]
}
