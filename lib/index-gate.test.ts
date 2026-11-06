// Unit tests for the E1 index gate (lib/index-gate.ts)
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import {
  INDEXABLE_PROJECT_LIMIT,
  compareIndexCandidates,
  indexableProjectKeys,
  isSpamRepo,
  projectKey,
  selectIndexableProjects,
  type IndexCandidate,
} from './index-gate'

function candidate(partial: Partial<IndexCandidate> = {}): IndexCandidate {
  return {
    owner: 'someone',
    name: 'project',
    description: null,
    score: 50,
    updated_at: '2026-01-01T00:00:00Z',
    scored_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

// --- Spam gate ---

describe('Spam gate', () => {
  it('catches the crack-tutorial repo found live in the sitemap', () => {
    expect(
      isSpamRepo({ owner: 'zntuo98', name: '-Photoshop-BestTutorialCracked-2026' })
    ).toBe(true)
  })

  it('catches keygen / warez / nulled / premium-free patterns', () => {
    expect(isSpamRepo({ owner: 'a', name: 'office-keygen' })).toBe(true)
    expect(isSpamRepo({ owner: 'a', name: 'warez-scene-releases' })).toBe(true)
    expect(isSpamRepo({ owner: 'a', name: 'themeforest-nulled-themes' })).toBe(true)
    expect(isSpamRepo({ owner: 'a', name: 'spotify-premium-free' })).toBe(true)
    expect(isSpamRepo({ owner: 'a', name: 'free-premium-accounts' })).toBe(true)
  })

  it('catches piracy signals in the description, not just the name', () => {
    expect(
      isSpamRepo({ owner: 'a', name: 'downloader', description: 'Get the cracked version here' })
    ).toBe(true)
  })

  it('catches a bare "crack" token in the name', () => {
    expect(isSpamRepo({ owner: 'a', name: 'wifi-crack' })).toBe(true)
    expect(isSpamRepo({ owner: 'a', name: 'crack-2026' })).toBe(true)
  })

  it('spares legitimate projects that merely contain the substring', () => {
    // AWS's microVM monitor — "firecracker" must not trip the gate
    expect(isSpamRepo({ owner: 'firecracker-microvm', name: 'firecracker' })).toBe(false)
    // Physics library named Crackle
    expect(isSpamRepo({ owner: 'a', name: 'Crackle' })).toBe(false)
    // Security-research tooling uses "cracker" in its legitimate sense
    expect(isSpamRepo({ owner: 'a', name: 'password-cracker-benchmark' })).toBe(false)
    expect(isSpamRepo({ owner: 'a', name: 'zip-cracking-tool' })).toBe(false)
  })

  it('spares an ordinary project', () => {
    expect(
      isSpamRepo({ owner: 'vercel', name: 'next.js', description: 'The React Framework' })
    ).toBe(false)
  })
})

// --- Ordering ---

describe('compareIndexCandidates', () => {
  it('orders by score descending', () => {
    const high = candidate({ score: 90 })
    const low = candidate({ score: 10 })
    expect(compareIndexCandidates(high, low)).toBeLessThan(0)
    expect(compareIndexCandidates(low, high)).toBeGreaterThan(0)
  })

  it('treats a missing score as below every real score', () => {
    const scored = candidate({ score: 0 })
    const unscored = candidate({ score: null })
    expect(compareIndexCandidates(scored, unscored)).toBeLessThan(0)
  })

  it('breaks score ties by most recently updated, then by key', () => {
    const newer = candidate({ score: 50, updated_at: '2026-06-01T00:00:00Z' })
    const older = candidate({ score: 50, updated_at: '2026-01-01T00:00:00Z' })
    expect(compareIndexCandidates(newer, older)).toBeLessThan(0)

    const a = candidate({ owner: 'aaa', name: 'x', score: 50 })
    const b = candidate({ owner: 'bbb', name: 'x', score: 50 })
    expect(compareIndexCandidates(a, b)).toBeLessThan(0)
    expect(compareIndexCandidates(b, a)).toBeGreaterThan(0)
  })
})

// --- Selection ---

describe('selectIndexableProjects', () => {
  it('keeps the top N by score and respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      candidate({ owner: `o${i}`, name: `r${i}`, score: i })
    )
    const selected = selectIndexableProjects(many, 3)
    expect(selected.map((p) => p.score)).toEqual([9, 8, 7])
  })

  it('defaults to INDEXABLE_PROJECT_LIMIT', () => {
    const many = Array.from({ length: INDEXABLE_PROJECT_LIMIT + 25 }, (_, i) =>
      candidate({ owner: `o${i}`, name: `r${i}`, score: i })
    )
    expect(selectIndexableProjects(many)).toHaveLength(INDEXABLE_PROJECT_LIMIT)
  })

  it('excludes spam-gated repos even when they outscore everyone', () => {
    const spam = candidate({ owner: 'zntuo98', name: '-Photoshop-BestTutorialCracked-2026', score: 100 })
    const legit = candidate({ owner: 'a', name: 'real-project', score: 1 })
    const selected = selectIndexableProjects([spam, legit], 2)
    expect(selected).toEqual([legit])
  })

  it('does not mutate the input array', () => {
    const input = [candidate({ score: 1 }), candidate({ score: 99 })]
    selectIndexableProjects(input, 1)
    expect(input.map((p) => p.score)).toEqual([1, 99])
  })

  it('at production scale: 40K candidates in, exactly 500 out', () => {
    const many = Array.from({ length: 40_000 }, (_, i) =>
      candidate({ owner: `owner${i}`, name: `repo${i}`, score: (i * 7919) % 101 })
    )
    const selected = selectIndexableProjects(many)
    expect(selected).toHaveLength(500)
    // Top of the ranking must be the maximum score present in the fixture
    expect(selected[0].score).toBe(100)
    // Deterministic: selecting twice yields the identical set and order
    expect(selectIndexableProjects(many)).toEqual(selected)
  })
})

// --- Membership keys ---

describe('indexableProjectKeys / projectKey', () => {
  it('keys are lowercased owner/name pairs', () => {
    expect(projectKey('FaceBook', 'React')).toBe('facebook/react')
    const keys = indexableProjectKeys([candidate({ owner: 'FaceBook', name: 'React' })])
    expect(keys.has('facebook/react')).toBe(true)
    expect(keys.has(projectKey('facebook', 'react'))).toBe(true)
  })
})
