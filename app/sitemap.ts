import type { MetadataRoute } from 'next'
import { getAllReposForSitemap } from '@/lib/queries'

const BASE_URL = 'https://gitfind.ai'

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

  const repos = await getAllReposForSitemap()

  const projectRoutes: MetadataRoute.Sitemap = repos.map((repo) => ({
    url: `${BASE_URL}/project/${repo.owner}/${repo.name}`,
    lastModified: new Date(repo.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...projectRoutes]
}
