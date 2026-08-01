import { describe, it, expect } from 'vitest'
import { hashKey, round3, vortexLayout, type UniversePlanet } from './universe'

describe('hashKey', () => {
  it('is deterministic and key-sensitive', () => {
    expect(hashKey('acme/rocket')).toBe(hashKey('acme/rocket'))
    expect(hashKey('acme/rocket')).not.toBe(hashKey('acme/anvil'))
  })
})

describe('round3', () => {
  it('rounds to 3 decimals', () => {
    expect(round3(1.23456)).toBe(1.235)
    expect(round3(0)).toBe(0)
  })
})

const planets: UniversePlanet[] = [
  { key: 'acme/rocket', category: 'Developer Tools', stars: 50000 },
  { key: 'acme/anvil', category: 'Developer Tools', stars: 5000 },
  { key: 'globex/box', category: 'Security', stars: 20000 },
  { key: 'acme/torch', category: 'AI / Machine Learning', stars: 1000 },
]

describe('vortexLayout', () => {
  it('seats the biggest planet dead center', () => {
    const layout = vortexLayout(planets)
    const center = layout.get('acme/rocket')!
    expect(center.x).toBe(50)
    expect(center.y).toBe(50)
  })

  it('positions every planet inside the sky, deterministically', () => {
    const a = vortexLayout(planets)
    const b = vortexLayout(planets)
    for (const p of planets) {
      const pos = a.get(p.key)!
      expect(pos.x).toBeGreaterThanOrEqual(4)
      expect(pos.x).toBeLessThanOrEqual(96)
      expect(pos.y).toBeGreaterThanOrEqual(6)
      expect(pos.y).toBeLessThanOrEqual(94)
      expect(pos).toEqual(b.get(p.key))
    }
  })

  it('spirals outward in descending size order', () => {
    const layout = vortexLayout(planets)
    const dist = (k: string) => {
      const pos = layout.get(k)!
      return Math.hypot(pos.x - 50, pos.y - 50)
    }
    expect(dist('acme/rocket')).toBe(0) // 50k — center
    expect(dist('globex/box')).toBeLessThan(dist('acme/anvil')) // 20k before 5k
    expect(dist('acme/anvil')).toBeLessThan(dist('acme/torch')) // 5k before 1k
  })

  it('keeps blobs comfortably separated at fixture scale', () => {
    const layout = vortexLayout(planets)
    const positions = planets.map((p) => layout.get(p.key)!)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y)
        expect(d).toBeGreaterThan(4)
      }
    }
  })
})
