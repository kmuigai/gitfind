// Typed query helpers for GitFind
// Supabase JS v2.96+ needs explicit type casts for select('*') with hand-crafted Database types.
// All casts are at the query boundary — the rest of the codebase is fully typed via RepoWithEnrichment.

import { supabase } from './supabase'
import type { Repo, Enrichment, RepoWithEnrichment, PackageDownload } from './database.types'

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

  return hydrateDownloads(joinReposAndEnrichments(typedRepos, typedEnrichments))
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

  return hydrateDownloads(joinReposAndEnrichments(typedRepos, typedEnrichments))
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

  return hydrateDownloads(joinReposAndEnrichments(typedRepos, typedEnrichments))
}

// Get project counts per category
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('enrichments')
    .select('category')

  if (!data) return {}

  const counts: Record<string, number> = {}
  for (const row of data as unknown as Array<{ category: string }>) {
    counts[row.category] = (counts[row.category] ?? 0) + 1
  }
  return counts
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

// Fetch top repos by 7-day star velocity (trending this week)
export async function getTrendingRepos(limit = 6): Promise<RepoWithEnrichment[]> {
  // Get the latest snapshot date
  const { data: latestRow } = await supabase
    .from('repo_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (!latestRow || latestRow.length === 0) return getTopRepos(limit) // fallback

  const latestDate = (latestRow[0] as unknown as { snapshot_date: string }).snapshot_date

  // Get top repos by stars_7d on the latest snapshot date
  const { data: snapshots, error: sErr } = await supabase
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', latestDate)
    .gt('stars_7d', 0)
    .order('stars_7d', { ascending: false })
    .limit(limit)

  if (sErr || !snapshots || snapshots.length === 0) return getTopRepos(limit)
  const typedSnapshots = snapshots as unknown as Array<{ repo_id: string; stars_7d: number }>

  const repoIds = typedSnapshots.map((s) => s.repo_id)

  // Fetch repos
  const { data: repos, error: rErr } = await supabase
    .from('repos')
    .select('*')
    .in('id', repoIds)

  if (rErr || !repos) return []
  const typedRepos = repos as unknown as RawRepo[]

  // Fetch enrichments
  const { data: enrichments } = await supabase
    .from('enrichments')
    .select('*')
    .in('repo_id', repoIds)

  const typedEnrichments = (enrichments ?? []) as unknown as RawEnrichment[]

  // Join and preserve stars_7d ordering
  const enrichmentMap = new Map<string, RawEnrichment>()
  for (const e of typedEnrichments) enrichmentMap.set(e.repo_id, e)

  const repoMap = new Map<string, RawRepo>()
  for (const r of typedRepos) repoMap.set(r.id, r)

  const results = typedSnapshots
    .map((s) => {
      const repo = repoMap.get(s.repo_id)
      if (!repo) return null
      return { ...repo, enrichment: enrichmentMap.get(s.repo_id) ?? null }
    })
    .filter((r): r is RepoWithEnrichment => r !== null)

  return hydrateDownloads(results)
}

// Fetch daily Claude Code commit data for the chart
// Uses BigQuery aggregate data (from _gitfind/_bigquery_aggregate placeholder repo)
export async function getToolContributionsByDay(): Promise<
  Array<{ date: string; claude_code: number }>
> {
  // Find the BigQuery placeholder repo
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  const placeholderId = placeholder ? (placeholder as unknown as { id: string }).id : null

  // Exclude today (partial data would show a misleading drop)
  const today = new Date().toISOString().slice(0, 10)

  // If we have BigQuery data, use it (comprehensive); otherwise fall back to per-repo API data
  const query = supabase
    .from('tool_contributions')
    .select('month, commit_count')
    .eq('tool_name', 'Claude Code')
    .like('month', '____-__-__') // Only daily entries (YYYY-MM-DD)
    .lt('month', today)
    .order('month', { ascending: true })

  if (placeholderId) {
    query.eq('repo_id', placeholderId)
  }

  const { data, error } = await query

  if (error || !data) return []

  const typedData = data as unknown as Array<{
    month: string
    commit_count: number
  }>

  return typedData.map((row) => ({
    date: row.month,
    claude_code: row.commit_count,
  }))
}

// Tool names tracked in the AI Code Index
const AI_CODE_INDEX_TOOLS = [
  'Claude Code',
  'Cursor',
  'GitHub Copilot',
  'Aider',
  'Gemini CLI',
  'Devin',
] as const

export type AIToolName = (typeof AI_CODE_INDEX_TOOLS)[number]

export interface AICodeIndexRow {
  date: string
  [tool: string]: number | string
}

// Fetch daily commit counts for all AI coding tools (AI Code Index)
export async function getAICodeIndexData(): Promise<AICodeIndexRow[]> {
  // Find the BigQuery placeholder repo
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  // Exclude today (partial data)
  const today = new Date().toISOString().slice(0, 10)

  // Supabase/PostgREST caps responses at 1000 rows — paginate to get all data
  const allRows: Array<{ tool_name: string; month: string; commit_count: number }> = []
  const PAGE_SIZE = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('tool_contributions')
      .select('tool_name, month, commit_count')
      .eq('repo_id', placeholderId)
      .in('tool_name', [...AI_CODE_INDEX_TOOLS])
      .like('month', '____-__-__')
      .lt('month', today)
      .order('month', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error || !data || data.length === 0) break

    const typedPage = data as unknown as Array<{
      tool_name: string
      month: string
      commit_count: number
    }>
    allRows.push(...typedPage)

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const typedData = allRows

  // Pivot: group by date, create one row per date with a column per tool
  const dateMap = new Map<string, AICodeIndexRow>()

  for (const row of typedData) {
    let entry = dateMap.get(row.month)
    if (!entry) {
      entry = { date: row.month } as AICodeIndexRow
      for (const tool of AI_CODE_INDEX_TOOLS) {
        entry[tool] = 0
      }
      dateMap.set(row.month, entry)
    }
    entry[row.tool_name] = row.commit_count
  }

  return Array.from(dateMap.values())
}

// Fetch the latest package download snapshot for a repo
export async function getPackageDownloads(repoId: string): Promise<PackageDownload | null> {
  const { data, error } = await supabase
    .from('package_downloads')
    .select('*')
    .eq('repo_id', repoId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as PackageDownload
}

// Hydrate downloads_7d onto an array of repos (single batch query)
async function hydrateDownloads(
  repos: RepoWithEnrichment[]
): Promise<RepoWithEnrichment[]> {
  if (repos.length === 0) return repos

  const repoIds = repos.map((r) => r.id)

  // Get the latest download snapshot for each repo
  // We order by snapshot_date DESC and deduplicate in JS
  const { data } = await supabase
    .from('package_downloads')
    .select('repo_id, downloads_7d')
    .in('repo_id', repoIds)
    .order('snapshot_date', { ascending: false })

  if (!data || data.length === 0) return repos

  const typedData = data as unknown as Array<{ repo_id: string; downloads_7d: number }>
  const downloadMap = new Map<string, number>()
  for (const row of typedData) {
    // First occurrence per repo_id is the latest (ordered DESC)
    if (!downloadMap.has(row.repo_id)) {
      downloadMap.set(row.repo_id, row.downloads_7d)
    }
  }

  return repos.map((repo) => ({
    ...repo,
    downloads_7d: downloadMap.get(repo.id) ?? null,
  }))
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
