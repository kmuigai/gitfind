import { describe, it, expect } from 'vitest'
import { sliceRange, rangeTotal, priorSpanDelta, labelEvery, type VolumePoint } from './volume'

function series(days: number, startValue = 100): VolumePoint[] {
  const end = new Date(Date.UTC(2026, 6, 18)) // Jul 18 2026
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - (days - 1 - i))
    return { date: d.toISOString().slice(0, 10), value: startValue + i }
  })
}

describe('sliceRange', () => {
  const data = series(400)

  it('7d returns exactly 7 complete days ending at the last point', () => {
    const out = sliceRange(data, '7d')
    expect(out.length).toBe(7)
    expect(out[out.length - 1].date).toBe('2026-07-18')
    expect(out[0].date).toBe('2026-07-12')
  })

  it('1m returns 30 days, 6m ~182, 1y ~365', () => {
    expect(sliceRange(data, '1m').length).toBe(30)
    expect(sliceRange(data, '6m').length).toBe(182)
    expect(sliceRange(data, '1y').length).toBe(365)
  })

  it('ytd starts on jan 1 of the end year', () => {
    const out = sliceRange(data, 'ytd')
    expect(out[0].date).toBe('2026-01-01')
    expect(out.length).toBe(199)
  })

  it('all returns everything and short series never over-slice', () => {
    expect(sliceRange(data, 'all').length).toBe(400)
    expect(sliceRange(series(5), '1y').length).toBe(5)
  })
})

describe('rangeTotal', () => {
  it('sums every point in the range', () => {
    const pts = sliceRange(series(10, 0), '7d')
    expect(rangeTotal(pts)).toBe(3 + 4 + 5 + 6 + 7 + 8 + 9)
  })
})

describe('priorSpanDelta', () => {
  it('compares against the immediately preceding equal-length span', () => {
    const data = series(60, 0) // 0..59
    const pts = sliceRange(data, '1m') // values 30..59 (sum 1335) vs prior 0..29 (sum 435)
    expect(priorSpanDelta(data, pts)).toBe(Math.round(((1335 - 435) / 435) * 100))
  })

  it('returns null when there is no full prior span', () => {
    const data = series(20)
    expect(priorSpanDelta(data, sliceRange(data, '1m'))).toBeNull()
  })
})

describe('labelEvery', () => {
  it('keeps ~8 labels for any length, minimum 1', () => {
    expect(labelEvery(7)).toBe(1)
    expect(labelEvery(30)).toBe(3)
    expect(labelEvery(520)).toBe(65)
  })
})
