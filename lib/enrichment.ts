// Claude enrichment — generates plain-English summaries for each repo
// Uses claude-sonnet-4-6 to produce:
//   1. A 2-sentence plain-English summary (written for non-technical PMs)
//   2. A 2-sentence "why it matters" (product strategy / market angle)
//   3. A category tag (one of the 8 GitFind categories)
// Results are cached in the Supabase `enrichments` table

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase'
import type { ScoreBreakdown } from './score'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const CATEGORIES = [
  'AI / Machine Learning',
  'Developer Tools',
  'Security',
  'Data & Analytics',
  'Web Frameworks',
  'Infrastructure & DevOps',
  'Mobile',
  'Open Source Utilities',
] as const

export type CategoryName = (typeof CATEGORIES)[number]

export interface EnrichmentResult {
  summary: string
  why_it_matters: string
  category: CategoryName
}

interface RepoData {
  github_id: number
  name: string
  owner: string
  description: string | null
  stars: number
  forks: number
  contributors: number
  language: string | null
  topics?: string[]
  readme_excerpt?: string
}

function buildPrompt(repo: RepoData): string {
  const topicsLine =
    repo.topics && repo.topics.length > 0 ? `\nTopics: ${repo.topics.join(', ')}` : ''
  const readmeLine =
    repo.readme_excerpt ? `\n\nREADME excerpt:\n${repo.readme_excerpt}` : ''

  return `You are writing for GitFind, a directory that helps non-technical product managers understand what's being built on GitHub.

Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? 'No description provided'}${topicsLine}
Language: ${repo.language ?? 'Unknown'}
Stars: ${repo.stars.toLocaleString()}
Forks: ${repo.forks.toLocaleString()}
Contributors: ${repo.contributors}${readmeLine}

Write a JSON response with exactly these 3 fields:

1. "summary": 2 sentences. What this project does, written in plain English for a non-technical product manager. No developer jargon. No technical terms unless absolutely unavoidable (and if used, briefly explain them). Imagine explaining it to someone who reads TechCrunch but doesn't write code.

2. "why_it_matters": 2 sentences. Why should a PM, founder, or investor care about this? What does it mean for product strategy, the market, or what's being built? Focus on business and product implications, not technical details.

3. "category": Exactly one of these category names (copy it exactly):
${CATEGORIES.map((c) => `- ${c}`).join('\n')}

Respond with only valid JSON, no markdown fences, no extra text.

Example format:
{
  "summary": "...",
  "why_it_matters": "...",
  "category": "Developer Tools"
}`
}

function parseEnrichmentResponse(text: string): EnrichmentResult {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  const why_it_matters = typeof parsed.why_it_matters === 'string' ? parsed.why_it_matters : ''
  const categoryRaw = typeof parsed.category === 'string' ? parsed.category : ''

  const category = CATEGORIES.find((c) => c === categoryRaw)
  if (!category) {
    throw new Error(`Invalid category from Claude: "${categoryRaw}". Expected one of: ${CATEGORIES.join(', ')}`)
  }

  if (!summary || !why_it_matters) {
    throw new Error('Missing summary or why_it_matters in Claude response')
  }

  return { summary, why_it_matters, category }
}

// Call Claude to enrich a repo and cache the result in Supabase
// If a cached result exists and the repo hasn't changed significantly, return the cached version
export async function enrichRepo(
  repoId: string,
  repo: RepoData,
  score: number,
  breakdown?: ScoreBreakdown,
  forceRefresh = false,
): Promise<EnrichmentResult> {
  const db = createServiceClient()

  // Check for existing enrichment unless force-refreshing
  if (!forceRefresh) {
    const { data: existing } = await db
      .from('enrichments')
      .select('summary, why_it_matters, category')
      .eq('repo_id', repoId)
      .maybeSingle()

    if (existing) {
      return {
        summary: existing.summary,
        why_it_matters: existing.why_it_matters,
        category: existing.category as CategoryName,
      }
    }
  }

  // Call Claude
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildPrompt(repo) }],
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    throw new Error('Claude returned an unexpected response format')
  }

  const result = parseEnrichmentResponse(content.text)

  // Upsert into enrichments table
  await db.from('enrichments').upsert(
    {
      repo_id: repoId,
      summary: result.summary,
      why_it_matters: result.why_it_matters,
      category: result.category,
      early_signal_score: score,
      score_breakdown: breakdown ? JSON.parse(JSON.stringify(breakdown)) : null,
      scored_at: new Date().toISOString(),
    },
    { onConflict: 'repo_id' }
  )

  return result
}
