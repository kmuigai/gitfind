// Frame-building + scale math for the bubble race — the Gapminder-style
// animated scatter. Pure functions — unit-tested in lib/bubble.test.ts.
//
// One frame per week, same cadence as The Race (lib/race.ts). Each bubble is
// a repo: x = forks, y = stars gained that week, size = total stars.
// Scales are computed across ALL frames so axes stay fixed while bubbles move.

export interface BubbleEntry {
  key: string // stable repo key: "owner/name"
  label: string
  forks: number // x position
  stars: number // bubble size
  stars7d: number // y position
}

export interface BubbleFrame {
  date: string
  entries: BubbleEntry[]
}

export interface BubbleSnapshotRow {
  repo_id: string
  snapshot_date: string
  stars: number
  forks: number
  stars_7d: number
}

/**
 * Weekly snapshot dates stepping back from `latest` in 7-day increments,
 * chronological (oldest first). `weeks` includes the latest week.
 */
export function buildRaceDates(latest: string, weeks: number): string[] {
  const dates: string[] = []
  const d = new Date(`${latest}T00:00:00Z`)
  for (let i = weeks - 1; i >= 0; i--) {
    const back = new Date(d)
    back.setUTCDate(d.getUTCDate() - i * 7)
    dates.push(back.toISOString().slice(0, 10))
  }
  return dates
}

/**
 * Rank raw snapshot rows into one bubble frame per requested date,
 * ranked by stars_7d (the drama axis), top N per frame.
 */
export function buildBubbleFrames(
  rows: BubbleSnapshotRow[],
  dates: string[],
  names: Map<string, string>,
  topN: number,
): BubbleFrame[] {
  const byDate = new Map<string, BubbleSnapshotRow[]>()
  for (const row of rows) {
    if (row.stars_7d <= 0 || row.stars <= 0) continue
    const list = byDate.get(row.snapshot_date)
    if (list) list.push(row)
    else byDate.set(row.snapshot_date, [row])
  }

  const frames: BubbleFrame[] = []
  for (const date of dates) {
    const list = byDate.get(date)
    if (!list || list.length === 0) continue
    const ranked = list
      .filter((row) => names.has(row.repo_id))
      .sort((a, b) => b.stars_7d - a.stars_7d)
      .slice(0, topN)
      .map((row) => ({
        key: names.get(row.repo_id)!,
        label: names.get(row.repo_id)!,
        forks: Math.max(row.forks, 1),
        stars: row.stars,
        stars7d: row.stars_7d,
      }))
    if (ranked.length > 0) frames.push({ date, entries: ranked })
  }
  return frames
}

/** Nice round [min, max] bounds on a log10 scale, padded to powers of 10. */
export function logBounds(values: number[]): { min: number; max: number } {
  const positives = values.filter((v) => v > 0)
  if (positives.length === 0) return { min: 1, max: 10 }
  const lo = Math.floor(Math.log10(Math.min(...positives)))
  const hi = Math.ceil(Math.log10(Math.max(...positives)))
  return { min: Math.pow(10, lo), max: Math.pow(10, Math.max(hi, lo + 1)) }
}

/** Position of v within [min, max] on a log10 scale, as 0..1 (clamped). */
export function logScale(v: number, min: number, max: number): number {
  const lo = Math.log10(min)
  const hi = Math.log10(max)
  if (hi <= lo) return 0.5
  const t = (Math.log10(Math.max(v, min)) - lo) / (hi - lo)
  return Math.min(1, Math.max(0, t))
}

/** Bubble diameter in px — area scales with value, clamped to [minD, maxD]. */
export function bubbleDiameter(value: number, maxValue: number, minD = 10, maxD = 44): number {
  if (maxValue <= 0) return minD
  const d = maxD * Math.sqrt(value / maxValue)
  return Math.min(maxD, Math.max(minD, d))
}

/** A repo's enrichment profile — week-independent, shown on the sports card. */
export interface BubbleProfile {
  score: number
  summary: string
  whyItMatters: string
  category: string
  url: string // canonical GitHub url
}

/**
 * One repo's weekly gains aligned to the frame dates — null for weeks the
 * repo didn't make the top N. Drives the sports card sparkline.
 */
export function sparklineFor(frames: BubbleFrame[], key: string): (number | null)[] {
  return frames.map((f) => f.entries.find((e) => e.key === key)?.stars7d ?? null)
}

/** Tick values (powers of 10) for a log-scaled axis, for gridlines + labels. */
export function logTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  for (let p = Math.round(Math.log10(min)); p <= Math.round(Math.log10(max)); p++) {
    ticks.push(Math.pow(10, p))
  }
  return ticks
}
