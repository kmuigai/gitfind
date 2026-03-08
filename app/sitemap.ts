import type { MetadataRoute } from 'next'
import { getAllReposForSitemap } from '@/lib/queries'

const BASE_URL = 'https://gitfind.ai'

const AI_TOOL_SLUGS = [
  'claude-code', 'cursor', 'copilot', 'aider', 'gemini-cli', 'devin',
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

  const repos = await getAllReposForSitemap()

  const projectRoutes: MetadataRoute.Sitemap = repos.map((repo) => ({
    url: `${BASE_URL}/project/${repo.owner}/${repo.name}`,
    lastModified: new Date(repo.updated_at),
    changeFrequency: 'weekly' as const,
    priority: repo.has_enrichment ? 0.7 : 0.3,
  }))

  return [...staticRoutes, ...projectRoutes]
}
