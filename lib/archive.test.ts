// Unit tests for the daily archive helpers (lib/archive.ts)
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import {
  archiveDatePath,
  buildDayEntry,
  collectKeysetPages,
  emptyManifest,
  findMissingDates,
  idCursorAfter,
  isArchiveDate,
  mergeManifest,
  modelCursorAfter,
  modelCursorOrFilter,
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

describe('collectKeysetPages', () => {
  type Row = Record<string, unknown> & { id: string }
  const makeRows = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${String(i).padStart(5, '0')}` }))

  // A page source over an id-ordered array, honoring the cursor exactly the
  // way the export's `id > cursor ORDER BY id LIMIT n` queries do.
  function source(rows: Row[], pageSize: number, calls: (string | null)[]) {
    return async (cursor: string | null): Promise<Row[]> => {
      calls.push(cursor)
      const start = cursor === null ? 0 : rows.findIndex((r) => r.id > cursor)
      return rows.slice(start === -1 ? rows.length : start, (start === -1 ? rows.length : start) + pageSize)
    }
  }

  it('collects every row in order across page boundaries', async () => {
    const rows = makeRows(2500)
    const calls: (string | null)[] = []
    const out = await collectKeysetPages(1000, source(rows, 1000, calls), (page) => idCursorAfter(page))
    expect(out).toEqual(rows)
    expect(calls).toEqual([null, 'id-00999', 'id-01999'])
  })

  it('terminates on an exact page-size multiple with one extra empty fetch', async () => {
    const rows = makeRows(2000)
    const calls: (string | null)[] = []
    const out = await collectKeysetPages(1000, source(rows, 1000, calls), (page) => idCursorAfter(page))
    expect(out).toEqual(rows)
    expect(calls).toEqual([null, 'id-00999', 'id-01999'])
  })

  it('returns an empty first page as zero rows after a single fetch', async () => {
    const calls: (string | null)[] = []
    const out = await collectKeysetPages(1000, source([], 1000, calls), (page) => idCursorAfter(page))
    expect(out).toEqual([])
    expect(calls).toEqual([null])
  })

  it('throws instead of looping forever when the source ignores the cursor', async () => {
    const rows = makeRows(1000)
    const ignoringSource = async (): Promise<Row[]> => rows
    await expect(
      collectKeysetPages(1000, ignoringSource, (page) => idCursorAfter(page)),
    ).rejects.toThrow(/cursor failed to advance/)
  })

  it('rejects a non-positive page size', async () => {
    await expect(
      collectKeysetPages(0, async () => [], (page) => idCursorAfter(page)),
    ).rejects.toThrow(/pageSize/)
  })
})

describe('keyset cursor helpers', () => {
  it('idCursorAfter takes the last row id', () => {
    expect(idCursorAfter([{ id: 'a' }, { id: 'b' }])).toBe('b')
  })

  it('modelCursorAfter takes the last row (snapshot_date, model_key)', () => {
    const cursor = modelCursorAfter([
      { snapshot_date: '2026-11-05', model_key: 'llama' },
      { snapshot_date: '2026-11-06', model_key: 'qwen' },
    ])
    expect(cursor).toEqual({ snapshotDate: '2026-11-06', modelKey: 'qwen' })
  })

  it('modelCursorOrFilter renders a strict (date, key) successor filter', () => {
    expect(modelCursorOrFilter({ snapshotDate: '2026-11-06', modelKey: 'qwen' })).toBe(
      'snapshot_date.gt.2026-11-06,and(snapshot_date.eq.2026-11-06,model_key.gt."qwen")',
    )
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
