import { describe, it, expect } from 'vitest'
import { MODEL_REGISTRY, MODEL_FAMILIES } from './models'

describe('MODEL_REGISTRY', () => {
  it('has unique keys', () => {
    const keys = MODEL_REGISTRY.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every weight model has a valid hf repo id (org/name)', () => {
    for (const m of MODEL_REGISTRY.filter((m) => m.family !== 'runtime')) {
      expect(m.hfRepoId, m.key).toMatch(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
    }
  })

  it('runtime entries have github repos but no hf repo id', () => {
    for (const m of MODEL_REGISTRY.filter((m) => m.family === 'runtime')) {
      expect(m.hfRepoId).toBeNull()
      expect(m.github).not.toBeNull()
    }
  })

  it('families list matches what the registry uses', () => {
    for (const m of MODEL_REGISTRY) {
      expect(MODEL_FAMILIES).toContain(m.family)
    }
  })
})
