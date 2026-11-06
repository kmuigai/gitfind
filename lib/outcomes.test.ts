// Unit tests for the Outcomes Ledger lifecycle classifier (lib/outcomes.ts)
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import {
  DEAD_INACTIVITY_DAYS,
  OUTCOME_EVENT_TYPES,
  classifyLifecycle,
  type LifecycleCandidate,
} from './outcomes'

const NOW = new Date('2026-11-06T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

function candidate(partial: Partial<LifecycleCandidate> = {}): LifecycleCandidate {
  return {
    archived: false,
    pushed_at: daysAgo(10),
    url: 'https://github.com/someone/project',
    ...partial,
  }
}

describe('taxonomy', () => {
  it('has exactly the 8 v1 event types', () => {
    expect(OUTCOME_EVENT_TYPES).toHaveLength(8)
    expect(OUTCOME_EVENT_TYPES).toContain('dead')
    expect(OUTCOME_EVENT_TYPES).toContain('funding')
  })
})

describe('classifyLifecycle', () => {
  it('archived repo → dead, confirmed, dated at last push', () => {
    const result = classifyLifecycle(candidate({ archived: true, pushed_at: daysAgo(90) }), NOW)
    expect(result).not.toBeNull()
    expect(result!.event_type).toBe('dead')
    expect(result!.confidence).toBe('confirmed')
    expect(result!.event_date).toBe(daysAgo(90).slice(0, 10))
    expect(result!.detected_by).toBe('lifecycle-scan')
    expect(result!.source_url).toBe('https://github.com/someone/project')
  })

  it('archived repo with no pushed_at → dead, confirmed, dated at detection', () => {
    const result = classifyLifecycle(candidate({ archived: true, pushed_at: null }), NOW)
    expect(result).not.toBeNull()
    expect(result!.event_type).toBe('dead')
    expect(result!.confidence).toBe('confirmed')
    expect(result!.event_date).toBe('2026-11-06')
    expect(result!.details).toContain('no pushed_at on record')
  })

  it('archived wins over inactivity (still one confirmed event, never shutdown)', () => {
    const result = classifyLifecycle(candidate({ archived: true, pushed_at: daysAgo(900) }), NOW)
    expect(result!.event_type).toBe('dead')
    expect(result!.confidence).toBe('confirmed')
  })

  it(`inactive for exactly ${DEAD_INACTIVITY_DAYS} days → dead, likely`, () => {
    const result = classifyLifecycle(candidate({ pushed_at: daysAgo(DEAD_INACTIVITY_DAYS) }), NOW)
    expect(result).not.toBeNull()
    expect(result!.event_type).toBe('dead')
    expect(result!.confidence).toBe('likely')
    expect(result!.event_date).toBe(daysAgo(DEAD_INACTIVITY_DAYS).slice(0, 10))
  })

  it('inactive well past the threshold → dead, likely', () => {
    const result = classifyLifecycle(candidate({ pushed_at: daysAgo(1200) }), NOW)
    expect(result!.event_type).toBe('dead')
    expect(result!.confidence).toBe('likely')
    expect(result!.details).toContain('1200 days')
  })

  it('inactive one day short of the threshold → no event', () => {
    const result = classifyLifecycle(candidate({ pushed_at: daysAgo(DEAD_INACTIVITY_DAYS - 1) }), NOW)
    expect(result).toBeNull()
  })

  it('recently pushed repo → no event', () => {
    expect(classifyLifecycle(candidate({ pushed_at: daysAgo(3) }), NOW)).toBeNull()
  })

  it('no pushed_at and not archived → no event (nothing honest to record)', () => {
    expect(classifyLifecycle(candidate({ pushed_at: null }), NOW)).toBeNull()
  })

  it('unparseable pushed_at and not archived → no event', () => {
    expect(classifyLifecycle(candidate({ pushed_at: 'not-a-date' }), NOW)).toBeNull()
  })

  it('unparseable pushed_at but archived → dead at detection date', () => {
    const result = classifyLifecycle(candidate({ archived: true, pushed_at: 'not-a-date' }), NOW)
    expect(result!.event_type).toBe('dead')
    expect(result!.event_date).toBe('2026-11-06')
  })
})
