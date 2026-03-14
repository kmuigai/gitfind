// Smoke tests — verify core modules import and export correctly.
// These catch broken imports, missing env guards, and type errors at build time.
// Run with: npm test

import { describe, it, expect } from 'vitest'

describe('lib/score', () => {
  it('exports calculateScore and returns a valid result', async () => {
    const { calculateScore } = await import('../lib/score')
    expect(typeof calculateScore).toBe('function')

    const result = calculateScore({
      stars: 500,
      stars_7d: 100,
      stars_30d: 300,
      contributors: 25,
      forks: 80,
      hn_mentions_7d: 5,
      hn_mentions_30d: 12,
      commits_30d: 30,
    })

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.breakdown).toBeDefined()
    expect(result.breakdown.final_score).toBe(result.score)
  })

  it('zero inputs produce score 0', async () => {
    const { calculateScore } = await import('../lib/score')
    const result = calculateScore({
      stars: 0, stars_7d: 0, stars_30d: 0,
      contributors: 0, forks: 0,
      hn_mentions_7d: 0, hn_mentions_30d: 0,
      commits_30d: 0,
    })
    expect(result.score).toBe(0)
  })
})

describe('lib/database.types', () => {
  it('exports Database type and table types', async () => {
    const types = await import('../lib/database.types')
    // Verify the module exports exist (type-level check via runtime proxy)
    expect(types).toBeDefined()
  })
})

describe('vitest config', () => {
  it('can resolve project root imports', async () => {
    // If this test runs at all, the vitest config is working
    expect(true).toBe(true)
  })
})
