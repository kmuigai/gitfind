import { describe, it, expect } from 'vitest'
import {
  buildRaceDates,
  buildBubbleFrames,
  logBounds,
  logScale,
  bubbleDiameter,
  logTicks,
  sparklineFor,
  type BubbleSnapshotRow,
} from './bubble'

describe('buildRaceDates', () => {
  it('steps back in 7-day increments, chronological, including latest', () => {
    expect(buildRaceDates('2026-07-26', 3)).toEqual(['2026-07-12', '2026-07-19', '2026-07-26'])
  })

  it('crosses month boundaries correctly', () => {
    expect(buildRaceDates('2026-03-03', 2)).toEqual(['2026-02-24', '2026-03-03'])
  })

  it('returns a single date for weeks=1', () => {
    expect(buildRaceDates('2026-07-26', 1)).toEqual(['2026-07-26'])
  })
})

const names = new Map([
  ['1', 'acme/rocket'],
  ['2', 'acme/anvil'],
])

describe('buildBubbleFrames', () => {
  const rows: BubbleSnapshotRow[] = [
    { repo_id: '1', snapshot_date: '2026-07-19', stars: 5000, forks: 400, stars_7d: 300 },
    { repo_id: '2', snapshot_date: '2026-07-19', stars: 20000, forks: 1500, stars_7d: 800 },
    { repo_id: '1', snapshot_date: '2026-07-26', stars: 5300, forks: 420, stars_7d: 250 },
  ]

  it('builds chronological frames ranked by stars_7d', () => {
    const frames = buildBubbleFrames(rows, ['2026-07-19', '2026-07-26'], names, 10)
    expect(frames).toHaveLength(2)
    expect(frames[0].entries[0].key).toBe('acme/anvil')
    expect(frames[0].entries[0]).toMatchObject({ forks: 1500, stars: 20000, stars7d: 800 })
  })

  it('caps at topN, skips non-positive and unhydrated rows', () => {
    const dirty: BubbleSnapshotRow[] = [
      ...rows,
      { repo_id: '9', snapshot_date: '2026-07-19', stars: 100, forks: 10, stars_7d: 9999 }, // no name
      { repo_id: '2', snapshot_date: '2026-07-26', stars: 0, forks: 10, stars_7d: 50 }, // zero stars
    ]
    const frames = buildBubbleFrames(dirty, ['2026-07-19', '2026-07-26'], names, 1)
    expect(frames[0].entries).toHaveLength(1)
    expect(frames[1].entries).toHaveLength(1)
  })

  it('clamps forks to at least 1 for the log scale', () => {
    const zeroForks: BubbleSnapshotRow[] = [
      { repo_id: '1', snapshot_date: '2026-07-19', stars: 100, forks: 0, stars_7d: 10 },
    ]
    const frames = buildBubbleFrames(zeroForks, ['2026-07-19'], names, 10)
    expect(frames[0].entries[0].forks).toBe(1)
  })
})

describe('sparklineFor', () => {
  it('aligns a repo’s gains to frame dates, null when absent', () => {
    const frames = buildBubbleFrames(
      [
        { repo_id: '1', snapshot_date: '2026-07-19', stars: 100, forks: 5, stars_7d: 40 },
        { repo_id: '2', snapshot_date: '2026-07-19', stars: 100, forks: 5, stars_7d: 90 },
        { repo_id: '2', snapshot_date: '2026-07-26', stars: 100, forks: 5, stars_7d: 70 },
      ],
      ['2026-07-19', '2026-07-26'],
      names,
      10,
    )
    expect(sparklineFor(frames, 'acme/rocket')).toEqual([40, null])
    expect(sparklineFor(frames, 'acme/anvil')).toEqual([90, 70])
    expect(sparklineFor(frames, 'ghost/repo')).toEqual([null, null])
  })
})

describe('logBounds', () => {
  it('pads to powers of 10', () => {
    expect(logBounds([37, 42000])).toEqual({ min: 10, max: 100000 })
  })
  it('handles empty and single-value input', () => {
    expect(logBounds([])).toEqual({ min: 1, max: 10 })
    expect(logBounds([100])).toEqual({ min: 100, max: 1000 })
  })
})

describe('logScale', () => {
  it('maps endpoints to 0 and 1, midpoint to 0.5', () => {
    expect(logScale(1, 1, 100)).toBe(0)
    expect(logScale(100, 1, 100)).toBe(1)
    expect(logScale(10, 1, 100)).toBe(0.5)
  })
  it('clamps out-of-range values and guards degenerate domains', () => {
    expect(logScale(99999, 1, 100)).toBe(1)
    expect(logScale(0, 1, 100)).toBe(0)
    expect(logScale(5, 10, 10)).toBe(0.5)
  })
})

describe('bubbleDiameter', () => {
  it('scales area with value (diameter with sqrt)', () => {
    expect(bubbleDiameter(100, 100)).toBe(44)
    expect(bubbleDiameter(25, 100)).toBe(22)
  })
  it('clamps to the floor and guards zero max', () => {
    expect(bubbleDiameter(1, 100000)).toBe(10)
    expect(bubbleDiameter(5, 0)).toBe(10)
  })
})

describe('logTicks', () => {
  it('returns each power of 10 in the domain', () => {
    expect(logTicks(10, 10000)).toEqual([10, 100, 1000, 10000])
  })
})
