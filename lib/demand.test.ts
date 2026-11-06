// Unit tests for Demand Graph payload validation (lib/demand.ts)
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import { DEMAND_EVENT_TYPES, validateDemandEvent } from './demand'

describe('taxonomy', () => {
  it('has exactly the 4 v1 event types', () => {
    expect(DEMAND_EVENT_TYPES).toHaveLength(4)
    expect(DEMAND_EVENT_TYPES).toContain('search')
    expect(DEMAND_EVENT_TYPES).toContain('project_click')
    expect(DEMAND_EVENT_TYPES).toContain('category_view')
    expect(DEMAND_EVENT_TYPES).toContain('digest_click')
  })
})

describe('validateDemandEvent', () => {
  it('accepts a minimal search event', () => {
    const result = validateDemandEvent({ event_type: 'search', query: 'vector db' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event).toEqual({
        event_type: 'search',
        query: 'vector db',
        target: null,
        referrer_page: null,
        session_hash: null,
      })
    }
  })

  it('accepts a full project_click event and trims strings', () => {
    const result = validateDemandEvent({
      event_type: 'project_click',
      query: '  rag framework ',
      target: ' langchain-ai/langchain ',
      referrer_page: '/search',
      session_hash: 'abc123',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event.query).toBe('rag framework')
      expect(result.event.target).toBe('langchain-ai/langchain')
      expect(result.event.referrer_page).toBe('/search')
      expect(result.event.session_hash).toBe('abc123')
    }
  })

  it('rejects non-object bodies', () => {
    expect(validateDemandEvent(null).ok).toBe(false)
    expect(validateDemandEvent('search').ok).toBe(false)
    expect(validateDemandEvent([{ event_type: 'search', query: 'x' }]).ok).toBe(false)
  })

  it('rejects a missing or unknown event_type', () => {
    expect(validateDemandEvent({ query: 'x' }).ok).toBe(false)
    expect(validateDemandEvent({ event_type: 'pageview' }).ok).toBe(false)
    expect(validateDemandEvent({ event_type: 'page_view' }).ok).toBe(false)
  })

  it('rejects unexpected fields — the table only holds the documented shape', () => {
    const result = validateDemandEvent({
      event_type: 'search',
      query: 'x',
      email: 'someone@example.com',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Unexpected field: email')
  })

  it('requires a query for search events', () => {
    expect(validateDemandEvent({ event_type: 'search' }).ok).toBe(false)
    expect(validateDemandEvent({ event_type: 'search', query: '   ' }).ok).toBe(false)
  })

  it('requires a target for click and view events', () => {
    expect(validateDemandEvent({ event_type: 'project_click', query: 'x' }).ok).toBe(false)
    expect(validateDemandEvent({ event_type: 'category_view' }).ok).toBe(false)
    expect(validateDemandEvent({ event_type: 'digest_click' }).ok).toBe(false)
    expect(
      validateDemandEvent({ event_type: 'category_view', target: 'ai-ml' }).ok,
    ).toBe(true)
  })

  it('enforces the length caps', () => {
    const longQuery = 'a'.repeat(201)
    expect(validateDemandEvent({ event_type: 'search', query: longQuery }).ok).toBe(false)
    const okQuery = 'a'.repeat(200)
    expect(validateDemandEvent({ event_type: 'search', query: okQuery }).ok).toBe(true)
    expect(
      validateDemandEvent({
        event_type: 'search',
        query: 'x',
        session_hash: 'h'.repeat(65),
      }).ok,
    ).toBe(false)
    expect(
      validateDemandEvent({
        event_type: 'search',
        query: 'x',
        referrer_page: `/${'p'.repeat(300)}`,
      }).ok,
    ).toBe(false)
  })

  it('rejects non-string field values', () => {
    expect(validateDemandEvent({ event_type: 'search', query: 42 }).ok).toBe(false)
    expect(
      validateDemandEvent({ event_type: 'search', query: 'x', target: { a: 1 } }).ok,
    ).toBe(false)
  })

  it('treats blank optional strings as absent', () => {
    const result = validateDemandEvent({
      event_type: 'project_click',
      target: 'a/b',
      query: '  ',
      referrer_page: '',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event.query).toBeNull()
      expect(result.event.referrer_page).toBeNull()
    }
  })
})
