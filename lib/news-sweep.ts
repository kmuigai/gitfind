// The Outcomes Ledger — news sweep engine (shared I/O core).
//
// lib/news-outcomes.ts holds the pure detection logic (queries, parsing,
// nomination, validation). This module holds the network + database side of
// a sweep — fetching candidate headlines, classifying them with one
// Anthropic call per repo, loading the ledger's existing dedupe keys, and
// inserting accepted outcomes — so every sweep driver shares ONE engine:
//
//   - scripts/detect-news-outcomes.ts — the bounded weekly sweep;
//   - scripts/backfill-outcomes.ts    — the 2025–26 top-1,000 backfill,
//     which additionally records an outcome_checks row per repo it passes.
//
// Behavior here is the behavior the weekly sweep shipped with (Phase 2,
// PR #55): same sources, same per-repo item cap, same dedupe discipline.

import { createServiceClient } from './supabase.js'
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
  type RejectedProposal,
} from './news-outcomes.js'

type DB = ReturnType<typeof createServiceClient>

const PAGE_SIZE = 1000
export const MAX_ITEMS_PER_REPO = 12
const FETCH_TIMEOUT_MS = 15_000

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
export async function fetchCandidates(repo: NewsCandidate, sinceEpoch: number): Promise<NewsItem[]> {
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

export type ClassifyFn = (repo: NewsCandidate, items: NewsItem[]) => Promise<LlmOutcomeProposal[]>

/**
 * The Anthropic classifier, created lazily: the client (and its required
 * ANTHROPIC_API_KEY) is only needed once a repo actually has nominated
 * candidates — a sweep over quiet repos runs keyless end to end.
 */
export function createClassifier(): ClassifyFn {
  let anthropic: Anthropic | null = null
  return async (repo, items) => {
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
}

/**
 * Dedupe keys for every news-class outcome already in the ledger. A sweep
 * skips any accepted outcome whose key is in this set (and adds the keys it
 * accepts), so re-running a sweep never writes the same event twice; the
 * partial unique index from migration 009 enforces it at the DB level too.
 */
export async function loadExistingOutcomeKeys(supabase: DB): Promise<Set<string>> {
  const keys = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('project_outcomes')
      .select('repo_id, event_type, event_date')
      .neq('event_type', 'dead')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`reading existing outcomes: ${error.message}`)
    for (const row of data ?? []) keys.add(outcomeDedupeKey(row.repo_id, row.event_type, row.event_date))
    if (!data || data.length < PAGE_SIZE) break
  }
  return keys
}

/**
 * One classifier proposal the validation gate turned away, with the repo it
 * was proposed for and the specific reason. A sweep that only counts its
 * rejections is unauditable — over a 1,000-repo backfill, "4 rejected"
 * says nothing about whether the gate caught hallucinations or is
 * misfiring — so every rejection travels with its reason and both sweep
 * drivers log one line per rejection (see rejectionLogLine).
 */
export interface RejectedSweepProposal extends RejectedProposal {
  repoId: string
  /** "owner/name", for log lines. */
  label: string
}

/** The one-line audit record for a rejected proposal, shared by both drivers. */
export function rejectionLogLine(rejected: RejectedSweepProposal): string {
  return `${rejected.label} → ${rejected.proposal.event_type} rejected: ${rejected.reason}`
}

export interface SweepRepoResult {
  /** Accepted outcomes whose dedupe key was not already on record. */
  accepted: NewsOutcome[]
  /** Classifier proposals the deterministic validation rejected, each with its reason. */
  rejected: RejectedSweepProposal[]
  /** Classifier proposals the deterministic validation rejected. */
  rejectedCount: number
  /** True when the repo had at least one keyword-nominated candidate. */
  hadCandidates: boolean
}

export interface SweepRepoOptions {
  /** Look back this many days from `now` for candidate headlines. */
  sinceDays: number
  now: Date
  classify: ClassifyFn
  /** Shared dedupe set — accepted outcomes' keys are added as they land. */
  existingKeys: Set<string>
}

/**
 * Run the full detection pipeline for ONE repo: fetch candidates inside the
 * window, keep the keyword-nominated ones (capped), classify, validate, and
 * drop anything already on record. Nothing is written here — the caller
 * decides what to insert (and, for the backfill, what check to record).
 */
export async function sweepRepo(repo: NewsCandidate, options: SweepRepoOptions): Promise<SweepRepoResult> {
  const { sinceDays, now, classify, existingKeys } = options
  const sinceEpoch = Math.floor(now.getTime() / 1000) - sinceDays * 24 * 60 * 60

  const items = await fetchCandidates(repo, sinceEpoch)
  const nominated = items
    .filter((item) => item.publishedDate >= new Date(sinceEpoch * 1000).toISOString().slice(0, 10))
    .filter((item) => nominatedEventTypes(item).length > 0)
    .slice(0, MAX_ITEMS_PER_REPO)
  if (nominated.length === 0) return { accepted: [], rejected: [], rejectedCount: 0, hadCandidates: false }

  const proposals = await classify(repo, nominated)
  const { accepted, rejected } = validateProposals(proposals, nominated, now)

  const fresh: NewsOutcome[] = []
  for (const outcome of accepted) {
    const key = outcomeDedupeKey(repo.id, outcome.event_type, outcome.event_date)
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    fresh.push(outcome)
  }
  return {
    accepted: fresh,
    rejected: rejected.map((r) => ({ ...r, repoId: repo.id, label: `${repo.owner}/${repo.name}` })),
    rejectedCount: rejected.length,
    hadCandidates: true,
  }
}

/** A project_outcomes insert row for one accepted outcome. */
export function toOutcomeInsertRow(repoId: string, outcome: NewsOutcome) {
  return {
    repo_id: repoId,
    event_type: outcome.event_type,
    event_date: outcome.event_date,
    source_url: outcome.source_url,
    details: outcome.details,
    confidence: outcome.confidence,
    detected_by: outcome.detected_by,
  }
}

export type OutcomeInsertRow = ReturnType<typeof toOutcomeInsertRow>

/** Insert accepted outcomes. Empty input is a no-op. */
export async function insertOutcomeRows(supabase: DB, rows: OutcomeInsertRow[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.from('project_outcomes').insert(rows)
  if (error) throw new Error(`inserting outcomes: ${error.message}`)
}
