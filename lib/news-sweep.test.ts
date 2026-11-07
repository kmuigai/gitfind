// Unit tests for the shared news sweep engine (lib/news-sweep.ts)
// Run with: npm test (Vitest)
//
// fetch is stubbed and the classifier is injected, so these tests pin the
// engine's plumbing — fetch → nominate → classify → validate → dedupe —
// without network or an API key. The pure logic itself is covered by
// news-outcomes.test.ts.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { rejectionLogLine, sweepRepo } from './news-sweep'
import type { LlmOutcomeProposal, NewsCandidate } from './news-outcomes'

const NOW = new Date('2026-11-06T12:00:00Z')

const REPO: NewsCandidate = {
  id: 'repo-1',
  owner: 'acme',
  name: 'widgetkit',
  url: 'https://github.com/acme/widgetkit',
  description: 'A toolkit for widgets',
}

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item>
  <title>WidgetKit raises $5M seed round</title>
  <link>https://news.google.com/rss/articles/example</link>
  <pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate>
  <description>WidgetKit, the widget toolkit from Acme, raises $5M in seed funding led by Example Capital.</description>
  <source url="https://techcrunch.com">TechCrunch</source>
</item>
</channel></rss>`

const EMPTY_RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>`

function stubFetch(rss: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      text: async () => (url.includes('hn.algolia.com') ? '{"hits":[]}' : rss),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function proposal(partial: Partial<LlmOutcomeProposal> = {}): LlmOutcomeProposal {
  return {
    event_type: 'funding',
    event_date: '2026-10-19',
    evidence_quote: 'WidgetKit, the widget toolkit from Acme, raises $5M in seed funding',
    details: 'Raised $5M seed led by Example Capital.',
    primary_source: false,
    source_url: 'https://news.google.com/rss/articles/example',
    ...partial,
  }
}

describe('sweepRepo', () => {
  it('returns validated outcomes for a repo with nominated candidates', async () => {
    stubFetch(RSS)
    const classify = vi.fn(async () => [proposal()])
    const existingKeys = new Set<string>()

    const result = await sweepRepo(REPO, { sinceDays: 365, now: NOW, classify, existingKeys })

    expect(result.hadCandidates).toBe(true)
    expect(result.rejectedCount).toBe(0)
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0]).toMatchObject({ event_type: 'funding', event_date: '2026-10-19', detected_by: 'news-sweep' })
    expect(existingKeys.size).toBe(1)
  })

  it('dedupes against keys already on record', async () => {
    stubFetch(RSS)
    const classify = vi.fn(async () => [proposal()])
    const existingKeys = new Set<string>()
    const options = { sinceDays: 365, now: NOW, classify, existingKeys }

    const first = await sweepRepo(REPO, options)
    const second = await sweepRepo(REPO, options)

    expect(first.accepted).toHaveLength(1)
    expect(second.accepted).toHaveLength(0)
  })

  it('skips the classifier entirely when nothing is nominated', async () => {
    stubFetch(EMPTY_RSS)
    const classify = vi.fn(async () => [proposal()])

    const result = await sweepRepo(REPO, { sinceDays: 365, now: NOW, classify, existingKeys: new Set() })

    expect(result).toEqual({ accepted: [], rejected: [], rejectedCount: 0, hadCandidates: false })
    expect(classify).not.toHaveBeenCalled()
  })

  it('returns each rejection with its repo, proposed type, and specific reason', async () => {
    stubFetch(RSS)
    const classify = vi.fn(async () => [proposal({ evidence_quote: 'a quote that appears nowhere in the item' })])

    const result = await sweepRepo(REPO, { sinceDays: 365, now: NOW, classify, existingKeys: new Set() })

    expect(result.hadCandidates).toBe(true)
    expect(result.accepted).toHaveLength(0)
    expect(result.rejectedCount).toBe(1)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]).toMatchObject({
      repoId: 'repo-1',
      label: 'acme/widgetkit',
      reason: 'evidence quote not found verbatim in the fetched item',
    })
    expect(result.rejected[0].proposal.event_type).toBe('funding')
    // The audit line both sweep drivers log, verbatim:
    expect(rejectionLogLine(result.rejected[0])).toBe(
      'acme/widgetkit → funding rejected: evidence quote not found verbatim in the fetched item',
    )
  })

  it("names the gate when a proposal uses the 'dead' class the sweep may never write", async () => {
    stubFetch(RSS)
    const classify = vi.fn(async () => [proposal({ event_type: 'dead' })])

    const result = await sweepRepo(REPO, { sinceDays: 365, now: NOW, classify, existingKeys: new Set() })

    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe("event_type 'dead' is not a news-sweep class")
  })
})
