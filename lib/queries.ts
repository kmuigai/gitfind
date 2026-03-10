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
  // Paginate to handle 1000-row Supabase/PostgREST cap
  const allRows: Array<{ category: string }> = []
  let offset = 0
  const PAGE_SIZE = 1000

  while (true) {
    const { data } = await supabase
      .from('enrichments')
      .select('category')
      .range(offset, offset + PAGE_SIZE - 1)

    if (!data || data.length === 0) break
    allRows.push(...(data as unknown as Array<{ category: string }>))
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const counts: Record<string, number> = {}
  for (const row of allRows) {
    counts[row.category] = (counts[row.category] ?? 0) + 1
  }
  return counts
}

// Get all repos for sitemap generation
export async function getAllReposForSitemap(): Promise<
  Array<{ owner: string; name: string; updated_at: string; has_enrichment: boolean }>
> {
  // Paginate to handle 1000-row Supabase/PostgREST cap (DB has 5K+ repos)
  const allRows: Array<{ owner: string; name: string; updated_at: string; has_enrichment: boolean }> = []
  let offset = 0
  const PAGE_SIZE = 1000

  while (true) {
    const { data } = await supabase
      .from('repos')
      .select('owner, name, updated_at, enrichments(id)')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (!data || data.length === 0) break

    const typed = data as unknown as Array<{
      owner: string
      name: string
      updated_at: string
      enrichments: { id: string }[] | null
    }>
    allRows.push(
      ...typed.map((r) => ({
        owner: r.owner,
        name: r.name,
        updated_at: r.updated_at,
        has_enrichment: Array.isArray(r.enrichments) && r.enrichments.length > 0,
      }))
    )
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return allRows
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

  // Over-fetch so we can drop unenriched repos and still return `limit` results
  const { data: snapshots, error: sErr } = await supabase
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', latestDate)
    .gt('stars_7d', 0)
    .order('stars_7d', { ascending: false })
    .limit(limit * 3)

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

  const results: RepoWithEnrichment[] = []
  for (const s of typedSnapshots) {
    if (results.length >= limit) break
    const repo = repoMap.get(s.repo_id)
    const enrichment = enrichmentMap.get(s.repo_id)
    if (!repo || !enrichment) continue
    results.push({ ...repo, enrichment })
  }

  return hydrateDownloads(results)
}

// Fetch top rising repos with star velocity data for insights pages
export interface RisingRepo extends RepoWithEnrichment {
  stars_7d: number
  stars_7d_prev: number
}

export async function getRisingRepos(limit = 10, snapshotDate?: string): Promise<RisingRepo[]> {
  let targetDate = snapshotDate

  if (!targetDate) {
    // Get the latest snapshot date
    const { data: latestRow } = await supabase
      .from('repo_snapshots')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)

    if (!latestRow || latestRow.length === 0) return []
    targetDate = (latestRow[0] as unknown as { snapshot_date: string }).snapshot_date
  }

  const latestDate = targetDate

  // Get date 7 days prior for acceleration
  const latestD = new Date(latestDate)
  latestD.setDate(latestD.getDate() - 7)
  const prevDate = latestD.toISOString().slice(0, 10)

  // Fetch latest snapshots sorted by stars_7d
  const { data: snapshots, error: sErr } = await supabase
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', latestDate)
    .gt('stars_7d', 0)
    .order('stars_7d', { ascending: false })
    .limit(limit * 3)

  if (sErr || !snapshots || snapshots.length === 0) return []
  const typedSnapshots = snapshots as unknown as Array<{ repo_id: string; stars_7d: number }>
  const repoIds = typedSnapshots.map((s) => s.repo_id)

  // Fetch previous week snapshots for acceleration
  const { data: prevSnapshots } = await supabase
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', prevDate)
    .in('repo_id', repoIds)

  const prevMap = new Map<string, number>()
  if (prevSnapshots) {
    for (const s of prevSnapshots as unknown as Array<{ repo_id: string; stars_7d: number }>) {
      prevMap.set(s.repo_id, s.stars_7d)
    }
  }

  // Fetch repos + enrichments
  const [{ data: repos }, { data: enrichments }] = await Promise.all([
    supabase.from('repos').select('*').in('id', repoIds),
    supabase.from('enrichments').select('*').in('repo_id', repoIds),
  ])

  if (!repos) return []
  const typedRepos = repos as unknown as RawRepo[]
  const typedEnrichments = (enrichments ?? []) as unknown as RawEnrichment[]

  const enrichmentMap = new Map<string, RawEnrichment>()
  for (const e of typedEnrichments) enrichmentMap.set(e.repo_id, e)
  const repoMap = new Map<string, RawRepo>()
  for (const r of typedRepos) repoMap.set(r.id, r)

  const results: RisingRepo[] = []
  for (const s of typedSnapshots) {
    if (results.length >= limit) break
    const repo = repoMap.get(s.repo_id)
    const enrichment = enrichmentMap.get(s.repo_id)
    if (!repo || !enrichment) continue
    results.push({
      ...repo,
      enrichment,
      stars_7d: s.stars_7d,
      stars_7d_prev: prevMap.get(s.repo_id) ?? 0,
    })
  }

  return results
}

// Get distinct snapshot dates (for generating archive pages)
export async function getSnapshotDates(): Promise<string[]> {
  const { data } = await supabase
    .from('repo_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(100)

  if (!data) return []
  const typed = data as unknown as Array<{ snapshot_date: string }>
  // Deduplicate (PostgREST doesn't support DISTINCT on select)
  const seen = new Set<string>()
  return typed.filter((r) => {
    if (seen.has(r.snapshot_date)) return false
    seen.add(r.snapshot_date)
    return true
  }).map((r) => r.snapshot_date)
}

// Fetch repos that crossed star thresholds (1k, 5k, 10k, 25k, 50k, 100k) in the last 30 days
export interface BreakoutRepo extends RepoWithEnrichment {
  stars_now: number
  stars_30d_ago: number
  threshold: number
}

const THRESHOLDS = [100_000, 50_000, 25_000, 10_000, 5_000, 1_000] as const

export async function getBreakoutRepos(): Promise<BreakoutRepo[]> {
  // Get latest snapshot date
  const { data: latestRow } = await supabase
    .from('repo_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (!latestRow || latestRow.length === 0) return []
  const latestDate = (latestRow[0] as unknown as { snapshot_date: string }).snapshot_date

  // Get date ~30 days prior
  const latestD = new Date(latestDate)
  latestD.setDate(latestD.getDate() - 30)
  const pastDate = latestD.toISOString().slice(0, 10)

  // Find the closest actual snapshot date to 30 days ago
  const { data: pastRow } = await supabase
    .from('repo_snapshots')
    .select('snapshot_date')
    .lte('snapshot_date', pastDate)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (!pastRow || pastRow.length === 0) return []
  const actualPastDate = (pastRow[0] as unknown as { snapshot_date: string }).snapshot_date

  // Get current snapshots for repos with significant stars
  const { data: currentSnaps } = await supabase
    .from('repo_snapshots')
    .select('repo_id, stars')
    .eq('snapshot_date', latestDate)
    .gte('stars', 1000)
    .order('stars', { ascending: false })
    .limit(500)

  if (!currentSnaps || currentSnaps.length === 0) return []
  const typedCurrent = currentSnaps as unknown as Array<{ repo_id: string; stars: number }>
  const repoIds = typedCurrent.map((s) => s.repo_id)

  // Get past snapshots for same repos
  const { data: pastSnaps } = await supabase
    .from('repo_snapshots')
    .select('repo_id, stars')
    .eq('snapshot_date', actualPastDate)
    .in('repo_id', repoIds)

  if (!pastSnaps) return []
  const pastMap = new Map<string, number>()
  for (const s of pastSnaps as unknown as Array<{ repo_id: string; stars: number }>) {
    pastMap.set(s.repo_id, s.stars)
  }

  // Find repos that crossed a threshold
  const crossers: Array<{ repo_id: string; stars_now: number; stars_30d_ago: number; threshold: number }> = []
  for (const snap of typedCurrent) {
    const past = pastMap.get(snap.repo_id)
    if (past == null) continue
    for (const t of THRESHOLDS) {
      if (snap.stars >= t && past < t) {
        crossers.push({ repo_id: snap.repo_id, stars_now: snap.stars, stars_30d_ago: past, threshold: t })
        break // Only report the highest threshold crossed
      }
    }
  }

  if (crossers.length === 0) return []

  // Sort by threshold DESC, then stars DESC
  crossers.sort((a, b) => b.threshold - a.threshold || b.stars_now - a.stars_now)

  const crosserIds = crossers.map((c) => c.repo_id)

  // Fetch repos + enrichments
  const [{ data: repos }, { data: enrichments }] = await Promise.all([
    supabase.from('repos').select('*').in('id', crosserIds),
    supabase.from('enrichments').select('*').in('repo_id', crosserIds),
  ])

  if (!repos) return []
  const typedRepos = repos as unknown as RawRepo[]
  const typedEnrichments = (enrichments ?? []) as unknown as RawEnrichment[]

  const enrichmentMap = new Map<string, RawEnrichment>()
  for (const e of typedEnrichments) enrichmentMap.set(e.repo_id, e)
  const repoMap = new Map<string, RawRepo>()
  for (const r of typedRepos) repoMap.set(r.id, r)

  const results: BreakoutRepo[] = []
  for (const c of crossers) {
    const repo = repoMap.get(c.repo_id)
    const enrichment = enrichmentMap.get(c.repo_id)
    if (!repo || !enrichment) continue
    results.push({
      ...repo,
      enrichment,
      stars_now: c.stars_now,
      stars_30d_ago: c.stars_30d_ago,
      threshold: c.threshold,
    })
  }

  return results
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
  'Codex',
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

// Config file adoption data (repos with AGENTS.md, .cursorrules, etc.)
export interface ConfigAdoptionRow {
  tool: string
  count: number
  date: string
}

export async function getConfigAdoptionData(): Promise<ConfigAdoptionRow[]> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  // Config entries have tool_name like "Claude Code [config]"
  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .like('tool_name', '%[config]')
    .order('month', { ascending: false })
    .limit(100)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  // Get the latest date for each tool
  const latestByTool = new Map<string, { count: number; date: string }>()
  for (const row of typed) {
    const tool = row.tool_name.replace(' [config]', '')
    if (!latestByTool.has(tool)) {
      latestByTool.set(tool, { count: row.commit_count, date: row.month })
    }
  }

  return Array.from(latestByTool.entries()).map(([tool, { count, date }]) => ({
    tool,
    count,
    date,
  }))
}

// SDK dependency adoption data (repos with @anthropic-ai/sdk in package.json, etc.)
export async function getSDKAdoptionData(): Promise<ConfigAdoptionRow[]> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .like('tool_name', '%[sdk]')
    .order('month', { ascending: false })
    .limit(100)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  const latestByTool = new Map<string, { count: number; date: string }>()
  for (const row of typed) {
    const tool = row.tool_name.replace(' [sdk]', '')
    if (!latestByTool.has(tool)) {
      latestByTool.set(tool, { count: row.commit_count, date: row.month })
    }
  }

  return Array.from(latestByTool.entries()).map(([tool, { count, date }]) => ({
    tool,
    count,
    date,
  }))
}

// Config adoption time-series (all daily entries, not just latest)
export interface AdoptionTimeSeriesEntry {
  tool: string
  date: string
  count: number
}

export async function getConfigAdoptionTimeSeries(): Promise<AdoptionTimeSeriesEntry[]> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .like('tool_name', '%[config]')
    .order('month', { ascending: true })
    .limit(500)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  return typed.map((row) => ({
    tool: row.tool_name.replace(' [config]', ''),
    date: row.month,
    count: row.commit_count,
  }))
}

// SDK adoption time-series (all daily entries, not just latest)
export async function getSDKAdoptionTimeSeries(): Promise<AdoptionTimeSeriesEntry[]> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .like('tool_name', '%[sdk]')
    .order('month', { ascending: true })
    .limit(500)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  return typed.map((row) => ({
    tool: row.tool_name.replace(' [sdk]', ''),
    date: row.month,
    count: row.commit_count,
  }))
}

// AI Agent PR data — latest counts per bot
export async function getAgentPRData(): Promise<ConfigAdoptionRow[]> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .like('tool_name', '%[pr]')
    .order('month', { ascending: false })
    .limit(100)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  const latestByTool = new Map<string, { count: number; date: string }>()
  for (const row of typed) {
    const tool = row.tool_name.replace(' [pr]', '')
    if (!latestByTool.has(tool)) {
      latestByTool.set(tool, { count: row.commit_count, date: row.month })
    }
  }

  return Array.from(latestByTool.entries()).map(([tool, { count, date }]) => ({
    tool,
    count,
    date,
  }))
}

// AI Agent PR time-series
export async function getAgentPRTimeSeries(): Promise<AdoptionTimeSeriesEntry[]> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .like('tool_name', '%[pr]')
    .order('month', { ascending: true })
    .limit(500)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  return typed.map((row) => ({
    tool: row.tool_name.replace(' [pr]', ''),
    date: row.month,
    count: row.commit_count,
  }))
}

// Aggregate KPI — total repos with any AI tool config + total AI commits
export async function getAggregateKPIs(): Promise<{ configAggregate: number | null; commitAggregate: number | null }> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return { configAggregate: null, commitAggregate: null }
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, commit_count')
    .eq('repo_id', placeholderId)
    .in('tool_name', ['All Tools [config-aggregate]', 'All Tools [commit-aggregate]'])
    .order('month', { ascending: false })
    .limit(10)

  if (error || !data) return { configAggregate: null, commitAggregate: null }

  const typed = data as unknown as Array<{
    tool_name: string
    commit_count: number
  }>

  let configAggregate: number | null = null
  let commitAggregate: number | null = null

  for (const row of typed) {
    if (row.tool_name === 'All Tools [config-aggregate]' && configAggregate === null) {
      configAggregate = row.commit_count
    }
    if (row.tool_name === 'All Tools [commit-aggregate]' && commitAggregate === null) {
      commitAggregate = row.commit_count
    }
  }

  return { configAggregate, commitAggregate }
}

// HN Buzz — latest mention counts and points per tool
export async function getHNBuzzData(): Promise<Array<{ tool: string; mentions: number; points: number }>> {
  const { data: placeholder } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  if (!placeholder) return []
  const placeholderId = (placeholder as unknown as { id: string }).id

  const { data, error } = await supabase
    .from('tool_contributions')
    .select('tool_name, month, commit_count')
    .eq('repo_id', placeholderId)
    .or('tool_name.like.%[hn-buzz],tool_name.like.%[hn-points]')
    .order('month', { ascending: false })
    .limit(200)

  if (error || !data) return []

  const typed = data as unknown as Array<{
    tool_name: string
    month: string
    commit_count: number
  }>

  // Get latest entry per tool per type
  const latestBuzz = new Map<string, number>()
  const latestPoints = new Map<string, number>()

  for (const row of typed) {
    if (row.tool_name.endsWith('[hn-buzz]')) {
      const tool = row.tool_name.replace(' [hn-buzz]', '')
      if (!latestBuzz.has(tool)) latestBuzz.set(tool, row.commit_count)
    } else if (row.tool_name.endsWith('[hn-points]')) {
      const tool = row.tool_name.replace(' [hn-points]', '')
      if (!latestPoints.has(tool)) latestPoints.set(tool, row.commit_count)
    }
  }

  const tools = new Set([...latestBuzz.keys(), ...latestPoints.keys()])
  return Array.from(tools).map((tool) => ({
    tool,
    mentions: latestBuzz.get(tool) ?? 0,
    points: latestPoints.get(tool) ?? 0,
  }))
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
