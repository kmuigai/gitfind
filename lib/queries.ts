// Typed query helpers for GitFind
// Supabase JS v2.96+ needs explicit type casts for select('*') with hand-crafted Database types.
// All casts are at the query boundary — the rest of the codebase is fully typed via RepoWithEnrichment.

import { supabase } from './supabase'
import type { Repo, Enrichment, RepoWithEnrichment } from './database.types'

type RawEnrichment = Enrichment
type RawRepo = Repo

// Fetch top N repos ranked by Early Signal Score
export async function getTopRepos(limit = 6): Promise<RepoWithEnrichment[]> {
  const { data: enrichments, error: eErr } = await supabase
    .from('enrichments')
    .select('*')
    .order('early_signal_score', { ascending: false })
    .limit(limit)

  if (eErr || !enrichments || enrichments.length === 0) return []
  const typedEnrichments = enrichments as unknown as RawEnrichment[]

  const repoIds = typedEnrichments.map((e) => e.repo_id)

  const { data: repos, error: rErr } = await supabase
    .from('repos')
    .select('*')
    .in('id', repoIds)

  if (rErr || !repos) return []
  const typedRepos = repos as unknown as RawRepo[]

  return joinReposAndEnrichments(typedRepos, typedEnrichments)
}

// Fetch repos for a given category name
export async function getReposByCategory(
  categoryName: string,
  limit = 50
): Promise<RepoWithEnrichment[]> {
  const { data: enrichments, error: eErr } = await supabase
    .from('enrichments')
    .select('*')
    .eq('category', categoryName)
    .order('early_signal_score', { ascending: false })
    .limit(limit)

  if (eErr || !enrichments || enrichments.length === 0) return []
  const typedEnrichments = enrichments as unknown as RawEnrichment[]

  const repoIds = typedEnrichments.map((e) => e.repo_id)

  const { data: repos, error: rErr } = await supabase
    .from('repos')
    .select('*')
    .in('id', repoIds)

  if (rErr || !repos) return []
  const typedRepos = repos as unknown as RawRepo[]

  return joinReposAndEnrichments(typedRepos, typedEnrichments)
}

// Fetch a single repo by owner/name with its enrichment
export async function getRepo(
  owner: string,
  name: string
): Promise<RepoWithEnrichment | null> {
  const { data: rawRepo, error: rErr } = await supabase
    .from('repos')
    .select('*')
    .eq('owner', owner)
    .eq('name', name)
    .maybeSingle()

  if (rErr || !rawRepo) return null
  const repo = rawRepo as unknown as RawRepo

  const { data: rawEnrichment } = await supabase
    .from('enrichments')
    .select('*')
    .eq('repo_id', repo.id)
    .maybeSingle()

  const enrichment = rawEnrichment ? (rawEnrichment as unknown as RawEnrichment) : null

  return { ...repo, enrichment }
}

// Search repos by text (name, owner, description)
export async function searchRepos(query: string, limit = 10): Promise<RepoWithEnrichment[]> {
  const { data: repos, error: rErr } = await supabase
    .from('repos')
    .select('*')
    .or(`name.ilike.%${query}%,owner.ilike.%${query}%,description.ilike.%${query}%`)
    .order('stars', { ascending: false })
    .limit(limit)

  if (rErr || !repos || repos.length === 0) return []
  const typedRepos = repos as unknown as RawRepo[]

  const repoIds = typedRepos.map((r) => r.id)

  const { data: enrichments } = await supabase
    .from('enrichments')
    .select('*')
    .in('repo_id', repoIds)

  const typedEnrichments = (enrichments ?? []) as unknown as RawEnrichment[]

  return joinReposAndEnrichments(typedRepos, typedEnrichments)
}

// Get all repos for sitemap generation
export async function getAllReposForSitemap(): Promise<
  Array<{ owner: string; name: string; updated_at: string }>
> {
  const { data } = await supabase
    .from('repos')
    .select('owner, name, updated_at')
    .order('updated_at', { ascending: false })

  return (data ?? []) as unknown as Array<{ owner: string; name: string; updated_at: string }>
}

// Join repos with enrichments, preserving enrichment score ordering
function joinReposAndEnrichments(
  repos: RawRepo[],
  enrichments: RawEnrichment[]
): RepoWithEnrichment[] {
  const enrichmentMap = new Map<string, RawEnrichment>()
  for (const e of enrichments) {
    enrichmentMap.set(e.repo_id, e)
  }

  const enrichmentOrder = new Map<string, number>()
  enrichments.forEach((e, i) => enrichmentOrder.set(e.repo_id, i))

  return repos
    .map((repo) => ({
      ...repo,
      enrichment: enrichmentMap.get(repo.id) ?? null,
    }))
    .sort((a, b) => {
      const aOrder = enrichmentOrder.get(a.id) ?? 999
      const bOrder = enrichmentOrder.get(b.id) ?? 999
      return aOrder - bOrder
    })
}
