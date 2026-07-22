// Range math for the AI Code Index volume chart.
// Pure functions — unit-tested in lib/volume.test.ts.

export interface VolumePoint {
  date: string // YYYY-MM-DD, ascending, complete days only (query excludes today)
  value: number
}

export const RANGE_KEYS = ['7d', '1m', '6m', 'ytd', '1y', 'all'] as const
export type RangeKey = (typeof RANGE_KEYS)[number]

export const RANGE_LABELS: Record<RangeKey, string> = {
  '7d': 'last 7 days',
  '1m': 'last 30 days',
  '6m': 'last 6 months',
  ytd: 'year to date',
  '1y': 'last 12 months',
  all: 'all time',
}

function daysAgoIso(end: string, n: number): string {
  const d = new Date(`${end}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n + 1)
  return d.toISOString().slice(0, 10)
}

/** Slice a daily series to the requested range (inclusive of both ends). */
export function sliceRange(data: VolumePoint[], key: RangeKey): VolumePoint[] {
  if (data.length === 0) return data
  const end = data[data.length - 1].date
  switch (key) {
    case '7d':
      return data.filter((p) => p.date >= daysAgoIso(end, 7))
    case '1m':
      return data.filter((p) => p.date >= daysAgoIso(end, 30))
    case '6m':
      return data.filter((p) => p.date >= daysAgoIso(end, 182))
    case 'ytd':
      return data.filter((p) => p.date >= `${end.slice(0, 4)}-01-01`)
    case '1y':
      return data.filter((p) => p.date >= daysAgoIso(end, 365))
    case 'all':
      return data
  }
}

/** Combined commits across the given points. */
export function rangeTotal(points: VolumePoint[]): number {
  return points.reduce((s, p) => s + p.value, 0)
}

/**
 * Like-for-like comparison: total of the span immediately preceding `points`
 * (same number of days), or null when there isn't a full prior span.
 */
export function priorSpanDelta(data: VolumePoint[], points: VolumePoint[]): number | null {
  const n = points.length
  if (data.length < n * 2) return null
  const prior = data.slice(data.length - n * 2, data.length - n)
  const priorTotal = rangeTotal(prior)
  if (priorTotal === 0) return null
  return Math.round(((rangeTotal(points) - priorTotal) / priorTotal) * 100)
}

/** X-axis label cadence so ~8 labels fit any series length. */
export function labelEvery(count: number): number {
  return Math.max(1, Math.floor(count / 8))
}
