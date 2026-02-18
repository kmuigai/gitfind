// Unit tests for the Early Signal Score algorithm
// Run with: npx tsx lib/score.test.ts
// (No test framework needed — uses Node's built-in assert)

import assert from 'node:assert'
import { calculateScore, type ScoreInputs } from './score.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }
}

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

console.log('\nEarly Signal Score — Unit Tests\n')

// --- Score range tests ---
console.log('Score range:')

test('score is always between 0 and 100', () => {
  const result = calculateScore(base)
  assert.ok(result.score >= 0, `Score ${result.score} is below 0`)
  assert.ok(result.score <= 100, `Score ${result.score} is above 100`)
})

test('zero-star repo scores 0', () => {
  const result = calculateScore({ ...base, stars: 0, stars_7d: 0, stars_30d: 0, forks: 0, contributors: 0, commits_30d: 0, hn_mentions_7d: 0, hn_mentions_30d: 0 })
  assert.strictEqual(result.score, 0)
})

test('a high-velocity repo scores above 50', () => {
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
  assert.ok(result.score > 50, `Expected score > 50, got ${result.score}`)
})

test('a low-signal repo scores below 30', () => {
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
  assert.ok(result.score < 30, `Expected score < 30, got ${result.score}`)
})

// --- Manipulation filter tests ---
console.log('\nManipulation filter:')

test('star spike with no commits triggers penalty', () => {
  const normal = calculateScore(base)
  const manipulated = calculateScore({
    ...base,
    stars_7d: 600,   // Big spike
    commits_30d: 0,  // Zero commits
  })
  assert.ok(
    manipulated.breakdown.manipulation_penalty > 0,
    `Expected penalty > 0, got ${manipulated.breakdown.manipulation_penalty}`
  )
  assert.ok(
    manipulated.score < normal.score,
    `Expected manipulated score (${manipulated.score}) < normal score (${normal.score})`
  )
})

test('large repo with only 1 contributor triggers penalty', () => {
  const result = calculateScore({
    ...base,
    stars: 2000,
    contributors: 1,
  })
  assert.ok(result.breakdown.manipulation_penalty > 0, 'Expected penalty for 2000-star / 1-contributor repo')
})

test('legitimate high-activity repo has no penalty', () => {
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
  assert.strictEqual(result.breakdown.manipulation_penalty, 0, `Expected no penalty for legitimate repo, got ${result.breakdown.manipulation_penalty}`)
})

// --- Weight correctness tests ---
console.log('\nWeight application:')

test('more star velocity → higher score (all else equal)', () => {
  const low = calculateScore({ ...base, stars_7d: 10 })
  const high = calculateScore({ ...base, stars_7d: 500 })
  assert.ok(high.score > low.score, `Expected higher star velocity to produce higher score`)
})

test('more contributors relative to stars → higher score', () => {
  const low = calculateScore({ ...base, contributors: 2 })
  const high = calculateScore({ ...base, contributors: 100 })
  assert.ok(high.score > low.score, `Expected higher contributor ratio to produce higher score`)
})

test('more HN mentions → higher score', () => {
  const low = calculateScore({ ...base, hn_mentions_7d: 0, hn_mentions_30d: 0 })
  const high = calculateScore({ ...base, hn_mentions_7d: 20, hn_mentions_30d: 50 })
  assert.ok(high.score > low.score, `Expected more HN mentions to produce higher score`)
})

// --- Breakdown completeness ---
console.log('\nScore breakdown:')

test('breakdown contains all expected fields', () => {
  const result = calculateScore(base)
  const b = result.breakdown
  assert.ok(typeof b.star_velocity_score === 'number', 'missing star_velocity_score')
  assert.ok(typeof b.contributor_ratio_score === 'number', 'missing contributor_ratio_score')
  assert.ok(typeof b.fork_velocity_score === 'number', 'missing fork_velocity_score')
  assert.ok(typeof b.mention_velocity_score === 'number', 'missing mention_velocity_score')
  assert.ok(typeof b.commit_frequency_score === 'number', 'missing commit_frequency_score')
  assert.ok(typeof b.manipulation_penalty === 'number', 'missing manipulation_penalty')
  assert.ok(typeof b.raw_score === 'number', 'missing raw_score')
  assert.ok(typeof b.final_score === 'number', 'missing final_score')
})

test('final_score matches top-level score', () => {
  const result = calculateScore(base)
  assert.strictEqual(result.score, result.breakdown.final_score)
})

// --- OpenClaw scenario — the product's proof of concept ---
console.log('\nOpenClaw scenario (9K → 200K stars):')

test('OpenClaw at 9K stars scores above 70', () => {
  const openclawEarly: ScoreInputs = {
    stars: 9000,
    stars_7d: 3000,       // Rapid early growth
    stars_30d: 8000,
    contributors: 450,    // High contributor-to-star ratio (builders before fans)
    forks: 2700,          // High fork-to-star ratio (people building on it)
    hn_mentions_7d: 12,   // HN buzz starting
    hn_mentions_30d: 25,
    commits_30d: 80,      // Active development
  }
  const result = calculateScore(openclawEarly)
  assert.ok(result.score > 70, `Expected OpenClaw early score > 70, got ${result.score}`)
})

// --- Results summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
