// The Outcomes Ledger — Phase 2 news detection (pure logic).
//
// Phase 1 (lib/outcomes.ts) records 'dead' from repo state. The other seven
// event types are company/product events — a funding round, an acquisition,
// a product shutdown — that repo metadata cannot evidence. They are detected
// from news: candidate headlines are fetched from keyless public sources
// (Google News RSS, Hacker News via Algolia), keyword patterns nominate the
// plausible event classes, an LLM classifies the candidates, and THIS
// module's deterministic validation decides what may enter the ledger:
//
//   - the event type must be one of the seven news classes (never 'dead' —
//     the lifecycle scan owns 'dead', and shutdown ≠ dead in this taxonomy);
//   - the evidence quote must appear verbatim in the fetched headline or
//     snippet it is attributed to (an ungrounded quote is a hallucination
//     risk, and the row is rejected);
//   - the source URL must be one of the fetched items;
//   - the event date must be a real date, not in the future;
//   - confidence is 'confirmed' only for a primary source (the project's,
//     company's, or acquirer's own announcement) with a verified quote —
//     everything else is 'likely', per the rules in docs/outcomes-ledger.md.
//
// This module is pure (no I/O) so it is unit-testable; the sweep that feeds
// it lives in scripts/detect-news-outcomes.ts.

import { OUTCOME_EVENT_TYPES, type OutcomeConfidence, type OutcomeEventType } from './outcomes.js'

/** The event types the news sweep may write: the full taxonomy minus 'dead'. */
export const NEWS_EVENT_TYPES = OUTCOME_EVENT_TYPES.filter(
  (t): t is Exclude<OutcomeEventType, 'dead'> => t !== 'dead',
)

export type NewsEventType = (typeof NEWS_EVENT_TYPES)[number]

/** Minimal repo shape the news sweep needs (from the repos table). */
export interface NewsCandidate {
  id: string
  owner: string
  name: string
  url: string
  description: string | null
}

/** One fetched headline, normalized across sources. */
export interface NewsItem {
  title: string
  url: string
  /** ISO date (YYYY-MM-DD) the item was published. */
  publishedDate: string
  /** Publisher name when the source provides one (e.g. "TechCrunch"). */
  sourceName: string | null
  /** Headline-adjacent text (RSS description / HN story text), tags stripped. */
  snippet: string
  origin: 'google-news' | 'hn'
}

/** A classified news outcome, ready to insert into project_outcomes. */
export interface NewsOutcome {
  event_type: NewsEventType
  /** ISO date (YYYY-MM-DD) the event occurred. */
  event_date: string
  source_url: string
  details: string
  confidence: OutcomeConfidence
  detected_by: 'news-sweep'
}

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

const EVENT_QUERY_TERMS =
  'raises OR funding OR acquired OR acquisition OR "shuts down" OR shutdown OR pivot OR launches OR adopted OR joins'

/**
 * Google News queries for one repo. Two angles: the exact repo path (catches
 * GitHub-centric coverage that names owner/name), and the bare project name
 * fenced by event vocabulary (catches company-level coverage). Name
 * collisions are expected at this stage — nomination + classification +
 * validation downstream do the disambiguation, and a human-readable dry run
 * shows every row before anything is written.
 */
export function buildGoogleNewsQueries(repo: NewsCandidate): string[] {
  return [`"${repo.owner}/${repo.name}"`, `"${repo.name}" (${EVENT_QUERY_TERMS})`]
}

export function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
}

/** HN Algolia story search for one repo, stories only, since a timestamp. */
export function hnSearchUrl(repo: NewsCandidate, sinceEpochSeconds: number): string {
  const query = encodeURIComponent(`${repo.owner}/${repo.name}`)
  return (
    `https://hn.algolia.com/api/v1/search?query=${query}&tags=story` +
    `&numericFilters=${encodeURIComponent(`created_at_i>${sinceEpochSeconds}`)}&hitsPerPage=20`
  )
}

// ---------------------------------------------------------------------------
// Source payload shaping
// ---------------------------------------------------------------------------

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITY_MAP[entity] ?? entity)
}

export function stripTags(html: string): string {
  // Decode first: RSS descriptions carry entity-escaped HTML (&lt;a …&gt;),
  // which only becomes strippable markup after decoding.
  return decodeEntities(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  if (!match) return null
  const cdata = match[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (cdata ? cdata[1] : match[1]).trim()
}

/**
 * Parse a Google News RSS feed into NewsItems. Deliberately a small,
 * defensive extractor rather than a full XML parser: malformed input yields
 * fewer (or zero) items, never a throw — a bad feed must not kill a sweep.
 * Note the item links are news.google.com article links (they redirect to
 * the publisher); the publisher itself is carried in sourceName and named
 * in the stored details.
 */
export function parseGoogleNewsRss(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  for (const block of blocks) {
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const pubDate = extractTag(block, 'pubDate')
    if (!title || !link || !pubDate) continue
    const published = new Date(pubDate)
    if (Number.isNaN(published.getTime())) continue
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)
    items.push({
      title: decodeEntities(title),
      url: link,
      publishedDate: toIsoDate(published),
      sourceName: sourceMatch ? decodeEntities(sourceMatch[1].trim()) : null,
      snippet: stripTags(extractTag(block, 'description') ?? ''),
      origin: 'google-news',
    })
  }
  return items
}

interface HnHit {
  title?: string | null
  url?: string | null
  story_text?: string | null
  created_at?: string
  objectID: string
}

/** Shape HN Algolia hits into NewsItems. Self-posts link to the HN item. */
export function hnHitsToNewsItems(hits: HnHit[]): NewsItem[] {
  const items: NewsItem[] = []
  for (const hit of hits) {
    if (!hit.title || !hit.created_at) continue
    const published = new Date(hit.created_at)
    if (Number.isNaN(published.getTime())) continue
    items.push({
      title: decodeEntities(hit.title),
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      publishedDate: toIsoDate(published),
      sourceName: 'Hacker News',
      snippet: hit.story_text ? stripTags(hit.story_text) : '',
      origin: 'hn',
    })
  }
  return items
}

// ---------------------------------------------------------------------------
// Keyword nomination — the cheap pre-filter before the LLM call
// ---------------------------------------------------------------------------

export const EVENT_KEYWORD_PATTERNS: Record<NewsEventType, RegExp[]> = {
  funding: [
    /\braises?\b/i,
    /\braised\b/i,
    /\bfunding\b/i,
    /\bpre-seed\b/i,
    /\bseed round\b/i,
    /\bseries [a-e]\b/i,
    /\bsecures? \$?\d/i,
    /\bcloses? \$?\d/i,
    /\bgrant of\b/i,
  ],
  acquired: [/\bacqui/i, /\bpurchased by\b/i, /\bjoins forces with\b/i],
  shutdown: [
    /\bshut(s|ting)? down\b/i,
    /\bshutdown\b/i,
    /\bsunset(s|ting|ted)?\b/i,
    /\bdiscontinu/i,
    /\bwind(s|ing)? down\b/i,
    /\bclosing down\b/i,
  ],
  pivot: [/\bpivot/i, /\brebrand/i, /\brenamed to\b/i, /\bformerly known as\b/i, /\brelaunches as\b/i],
  adopted: [
    /\badopt/i,
    /\bintegrat/i,
    /\bbundl/i,
    /\bnow (powers|runs on|ships with)\b/i,
    /\bdonates? .* to (the )?[a-z ]*foundation/i,
  ],
  maintainer_move: [/\bjoins\b/i, /\bhired\b/i, /\bhires\b/i, /\bsteps down\b/i, /\bleaves .* to\b/i],
  breakout: [/\blaunch/i, /\breleases?\b/i, /\bannounces?\b/i, /\bintroduces?\b/i, /\bshow hn\b/i, /\b\d+\.\d+ release\b/i],
}

/** Which event classes an item's text plausibly evidences (nomination only). */
export function nominatedEventTypes(item: NewsItem): NewsEventType[] {
  const text = `${item.title} ${item.snippet}`
  return NEWS_EVENT_TYPES.filter((type) =>
    EVENT_KEYWORD_PATTERNS[type].some((pattern) => pattern.test(text)),
  )
}

// ---------------------------------------------------------------------------
// LLM classification contract + deterministic validation
// ---------------------------------------------------------------------------

/** What the classifier is asked to return per accepted event. */
export interface LlmOutcomeProposal {
  event_type: string
  event_date: string | null
  /** Verbatim quote from the item's title or snippet evidencing the event. */
  evidence_quote: string
  /** The specifics: amount raised, acquirer, adopter, who moved where… */
  details: string
  /** True when the item is the project's/company's/acquirer's own announcement. */
  primary_source: boolean
  source_url: string
}

export interface RejectedProposal {
  proposal: LlmOutcomeProposal
  reason: string
}

export function buildClassificationPrompt(repo: NewsCandidate, items: NewsItem[]): string {
  const itemList = items
    .map(
      (item, i) =>
        `[${i}] ${item.publishedDate} · ${item.sourceName ?? item.origin} · ${item.title}\n    URL: ${item.url}\n    Snippet: ${item.snippet || '(none)'}`,
    )
    .join('\n')
  return [
    `You classify news about one tracked open-source project into outcome events for a database.`,
    ``,
    `Project: ${repo.owner}/${repo.name} (${repo.url})`,
    repo.description ? `Description: ${repo.description}` : '',
    ``,
    `Event types (use ONLY these): ${NEWS_EVENT_TYPES.join(', ')}.`,
    `Never use 'dead': a quiet or archived repo is not a news event, and a company shutdown is 'shutdown', not 'dead'.`,
    `Only report an event when one of the items below clearly states that THIS project/company did it — not a namesake, not a roundup that merely mentions it, not a competitor's event.`,
    ``,
    `For each event return an object with:`,
    `- event_type: one of the types above`,
    `- event_date: the date the event happened (YYYY-MM-DD) if the text states it, else null`,
    `- evidence_quote: a verbatim quote copied character-for-character from that item's title or snippet`,
    `- details: the specifics a reader needs (amount raised, acquirer, adopter, who moved where)`,
    `- primary_source: true only if the item is the project's, company's, or acquirer's own announcement`,
    `- source_url: the item's URL, copied exactly`,
    ``,
    `Respond with a JSON array of these objects and nothing else. If no item evidences an event for this project, respond with [].`,
    ``,
    `Items:`,
    itemList,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

const MIN_QUOTE_LENGTH = 12

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value
}

/**
 * Validate raw classifier proposals against the fetched items. This is the
 * gate between an LLM's opinion and the ledger: everything accepted here is
 * grounded in a fetched item, carries its evidence quote into `details`,
 * and follows the ledger's confidence + event-date rules.
 */
export function validateProposals(
  proposals: LlmOutcomeProposal[],
  items: NewsItem[],
  now: Date,
): { accepted: NewsOutcome[]; rejected: RejectedProposal[] } {
  const accepted: NewsOutcome[] = []
  const rejected: RejectedProposal[] = []
  const itemsByUrl = new Map(items.map((item) => [item.url, item]))
  const todayIso = toIsoDate(now)
  const seen = new Set<string>()

  for (const proposal of proposals) {
    const reject = (reason: string) => rejected.push({ proposal, reason })

    if (!(NEWS_EVENT_TYPES as readonly string[]).includes(proposal.event_type)) {
      reject(`event_type '${proposal.event_type}' is not a news-sweep class`)
      continue
    }
    const eventType = proposal.event_type as NewsEventType

    const item = itemsByUrl.get(proposal.source_url)
    if (!item) {
      reject('source_url is not one of the fetched items')
      continue
    }

    const quote = (proposal.evidence_quote ?? '').trim()
    const haystack = normalizeText(`${item.title} ${item.snippet}`)
    if (quote.length < MIN_QUOTE_LENGTH || !haystack.includes(normalizeText(quote))) {
      reject('evidence quote not found verbatim in the fetched item')
      continue
    }

    let eventDate = item.publishedDate
    if (proposal.event_date !== null && proposal.event_date !== undefined) {
      if (!isValidIsoDate(proposal.event_date)) {
        reject(`event_date '${proposal.event_date}' is not a valid ISO date`)
        continue
      }
      if (proposal.event_date > todayIso) {
        reject(`event_date '${proposal.event_date}' is in the future`)
        continue
      }
      eventDate = proposal.event_date
    }

    const details = (proposal.details ?? '').trim()
    if (!details) {
      reject('details is empty')
      continue
    }

    const key = `${eventType}|${eventDate}`
    if (seen.has(key)) {
      reject('duplicate of an accepted proposal in the same run')
      continue
    }
    seen.add(key)

    const sourceLabel = item.sourceName ?? (item.origin === 'hn' ? 'Hacker News' : 'Google News')
    accepted.push({
      event_type: eventType,
      event_date: eventDate,
      source_url: item.url,
      details: `${details} Evidence: "${quote}" (${sourceLabel}, ${item.publishedDate}).`,
      confidence: proposal.primary_source ? 'confirmed' : 'likely',
      detected_by: 'news-sweep',
    })
  }

  return { accepted, rejected }
}

/** Idempotency key: one row per repo, event type, and event date. */
export function outcomeDedupeKey(repoId: string, eventType: string, eventDate: string): string {
  return `${repoId}|${eventType}|${eventDate}`
}
