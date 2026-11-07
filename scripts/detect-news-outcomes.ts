// Outcomes Ledger — news sweep (Board Directive 2 Phase 2, Nov 6, 2026)
// The second automated writer for project_outcomes. The lifecycle scan
// (scripts/detect-lifecycle-outcomes.ts) records 'dead' from repo state;
// this sweep detects the company/product events repo state cannot evidence
// — funding, acquired, shutdown, pivot, adopted, maintainer_move, breakout —
// from news, and writes them with detected_by = 'news-sweep'.
//
// Method (design: docs/outcomes-ledger.md, "Phase 2 — the news sweep"):
//   1. Fetch candidate headlines from two keyless sources reachable from
//      GitHub Actions: Google News RSS search and Hacker News (Algolia).
//   2. Keyword patterns nominate plausible event classes per headline
//      (lib/news-outcomes.ts) — items with no nomination never reach the LLM.
//   3. One Anthropic call per repo classifies the nominated candidates
//      (ANTHROPIC_API_KEY, the same secret and model the digest uses).
//   4. Deterministic validation gates every proposal before it can become
//      a row: verbatim evidence quote in the fetched item, source URL among
//      the fetched items, valid non-future date, never 'dead'.
//
// Idempotent: rows are keyed by (repo_id, event_type, event_date); existing
// keys are skipped, and migration 009 adds the matching partial unique
// index so the guarantee also holds at the database level.
//
// Run (dry run — the default, prints what it WOULD insert, writes nothing):
//   npx tsx scripts/detect-news-outcomes.ts
// Bounded inputs:
//   npx tsx scripts/detect-news-outcomes.ts --repo acme/widgetkit,other/project
//   npx tsx scripts/detect-news-outcomes.ts --limit 100 --since-days 730
// Run for real:
//   npx tsx scripts/detect-news-outcomes.ts --write
//
// NOTE: the dry-run default is deliberate, as with the lifecycle scan —
// this writes to the proprietary ledger, so writing must be an explicit act.
//
// Requires migration 005 (project_outcomes); migration 009 hardens dedupe.
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY — only when a repo actually has nominated candidates.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServiceClient } from '../lib/supabase.js'
import type Anthropic from '@anthropic-ai/sdk'
import {
  buildClassificationPrompt,
  buildGoogleNewsQueries,
  googleNewsRssUrl,
  hnHitsToNewsItems,
  hnSearchUrl,
  nominatedEventTypes,
  outcomeDedupeKey,
  parseGoogleNewsRss,
  validateProposals,
  type LlmOutcomeProposal,
  type NewsCandidate,
  type NewsItem,
  type NewsOutcome,
} from '../lib/news-outcomes.js'

const WRITE = process.argv.includes('--write')
const PAGE_SIZE = 1000
const INSERT_CHUNK = 500
const SAMPLE_LINES = 10
const MAX_ITEMS_PER_REPO = 12
const FETCH_TIMEOUT_MS = 15_000

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

const LIMIT = Number(argValue('--limit') ?? 25)
const SINCE_DAYS = Number(argValue('--since-days') ?? 365)
const REPO_FILTER = (argValue('--repo') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

interface RepoRow extends NewsCandidate {
  stars: number
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GitFind/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const text = await fetchText(url)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** All candidate headlines for one repo, deduped by URL, newest first. */
async function fetchCandidates(repo: NewsCandidate, sinceEpoch: number): Promise<NewsItem[]> {
  const byUrl = new Map<string, NewsItem>()

  for (const query of buildGoogleNewsQueries(repo)) {
    const xml = await fetchText(googleNewsRssUrl(query))
    if (!xml) continue
    for (const item of parseGoogleNewsRss(xml)) byUrl.set(item.url, item)
  }

  const hn = (await fetchJson(hnSearchUrl(repo, sinceEpoch))) as { hits?: unknown[] } | null
  if (hn && Array.isArray(hn.hits)) {
    for (const item of hnHitsToNewsItems(hn.hits as Parameters<typeof hnHitsToNewsItems>[0])) {
      if (!byUrl.has(item.url)) byUrl.set(item.url, item)
    }
  }

  return [...byUrl.values()].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
}

async function main() {
  const supabase = createServiceClient()
  const now = new Date()
  const sinceEpoch = Math.floor(now.getTime() / 1000) - SINCE_DAYS * 24 * 60 * 60

  // Repos already carrying a news-class outcome — never written twice.
  const existingKeys = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('project_outcomes')
      .select('repo_id, event_type, event_date')
      .neq('event_type', 'dead')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`reading existing outcomes: ${error.message}`)
    for (const row of data ?? []) existingKeys.add(outcomeDedupeKey(row.repo_id, row.event_type, row.event_date))
    if (!data || data.length < PAGE_SIZE) break
  }

  // The bounded input: an explicit --repo list, or the top repos by stars.
  let repos: RepoRow[] = []
  if (REPO_FILTER.length > 0) {
    for (const fullName of REPO_FILTER) {
      const [owner, name] = fullName.split('/')
      if (!owner || !name) continue
      const { data, error } = await supabase
        .from('repos')
        .select('id, owner, name, url, description, stars')
        .ilike('owner', owner)
        .ilike('name', name)
        .limit(1)
      if (error) throw new Error(`reading repo ${fullName}: ${error.message}`)
      if (data && data.length > 0) repos.push(data[0] as RepoRow)
    }
  } else {
    const { data, error } = await supabase
      .from('repos')
      .select('id, owner, name, url, description, stars')
      .order('stars', { ascending: false })
      .limit(LIMIT)
    if (error) throw new Error(`reading repos: ${error.message}`)
    repos = (data ?? []) as RepoRow[]
  }

  console.log(
    `News sweep over ${repos.length} repos (window: last ${SINCE_DAYS} days) · ` +
      `${existingKeys.size} existing news outcomes on record`,
  )

  // The Anthropic client is only needed once a repo has nominated
  // candidates — a sweep over quiet repos runs keyless end to end.
  let anthropic: Anthropic | null = null
  async function classify(repo: NewsCandidate, items: NewsItem[]): Promise<LlmOutcomeProposal[]> {
    if (!anthropic) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required once candidates are nominated')
      }
      const { default: AnthropicClient } = await import('@anthropic-ai/sdk')
      anthropic = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY })
    }
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildClassificationPrompt(repo, items) }],
    })
    const content = message.content[0]
    if (!content || content.type !== 'text') return []
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      const parsed: unknown = JSON.parse(cleaned)
      return Array.isArray(parsed) ? (parsed as LlmOutcomeProposal[]) : []
    } catch {
      return []
    }
  }

  let checked = 0
  let withCandidates = 0
  let rejectedCount = 0
  const pending: { repo_id: string; label: string; outcome: NewsOutcome }[] = []

  for (const repo of repos) {
    checked++
    const items = await fetchCandidates(repo, sinceEpoch)
    const nominated = items
      .filter((item) => item.publishedDate >= new Date(sinceEpoch * 1000).toISOString().slice(0, 10))
      .filter((item) => nominatedEventTypes(item).length > 0)
      .slice(0, MAX_ITEMS_PER_REPO)
    if (nominated.length === 0) continue
    withCandidates++

    const proposals = await classify(repo, nominated)
    const { accepted, rejected } = validateProposals(proposals, nominated, now)
    rejectedCount += rejected.length
    for (const outcome of accepted) {
      const key = outcomeDedupeKey(repo.id, outcome.event_type, outcome.event_date)
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      pending.push({ repo_id: repo.id, label: `${repo.owner}/${repo.name}`, outcome })
    }
  }

  const byType = new Map<string, number>()
  for (const p of pending) byType.set(p.outcome.event_type, (byType.get(p.outcome.event_type) ?? 0) + 1)
  console.log(
    `Checked ${checked} repos · ${withCandidates} had nominated candidates · ` +
      `${rejectedCount} proposals rejected by validation`,
  )
  console.log(
    `New news outcomes: ${pending.length}` +
      (byType.size > 0 ? ` (${[...byType.entries()].map(([t, n]) => `${t}: ${n}`).join(', ')})` : ''),
  )
  for (const p of pending.slice(0, SAMPLE_LINES)) {
    console.log(
      `  ${p.label} → ${p.outcome.event_type} @ ${p.outcome.event_date} (${p.outcome.confidence}) — ${p.outcome.details}`,
    )
  }
  if (pending.length > SAMPLE_LINES) console.log(`  … and ${pending.length - SAMPLE_LINES} more`)

  if (!WRITE) {
    console.log('\nDry run — nothing written. Re-run with --write to insert.')
    return
  }

  let inserted = 0
  for (let i = 0; i < pending.length; i += INSERT_CHUNK) {
    const chunk = pending.slice(i, i + INSERT_CHUNK).map((p) => ({
      repo_id: p.repo_id,
      event_type: p.outcome.event_type,
      event_date: p.outcome.event_date,
      source_url: p.outcome.source_url,
      details: p.outcome.details,
      confidence: p.outcome.confidence,
      detected_by: p.outcome.detected_by,
    }))
    const { error } = await supabase.from('project_outcomes').insert(chunk)
    if (error) throw new Error(`inserting outcomes: ${error.message}`)
    inserted += chunk.length
  }
  console.log(`\nInserted ${inserted} rows into project_outcomes.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
