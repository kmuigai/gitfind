// Shared formatting + scoring helpers for the 1-bit design system.

export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}M`
  }
  if (n >= 1000) {
    const v = n / 1000
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}k`
  }
  return n.toLocaleString('en-US')
}

export function contributorsLabel(n: number): string {
  return n === 0 ? 'Solo' : formatCount(n)
}

export function pctLabel(pct: number): string {
  if (pct > 0) return `+${pct}%`
  if (pct < 0) return `-${Math.abs(pct)}%`
  return '0%'
}

export type Tier = 'Breakout' | 'Hot' | 'Active'

export function tierFor(score: number): Tier {
  return score >= 70 ? 'Breakout' : score >= 40 ? 'Hot' : 'Active'
}

export function tierExplainer(tier: Tier): string {
  switch (tier) {
    case 'Breakout':
      return 'Strong early signal — breaking out'
    case 'Hot':
      return 'Gaining traction — heating up'
    case 'Active':
      return 'On the radar — early signal detected'
  }
}

/** Truncate at a word boundary (never mid-word) with an ellipsis. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.lastIndexOf(' ', max)
  if (cut <= 0) return text.slice(0, max) + '\u2026'
  return text.slice(0, cut).replace(/[,;:.\-\u2014]+$/, '') + '\u2026'
}

export const SCORE_EXPLAINER =
  'Early Signal Score (0–100) blends star growth, active builders, community buzz, and commit pace. 70+ Breakout · 40–69 Hot · under 40 Active.'

/** Retro block gauge, e.g. score 53 -> "█████░░░░░" */
export function gauge(score: number, cells = 10): string {
  const filled = Math.round((score / 100) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

// Canonical enrichment-category → route slug map. The formulaic fallback
// produces "ai-machine-learning" for "AI / Machine Learning" — a 404, since
// the category route lives at /category/ai-ml. Map all 8 canonical names.
const CATEGORY_SLUG_MAP: Record<string, string> = {
  'AI / Machine Learning': 'ai-ml',
  'Developer Tools': 'developer-tools',
  Security: 'security',
  'Data & Analytics': 'data-analytics',
  'Web Frameworks': 'web-frameworks',
  'Infrastructure & DevOps': 'infrastructure-devops',
  Mobile: 'mobile',
  'Open Source Utilities': 'open-source-utilities',
}

export function categorySlug(category: string): string {
  return CATEGORY_SLUG_MAP[category] ?? category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
