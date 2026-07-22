// Unit tests for the design-system helpers every number on the site flows through.
import { describe, it, expect } from 'vitest'
import {
  formatCount,
  contributorsLabel,
  pctLabel,
  tierFor,
  tierExplainer,
  gauge,
  categorySlug,
  SCORE_EXPLAINER,
} from './design'

describe('formatCount', () => {
  it('passes through small numbers with locale grouping', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(266)).toBe('266')
  })
  it('formats thousands with one decimal', () => {
    expect(formatCount(1955)).toBe('2.0k')
    expect(formatCount(48380)).toBe('48.4k')
  })
  it('rounds large thousands to whole k', () => {
    expect(formatCount(176434)).toBe('176k')
  })
  it('formats millions', () => {
    expect(formatCount(1_955_000)).toBe('2.0M')
    expect(formatCount(19_527_000)).toBe('19.5M')
  })
})

describe('contributorsLabel', () => {
  it('renders 0 as Solo, never a bare 0', () => {
    expect(contributorsLabel(0)).toBe('Solo')
    expect(contributorsLabel(87)).toBe('87')
  })
})

describe('pctLabel', () => {
  it('always carries a sign and never loses the timeframe sign', () => {
    expect(pctLabel(508)).toBe('+508%')
    expect(pctLabel(-18)).toBe('-18%')
    expect(pctLabel(0)).toBe('0%')
  })
})

describe('tierFor + tierExplainer', () => {
  it('maps boundaries correctly', () => {
    expect(tierFor(0)).toBe('Active')
    expect(tierFor(39)).toBe('Active')
    expect(tierFor(40)).toBe('Hot')
    expect(tierFor(69)).toBe('Hot')
    expect(tierFor(70)).toBe('Breakout')
    expect(tierFor(100)).toBe('Breakout')
  })
  it('every tier has a human explainer', () => {
    for (const tier of ['Active', 'Hot', 'Breakout'] as const) {
      expect(tierExplainer(tier).length).toBeGreaterThan(10)
    }
  })
})

describe('gauge', () => {
  it('renders full, empty, and rounded fills', () => {
    expect(gauge(0)).toBe('░░░░░░░░░░')
    expect(gauge(100)).toBe('██████████')
    expect(gauge(53)).toBe('█████░░░░░')
    expect(gauge(100, 20)).toBe('█'.repeat(20))
  })
})

describe('categorySlug', () => {
  it('maps all 8 canonical categories to real route slugs', () => {
    expect(categorySlug('AI / Machine Learning')).toBe('ai-ml')
    expect(categorySlug('Developer Tools')).toBe('developer-tools')
    expect(categorySlug('Security')).toBe('security')
    expect(categorySlug('Data & Analytics')).toBe('data-analytics')
    expect(categorySlug('Web Frameworks')).toBe('web-frameworks')
    expect(categorySlug('Infrastructure & DevOps')).toBe('infrastructure-devops')
    expect(categorySlug('Mobile')).toBe('mobile')
    expect(categorySlug('Open Source Utilities')).toBe('open-source-utilities')
  })
  it('falls back to the formula for unknown categories', () => {
    expect(categorySlug('Something New')).toBe('something-new')
  })
})

describe('SCORE_EXPLAINER', () => {
  it('states the scale and all tiers in one line', () => {
    expect(SCORE_EXPLAINER).toContain('0–100')
    expect(SCORE_EXPLAINER).toContain('70+')
    expect(SCORE_EXPLAINER).toContain('40–69')
  })
})
