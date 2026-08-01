// Layout math for the Universe Hero — the night sky.
// Pure functions — unit-tested in lib/universe.test.ts.
//
// The sky is a deterministic 100×100 virtual space (percent units, so it
// scales with any container). Every position derives from the planet list
// itself or a stable hash, so SSR, CSR, and reloads render the identical sky.

/** Deterministic 32-bit hash (FNV-1a) — the seed for everything in the sky. */
export function hashKey(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Round to 3 decimals — keeps SSR and client float math byte-identical
    (Math.sin/cos/log10 differ by 1 ULP across Node and Chrome builds). */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export interface UniversePlanet {
  key: string
  category: string
  stars: number
}

export interface VortexPosition {
  x: number // 0..100
  y: number // 0..100
}

const GOLDEN_ANGLE = 2.39996322972865332 // radians
const SKY_RADIUS = 40 // max distance from center, in 100-space (leaves room for hero-scale blob radii)

/**
 * The vortex: a phyllotaxis (golden-angle) spiral, biggest planet dead
 * center, everything else spiraling outward in descending size order. The
 * circle is a size ranking made physical — center = winning, edge = barely
 * made it. Deterministic; no physics, no collision passes needed at these
 * blob sizes.
 */
export function vortexLayout(planets: UniversePlanet[]): Map<string, VortexPosition> {
  const sorted = planets.slice().sort((a, b) => b.stars - a.stars)
  const n = sorted.length
  const positions = new Map<string, VortexPosition>()
  sorted.forEach((p, i) => {
    const r = SKY_RADIUS * Math.sqrt(i / Math.max(1, n))
    const theta = i * GOLDEN_ANGLE
    positions.set(p.key, {
      x: round3(Math.min(96, Math.max(4, 50 + r * Math.cos(theta)))),
      y: round3(Math.min(94, Math.max(6, 50 + r * Math.sin(theta)))),
    })
  })
  return positions
}

