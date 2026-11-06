// Client-side demand capture — the write path of the Demand Graph.
//
// Sends intent events (searches, project clicks, category views) to
// /api/events, which stores them in demand_events (migration 006).
// Fire-and-forget by design: tracking must never break or slow the page,
// so every failure is swallowed. This is NOT pageview analytics — Vercel
// Analytics owns pageviews; this records what visitors came looking for.
// Privacy model: docs/demand-graph.md.
//
// The pure helpers (payload shaping, session hash, Do Not Track check) are
// exported for unit tests; only the thin wrappers at the bottom touch the
// DOM, and only when called from a browser.

import {
  DEMAND_CAPS,
  DEMAND_EVENT_TYPES,
  type DemandEventType,
} from './demand'

export interface TrackFields {
  query?: string | null
  target?: string | null
  referrerPage?: string | null
}

/** Interpret a navigator.doNotTrack value. '1' and 'yes' mean opt out. */
export function doNotTrackEnabled(value: string | null | undefined): boolean {
  return value === '1' || value === 'yes'
}

/**
 * Shape loose client input into the exact payload /api/events accepts, or
 * null when the event is meaningless (a search with no query, a click with
 * no target). Overlong text is truncated to the route's caps rather than
 * rejected — a visitor's 300-char search string is still a demand signal.
 */
export function shapeTrackPayload(
  eventType: DemandEventType,
  fields: TrackFields,
  sessionHash: string | null,
): Record<string, string> | null {
  if (!(DEMAND_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return null
  }

  const payload: Record<string, string> = { event_type: eventType }

  const query = fields.query?.trim().slice(0, DEMAND_CAPS.query)
  if (query) payload.query = query
  const target = fields.target?.trim().slice(0, DEMAND_CAPS.target)
  if (target) payload.target = target
  const referrerPage = fields.referrerPage?.trim().slice(0, DEMAND_CAPS.referrer_page)
  if (referrerPage) payload.referrer_page = referrerPage
  if (sessionHash) payload.session_hash = sessionHash.slice(0, DEMAND_CAPS.session_hash)

  if (eventType === 'search' && !payload.query) return null
  if (
    (eventType === 'project_click' ||
      eventType === 'category_view' ||
      eventType === 'digest_click') &&
    !payload.target
  ) {
    return null
  }

  return payload
}

/**
 * Hash a per-browser random token with a UTC day stamp (cyrb53 — a fast
 * non-cryptographic hash; this is grouping, not security). The day stamp
 * makes the hash rotate daily: events from the same browser share a hash
 * within one UTC day and share nothing linkable across days.
 */
export function computeSessionHash(token: string, day: string): string {
  const input = `${token}:${day}`
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

const TOKEN_KEY = 'gf-demand-token'

/**
 * The browser's daily session hash. The random token itself never leaves
 * the browser (localStorage only); only the daily hash is sent. Returns
 * null when storage is unavailable (private mode, SSR) — events are still
 * recorded, just ungrouped.
 */
export function getSessionHash(now: Date = new Date()): string | null {
  try {
    let token = window.localStorage.getItem(TOKEN_KEY)
    if (!token) {
      token =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      window.localStorage.setItem(TOKEN_KEY, token)
    }
    return computeSessionHash(token, now.toISOString().slice(0, 10))
  } catch {
    return null
  }
}

/**
 * Record one demand event. Fire-and-forget: returns immediately, sends via
 * sendBeacon (survives page navigation — e.g. a project-link click) with a
 * keepalive fetch fallback, and swallows every error. Sends nothing at all
 * when the browser has Do Not Track on.
 */
export function trackDemandEvent(eventType: DemandEventType, fields: TrackFields = {}): void {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return
    if (doNotTrackEnabled(navigator.doNotTrack)) return

    const payload = shapeTrackPayload(
      eventType,
      {
        query: fields.query,
        target: fields.target,
        referrerPage: fields.referrerPage ?? window.location.pathname,
      },
      getSessionHash(),
    )
    if (!payload) return

    const body = JSON.stringify(payload)
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/events', blob)) return
    }
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Tracking must never surface an error to the page.
  }
}
