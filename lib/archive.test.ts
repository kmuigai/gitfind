// Unit tests for the daily archive helpers (lib/archive.ts)
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import {
  archiveDatePath,
  buildDayEntry,
  emptyManifest,
  findMissingDates,
  isArchiveDate,
  mergeManifest,
  parseManifest,
  serializeJsonl,
  sha256Hex,
  stableStringify,
  type ArchiveManifest,
} from './archive'

const NOW = '2026-11-06T12:00:00.000Z'

describe('archiveDatePath', () => {
  it('maps a date to its archive folder', () => {
    expect(archiveDatePath('2026-11-06')).toBe('archive/2026/11/06')
    expect(archiveDatePath('2027-01-31')).toBe('archive/2027/01/31')
  })

  it('rejects malformed and impossible dates', () => {
    expect(() => archiveDatePath('2026-11-6')).toThrow()
    expect(() => archiveDatePath('11/06/2026')).toThrow()
    expect(() => archiveDatePath('2026-02-30')).toThrow()
    expect(() => archiveDatePath('')).toThrow()
  })
})

describe('isArchiveDate', () => {
  it('accepts real dates only', () => {
    expect(isArchiveDate('2026-11-06')).toBe(true)
    expect(isArchiveDate('2026-02-29')).toBe(false) // 2026 is not a leap year
    expect(isArchiveDate('2024-02-29')).toBe(true)
    expect(isArchiveDate('yesterday')).toBe(false)
  })
})

describe('stableStringify / serializeJsonl / sha256Hex', () => {
  it('serializes the same row identically regardless of key order', () => {
    const a = serializeJsonl([{ id: 'x', score: 9, meta: { b: 2, a: 1 } }])
    const b = serializeJsonl([{ meta: { a: 1, b: 2 }, score: 9, id: 'x' }])
    expect(a).toBe(b)
    expect(sha256Hex(a)).toBe(sha256Hex(b))
  })

  it('produces one line per row with a trailing newline', () => {
    const out = serializeJsonl([{ id: 1 }, { id: 2 }])
    expect(out).toBe('{"id":1}\n{"id":2}\n')
  })

  it('serializes zero rows to an empty file', () => {
    expect(serializeJsonl([])).toBe('')
  })

  it('drops undefined values like JSON.stringify does', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it('matches the known sha256 of the empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})

describe('manifest building and merging', () => {
  const dayOne = buildDayEntry(
    '2026-11-05',
    [{ name: 'repos', content: '{"id":"a"}\n', rows: 1 }],
    '2026-11-05T12:00:00.000Z',
  )

  it('records rows, checksum, and the dated path per dataset', () => {
    expect(dayOne.datasets.repos.rows).toBe(1)
    expect(dayOne.datasets.repos.path).toBe('archive/2026/11/05/repos.jsonl')
    expect(dayOne.datasets.repos.sha256).toBe(sha256Hex('{"id":"a"}\n'))
  })

  it('merging a day leaves every other day untouched', () => {
    const start = mergeManifest(emptyManifest(NOW), '2026-11-05', dayOne, NOW)
    const dayTwo = buildDayEntry(
      '2026-11-06',
      [{ name: 'repos', content: '{"id":"b"}\n', rows: 1 }],
      NOW,
    )
    const merged = mergeManifest(start, '2026-11-06', dayTwo, NOW)
    expect(Object.keys(merged.days).sort()).toEqual(['2026-11-05', '2026-11-06'])
    expect(merged.days['2026-11-05']).toEqual(dayOne)
  })

  it('re-running a date replaces only that date', () => {
    const start = mergeManifest(emptyManifest(NOW), '2026-11-05', dayOne, NOW)
    const rerun = buildDayEntry(
      '2026-11-05',
      [{ name: 'repos', content: '{"id":"a2"}\n{"id":"a3"}\n', rows: 2 }],
      '2026-11-05T18:00:00.000Z',
    )
    const merged = mergeManifest(start, '2026-11-05', rerun, NOW)
    expect(Object.keys(merged.days)).toEqual(['2026-11-05'])
    expect(merged.days['2026-11-05'].datasets.repos.rows).toBe(2)
  })

  it('does not mutate the manifest it was given', () => {
    const start = emptyManifest(NOW)
    mergeManifest(start, '2026-11-05', dayOne, NOW)
    expect(start.days).toEqual({})
  })
})

describe('parseManifest', () => {
  it('treats an empty file as a fresh manifest', () => {
    expect(parseManifest('', NOW)).toEqual(emptyManifest(NOW))
    expect(parseManifest('   \n', NOW)).toEqual(emptyManifest(NOW))
  })

  it('round-trips a serialized manifest', () => {
    const manifest = mergeManifest(
      emptyManifest(NOW),
      '2026-11-05',
      buildDayEntry('2026-11-05', [{ name: 'repos', content: 'x\n', rows: 1 }], NOW),
      NOW,
    )
    expect(parseManifest(JSON.stringify(manifest), NOW)).toEqual(manifest)
  })

  it('throws on a corrupt manifest instead of silently resetting history', () => {
    expect(() => parseManifest('{"nope": true}', NOW)).toThrow()
  })
})

describe('findMissingDates', () => {
  function manifestWith(dates: string[]): ArchiveManifest {
    const days: ArchiveManifest['days'] = {}
    for (const date of dates) {
      days[date] = { captured_at: NOW, datasets: {} }
    }
    return { version: 1, updated_at: NOW, days }
  }

  it('finds nothing when the archive is empty or has a single day', () => {
    expect(findMissingDates(manifestWith([]))).toEqual([])
    expect(findMissingDates(manifestWith(['2026-11-06']))).toEqual([])
  })

  it('finds nothing for consecutive days', () => {
    expect(findMissingDates(manifestWith(['2026-11-04', '2026-11-05', '2026-11-06']))).toEqual([])
  })

  it('names every skipped day inside the recorded range', () => {
    expect(findMissingDates(manifestWith(['2026-11-01', '2026-11-04']))).toEqual([
      '2026-11-02',
      '2026-11-03',
    ])
  })

  it('crosses month and year boundaries correctly', () => {
    expect(findMissingDates(manifestWith(['2026-12-31', '2027-01-02']))).toEqual(['2027-01-01'])
  })

  it('ignores malformed day keys instead of crashing', () => {
    const manifest = manifestWith(['2026-11-01', '2026-11-02'])
    manifest.days['not-a-date'] = { captured_at: NOW, datasets: {} }
    expect(findMissingDates(manifest)).toEqual([])
  })
})
