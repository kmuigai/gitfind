// Unit tests for the Early Signal Score algorithm
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import { calculateScore, type ScoreInputs } from './score'

// Base inputs: a "normal" healthy rising project
const base: ScoreInputs = {
  stars: 500,
  stars_7d: 100,
  stars_30d: 300,
  contributors: 25,
  forks: 80,
  hn_mentions_7d: 5,
  hn_mentions_30d: 12,
  commits_30d: 30,
}

// --- Score range tests ---
describe('Score range', () => {
  it('score is always between 0 and 100', () => {
    const result = calculateScore(base)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('zero-star repo scores 0', () => {
    const result = calculateScore({ ...base, stars: 0, stars_7d: 0, stars_30d: 0, forks: 0, contributors: 0, commits_30d: 0, hn_mentions_7d: 0, hn_mentions_30d: 0 })
    expect(result.score).toBe(0)
  })

  it('a high-velocity repo scores above 50', () => {
    const highVelocity: ScoreInputs = {
      stars: 5000,
      stars_7d: 800,
      stars_30d: 2000,
      contributors: 80,
      forks: 500,
      hn_mentions_7d: 15,
      hn_mentions_30d: 40,
      commits_30d: 60,
    }
    const result = calculateScore(highVelocity)
    expect(result.score).toBeGreaterThan(50)
  })

  it('a low-signal repo scores below 30', () => {
    const lowSignal: ScoreInputs = {
      stars: 50,
      stars_7d: 1,
      stars_30d: 5,
      contributors: 1,
      forks: 3,
      hn_mentions_7d: 0,
      hn_mentions_30d: 0,
      commits_30d: 2,
    }
    const result = calculateScore(lowSignal)
    expect(result.score).toBeLessThan(30)
  })
})

// --- Manipulation filter tests ---
describe('Manipulation filter', () => {
  it('star spike with no commits triggers penalty', () => {
    const normal = calculateScore(base)
    const manipulated = calculateScore({
      ...base,
      stars_7d: 600,   // Big spike
      commits_30d: 0,  // Zero commits
    })
    expect(manipulated.breakdown.manipulation_penalty).toBeGreaterThan(0)
    expect(manipulated.score).toBeLessThan(normal.score)
  })

  it('large repo with only 1 contributor triggers penalty', () => {
    const result = calculateScore({
      ...base,
      stars: 2000,
      contributors: 1,
    })
    expect(result.breakdown.manipulation_penalty).toBeGreaterThan(0)
  })

  it('legitimate high-activity repo has no penalty', () => {
    const legit: ScoreInputs = {
      stars: 1000,
      stars_7d: 150,
      stars_30d: 400,
      contributors: 50,
      forks: 120,
      hn_mentions_7d: 8,
      hn_mentions_30d: 20,
      commits_30d: 45,
    }
    const result = calculateScore(legit)
    expect(result.breakdown.manipulation_penalty).toBe(0)
  })
})

// --- Weight correctness tests ---
describe('Weight application', () => {
  it('more star velocity → higher score (all else equal)', () => {
    const low = calculateScore({ ...base, stars_7d: 10 })
    const high = calculateScore({ ...base, stars_7d: 500 })
    expect(high.score).toBeGreaterThan(low.score)
  })

  it('more contributors relative to stars → higher score', () => {
    const low = calculateScore({ ...base, contributors: 2 })
    const high = calculateScore({ ...base, contributors: 100 })
    expect(high.score).toBeGreaterThan(low.score)
  })

  it('more HN mentions → higher score', () => {
    const low = calculateScore({ ...base, hn_mentions_7d: 0, hn_mentions_30d: 0 })
    const high = calculateScore({ ...base, hn_mentions_7d: 20, hn_mentions_30d: 50 })
    expect(high.score).toBeGreaterThan(low.score)
  })
})

// --- Breakdown completeness ---
describe('Score breakdown', () => {
  it('breakdown contains all expected fields', () => {
    const result = calculateScore(base)
    const b = result.breakdown
    expect(typeof b.star_velocity_score).toBe('number')
    expect(typeof b.contributor_ratio_score).toBe('number')
    expect(typeof b.fork_velocity_score).toBe('number')
    expect(typeof b.mention_velocity_score).toBe('number')
    expect(typeof b.commit_frequency_score).toBe('number')
    expect(typeof b.manipulation_penalty).toBe('number')
    expect(typeof b.raw_score).toBe('number')
    expect(typeof b.final_score).toBe('number')
  })

  it('final_score matches top-level score', () => {
    const result = calculateScore(base)
    expect(result.score).toBe(result.breakdown.final_score)
  })
})

// --- OpenClaw scenario — the product's proof of concept ---
describe('OpenClaw scenario (9K → 200K stars)', () => {
  it('OpenClaw at 9K stars scores above 70', () => {
    const openclawEarly: ScoreInputs = {
      stars: 9000,
      stars_7d: 3000,       // Rapid early growth
      stars_30d: 8000,
      contributors: 450,    // High contributor-to-star ratio (builders before fans)
      forks: 2700,          // High fork-to-star ratio (people building on it)
      hn_mentions_7d: 12,   // HN buzz starting
      hn_mentions_30d: 25,
      commits_30d: 80,      // Active development
      // Acceleration inputs (added to the algorithm after this test was
      // written): the scenario is explosive growth from ~0, so last week
      // was necessarily slower than this week.
      stars_7d_prev: 1200,  // 3,000 this week vs 1,200 the week before
      forks_7d: 810,        // ~30% of all forks arrived this week
      forks_7d_prev: 405,   // …double the week before
    }
    const result = calculateScore(openclawEarly)
    expect(result.score).toBeGreaterThan(70)
  })
})
