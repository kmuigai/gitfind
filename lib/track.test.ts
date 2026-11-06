// Unit tests for the client-side demand capture helpers (lib/track.ts)
// Run with: npm test (Vitest) — these cover the pure functions only; the
// sendBeacon/fetch wrappers are thin DOM glue and are exercised in the browser.

import { describe, it, expect } from 'vitest'
import { computeSessionHash, doNotTrackEnabled, shapeTrackPayload } from './track'

describe('shapeTrackPayload', () => {
  it('builds a minimal search payload', () => {
    expect(shapeTrackPayload('search', { query: 'vector db' }, 'hash1')).toEqual({
      event_type: 'search',
      query: 'vector db',
      session_hash: 'hash1',
    })
  })

  it('builds a project_click payload with query context and referrer', () => {
    expect(
      shapeTrackPayload(
        'project_click',
        { target: 'a/b', query: 'rag', referrerPage: '/search' },
        null,
      ),
    ).toEqual({
      event_type: 'project_click',
      target: 'a/b',
      query: 'rag',
      referrer_page: '/search',
    })
  })

  it('trims and truncates overlong fields to the route caps instead of failing', () => {
    const payload = shapeTrackPayload('search', { query: ` ${'a'.repeat(250)} ` }, null)
    expect(payload?.query).toHaveLength(200)
  })

  it('drops blank optional fields', () => {
    expect(
      shapeTrackPayload('category_view', { target: 'ai-ml', query: '   ' }, ''),
    ).toEqual({ event_type: 'category_view', target: 'ai-ml' })
  })

  it('returns null for meaningless events', () => {
    expect(shapeTrackPayload('search', {}, 'h')).toBeNull()
    expect(shapeTrackPayload('search', { query: '  ' }, 'h')).toBeNull()
    expect(shapeTrackPayload('project_click', { query: 'rag' }, 'h')).toBeNull()
    expect(shapeTrackPayload('category_view', {}, 'h')).toBeNull()
    expect(shapeTrackPayload('digest_click', {}, 'h')).toBeNull()
  })
})

describe('computeSessionHash', () => {
  it('is deterministic for the same token and day', () => {
    expect(computeSessionHash('token-1', '2026-11-06')).toBe(
      computeSessionHash('token-1', '2026-11-06'),
    )
  })

  it('rotates daily — same token, different day, different hash', () => {
    expect(computeSessionHash('token-1', '2026-11-06')).not.toBe(
      computeSessionHash('token-1', '2026-11-07'),
    )
  })

  it('differs between tokens on the same day', () => {
    expect(computeSessionHash('token-1', '2026-11-06')).not.toBe(
      computeSessionHash('token-2', '2026-11-06'),
    )
  })

  it('produces a 16-char hex string', () => {
    expect(computeSessionHash('token-1', '2026-11-06')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('doNotTrackEnabled', () => {
  it('treats 1 and yes as opt-outs', () => {
    expect(doNotTrackEnabled('1')).toBe(true)
    expect(doNotTrackEnabled('yes')).toBe(true)
  })

  it('treats everything else as no opt-out', () => {
    expect(doNotTrackEnabled('0')).toBe(false)
    expect(doNotTrackEnabled('unspecified')).toBe(false)
    expect(doNotTrackEnabled(null)).toBe(false)
    expect(doNotTrackEnabled(undefined)).toBe(false)
  })
})
