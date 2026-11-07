// Unit tests for the Outcomes Ledger Phase 2 news detection (lib/news-outcomes.ts)
// Run with: npm test (Vitest)

import { describe, it, expect } from 'vitest'
import {
  NEWS_EVENT_TYPES,
  buildGoogleNewsQueries,
  buildClassificationPrompt,
  googleNewsRssUrl,
  hnHitsToNewsItems,
  hnSearchUrl,
  nominatedEventTypes,
  outcomeDedupeKey,
  parseGoogleNewsRss,
  validateProposals,
  type LlmOutcomeProposal,
  type NewsCandidate,
  type NewsItem,
} from './news-outcomes'

const NOW = new Date('2026-11-06T12:00:00Z')

const REPO: NewsCandidate = {
  id: 'repo-1',
  owner: 'acme',
  name: 'widgetkit',
  url: 'https://github.com/acme/widgetkit',
  description: 'A toolkit for widgets',
}

function item(partial: Partial<NewsItem> = {}): NewsItem {
  return {
    title: 'WidgetKit raises $5M seed round',
    url: 'https://news.google.com/rss/articles/example',
    publishedDate: '2026-10-20',
    sourceName: 'TechCrunch',
    snippet: 'WidgetKit, the widget toolkit from Acme, raises $5M in seed funding led by Example Capital.',
    origin: 'google-news',
    ...partial,
  }
}

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

describe('taxonomy', () => {
  it('news classes are the full taxonomy minus dead', () => {
    expect(NEWS_EVENT_TYPES).toHaveLength(7)
    expect(NEWS_EVENT_TYPES).not.toContain('dead')
    expect(NEWS_EVENT_TYPES).toContain('funding')
    expect(NEWS_EVENT_TYPES).toContain('maintainer_move')
  })
})

describe('query builders', () => {
  it('builds an exact-path query and a name + event-terms query', () => {
    const queries = buildGoogleNewsQueries(REPO)
    expect(queries[0]).toBe('"acme/widgetkit"')
    expect(queries[1]).toContain('"widgetkit"')
    expect(queries[1]).toContain('funding')
  })

  it('encodes the RSS URL', () => {
    expect(googleNewsRssUrl('"acme/widgetkit"')).toContain('q=%22acme%2Fwidgetkit%22')
  })

  it('HN URL is a story search fenced by date', () => {
    const url = hnSearchUrl(REPO, 1735689600)
    expect(url).toContain('tags=story')
    expect(url).toContain('created_at_i%3E1735689600')
  })
})

describe('parseGoogleNewsRss', () => {
  const FEED = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <item>
      <title>WidgetKit raises $5M seed round - TechCrunch</title>
      <link>https://news.google.com/rss/articles/example</link>
      <pubDate>Tue, 20 Oct 2026 09:30:00 GMT</pubDate>
      <description>&lt;a href="https://news.google.com/rss/articles/example"&gt;WidgetKit raises $5M&lt;/a&gt; &amp; more</description>
      <source url="https://techcrunch.com">TechCrunch</source>
    </item>
    <item>
      <title>Broken item with no date</title>
      <link>https://news.google.com/rss/articles/broken</link>
    </item>
  </channel></rss>`

  it('parses items with title, link, date, source, and a stripped snippet', () => {
    const items = parseGoogleNewsRss(FEED)
    expect(items).toHaveLength(1)
    expect(items[0].title).toContain('WidgetKit raises $5M')
    expect(items[0].url).toBe('https://news.google.com/rss/articles/example')
    expect(items[0].publishedDate).toBe('2026-10-20')
    expect(items[0].sourceName).toBe('TechCrunch')
    expect(items[0].snippet).not.toContain('<a')
    expect(items[0].origin).toBe('google-news')
  })

  it('decodes entities in titles', () => {
    const feed = FEED.replace('WidgetKit raises $5M seed round', 'Tom &amp; Jerry&#39;s toolkit')
    expect(parseGoogleNewsRss(feed)[0].title).toContain("Tom & Jerry's toolkit")
  })

  it('malformed input yields no items instead of throwing', () => {
    expect(parseGoogleNewsRss('not xml at all')).toEqual([])
    expect(parseGoogleNewsRss('')).toEqual([])
  })
})

describe('hnHitsToNewsItems', () => {
  it('shapes hits, linking self-posts to the HN item page', () => {
    const items = hnHitsToNewsItems([
      { objectID: '123', title: 'Show HN: WidgetKit 1.0', url: null, created_at: '2026-09-01T10:00:00.000Z' },
      { objectID: '124', title: null, url: 'https://example.com', created_at: '2026-09-01T10:00:00.000Z' },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe('https://news.ycombinator.com/item?id=123')
    expect(items[0].publishedDate).toBe('2026-09-01')
    expect(items[0].origin).toBe('hn')
  })
})

describe('nominatedEventTypes', () => {
  it('nominates funding for a raise headline', () => {
    expect(nominatedEventTypes(item())).toContain('funding')
  })

  it('nominates shutdown and never confuses it with a launch', () => {
    const types = nominatedEventTypes(item({ title: 'Acme shuts down WidgetKit hosted service', snippet: 'The hosted service will sunset in March.' }))
    expect(types).toContain('shutdown')
  })

  it('nominates acquired, pivot, and maintainer_move from their vocabulary', () => {
    expect(nominatedEventTypes(item({ title: 'BigCo acquires WidgetKit', snippet: '' }))).toContain('acquired')
    expect(nominatedEventTypes(item({ title: 'WidgetKit pivots to enterprise', snippet: '' }))).toContain('pivot')
    expect(nominatedEventTypes(item({ title: 'WidgetKit creator joins Example Labs', snippet: '' }))).toContain('maintainer_move')
  })

  it('a plain version-bump headline nominates breakout only via release vocabulary', () => {
    const types = nominatedEventTypes(item({ title: 'WidgetKit releases a patch', snippet: '' }))
    expect(types).toContain('breakout')
    expect(types).not.toContain('funding')
  })
})

describe('validateProposals', () => {
  it('accepts a grounded secondary report as likely, with the quote in details', () => {
    const { accepted, rejected } = validateProposals([proposal()], [item()], NOW)
    expect(rejected).toHaveLength(0)
    expect(accepted).toHaveLength(1)
    expect(accepted[0].event_type).toBe('funding')
    expect(accepted[0].event_date).toBe('2026-10-19')
    expect(accepted[0].confidence).toBe('likely')
    expect(accepted[0].detected_by).toBe('news-sweep')
    expect(accepted[0].details).toContain('Evidence: "WidgetKit, the widget toolkit from Acme')
    expect(accepted[0].details).toContain('TechCrunch, 2026-10-20')
  })

  it('a primary source with a verified quote is confirmed', () => {
    const { accepted } = validateProposals([proposal({ primary_source: true })], [item()], NOW)
    expect(accepted[0].confidence).toBe('confirmed')
  })

  it('falls back to the article date when the proposal gives none', () => {
    const { accepted } = validateProposals([proposal({ event_date: null })], [item()], NOW)
    expect(accepted[0].event_date).toBe('2026-10-20')
  })

  it('rejects dead — the news sweep never writes it', () => {
    const { accepted, rejected } = validateProposals([proposal({ event_type: 'dead' })], [item()], NOW)
    expect(accepted).toHaveLength(0)
    expect(rejected[0].reason).toContain('not a news-sweep class')
  })

  it('rejects a quote that is not in the fetched item (hallucination guard)', () => {
    const { accepted, rejected } = validateProposals(
      [proposal({ evidence_quote: 'WidgetKit raises $900M in a historic round' })],
      [item()],
      NOW,
    )
    expect(accepted).toHaveLength(0)
    expect(rejected[0].reason).toContain('not found verbatim')
  })

  it('quote matching survives case and whitespace differences', () => {
    const { accepted } = validateProposals(
      [proposal({ evidence_quote: 'widgetkit,   the widget toolkit from acme, raises $5m in seed funding' })],
      [item()],
      NOW,
    )
    expect(accepted).toHaveLength(1)
  })

  it('rejects a source URL that was never fetched', () => {
    const { rejected } = validateProposals([proposal({ source_url: 'https://invented.example/story' })], [item()], NOW)
    expect(rejected[0].reason).toContain('not one of the fetched items')
  })

  it('rejects future and malformed event dates', () => {
    expect(validateProposals([proposal({ event_date: '2027-01-01' })], [item()], NOW).rejected[0].reason).toContain('future')
    expect(validateProposals([proposal({ event_date: '19 Oct 2026' })], [item()], NOW).rejected[0].reason).toContain('not a valid ISO date')
    expect(validateProposals([proposal({ event_date: '2026-02-30' })], [item()], NOW).rejected[0].reason).toContain('not a valid ISO date')
  })

  it('rejects empty details and duplicates within a run', () => {
    expect(validateProposals([proposal({ details: '  ' })], [item()], NOW).rejected[0].reason).toContain('empty')
    const { accepted, rejected } = validateProposals([proposal(), proposal()], [item()], NOW)
    expect(accepted).toHaveLength(1)
    expect(rejected[0].reason).toContain('duplicate')
  })
})

describe('buildClassificationPrompt', () => {
  it('carries the taxonomy, the no-dead rule, and the items', () => {
    const prompt = buildClassificationPrompt(REPO, [item()])
    expect(prompt).toContain('maintainer_move')
    expect(prompt).toContain("Never use 'dead'")
    expect(prompt).toContain('acme/widgetkit')
    expect(prompt).toContain('WidgetKit raises $5M seed round')
    expect(prompt).toContain('verbatim')
  })
})

describe('outcomeDedupeKey', () => {
  it('is repo | type | date', () => {
    expect(outcomeDedupeKey('repo-1', 'funding', '2026-10-19')).toBe('repo-1|funding|2026-10-19')
  })
})
