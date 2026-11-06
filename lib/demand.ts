// The Demand Graph — event taxonomy + payload validation.
//
// Demand events record visitor intent on gitfind.ai (searches, project
// clicks, category views, digest clicks) in GitFind's own demand_events
// table (migration 006) — a proprietary asset, not pageview analytics.
// Rationale: docs/demand-graph.md.
//
// This module is pure (no I/O) so it is unit-testable. The API route
// (app/api/events/route.ts) validates with it; the client helper
// (lib/track.ts) shapes payloads against the same caps.

/** The 4 v1 event types. Mirrors the CHECK constraint in migration 006. */
export const DEMAND_EVENT_TYPES = [
  'search',
  'project_click',
  'category_view',
  'digest_click',
] as const

export type DemandEventType = (typeof DEMAND_EVENT_TYPES)[number]

/** Field length caps — enforced by the route, pre-applied by the client. */
export const DEMAND_CAPS = {
  query: 200,
  target: 200,
  referrer_page: 300,
  session_hash: 64,
} as const

/** The only field names an event payload may carry. Anything else is rejected. */
export const DEMAND_FIELDS = [
  'event_type',
  'query',
  'target',
  'referrer_page',
  'session_hash',
] as const

/** Event types that are meaningless without a query. */
const QUERY_REQUIRED: readonly DemandEventType[] = ['search']

/** Event types that are meaningless without a target. */
const TARGET_REQUIRED: readonly DemandEventType[] = [
  'project_click',
  'category_view',
  'digest_click',
]

/** A validated event, ready to insert into demand_events (id/created_at default). */
export interface ValidatedDemandEvent {
  event_type: DemandEventType
  query: string | null
  target: string | null
  referrer_page: string | null
  session_hash: string | null
}

export type DemandValidation =
  | { ok: true; event: ValidatedDemandEvent }
  | { ok: false; error: string }

/**
 * Read an optional string field: absent/null → null; a trimmed string → the
 * string (or null when blank); anything else or over the cap → an error.
 */
function optionalField(
  body: Record<string, unknown>,
  key: keyof typeof DEMAND_CAPS,
): { value: string | null } | { error: string } {
  const raw = body[key]
  if (raw === undefined || raw === null) return { value: null }
  if (typeof raw !== 'string') return { error: `${key} must be a string` }
  const trimmed = raw.trim()
  if (trimmed.length > DEMAND_CAPS[key]) {
    return { error: `${key} is too long` }
  }
  return { value: trimmed === '' ? null : trimmed }
}

/**
 * Validate an untrusted event payload (from the /api/events request body).
 * Strict on purpose: unknown fields are rejected outright, so the table
 * only ever contains the documented shape — no smuggled PII, no junk keys.
 */
export function validateDemandEvent(body: unknown): DemandValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' }
  }

  const record = body as Record<string, unknown>

  for (const key of Object.keys(record)) {
    if (!(DEMAND_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, error: `Unexpected field: ${key}` }
    }
  }

  const typeRaw = record.event_type
  if (
    typeof typeRaw !== 'string' ||
    !(DEMAND_EVENT_TYPES as readonly string[]).includes(typeRaw)
  ) {
    return { ok: false, error: 'A valid event_type is required' }
  }
  const eventType = typeRaw as DemandEventType

  const query = optionalField(record, 'query')
  if ('error' in query) return { ok: false, error: query.error }
  const target = optionalField(record, 'target')
  if ('error' in target) return { ok: false, error: target.error }
  const referrerPage = optionalField(record, 'referrer_page')
  if ('error' in referrerPage) return { ok: false, error: referrerPage.error }
  const sessionHash = optionalField(record, 'session_hash')
  if ('error' in sessionHash) return { ok: false, error: sessionHash.error }

  if (QUERY_REQUIRED.includes(eventType) && query.value === null) {
    return { ok: false, error: 'query is required for search events' }
  }
  if (TARGET_REQUIRED.includes(eventType) && target.value === null) {
    return { ok: false, error: `target is required for ${eventType} events` }
  }

  return {
    ok: true,
    event: {
      event_type: eventType,
      query: query.value,
      target: target.value,
      referrer_page: referrerPage.value,
      session_hash: sessionHash.value,
    },
  }
}
