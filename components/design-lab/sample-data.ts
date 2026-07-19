// Hardcoded sample data for the /design-lab mock-ups.
// Values are adapted from real GitFind digests — no Supabase, no fetching.

export interface SampleRepo {
  owner: string
  name: string
  language: string | null
  stars: number
  forks: number
  contributors: number // 0 renders as "Solo"
  downloads7d: number | null // null renders as "—"
  category: string
  categorySlug: string
  score: number
  summary: string
  whyItMatters: string
  stars7d: number
  pct7d: number // week-over-week change in weekly star gains
  url: string
}

export const repos: SampleRepo[] = [
  {
    owner: 'obra',
    name: 'superpowers',
    language: 'TypeScript',
    stars: 45200,
    forks: 1100,
    contributors: 87,
    downloads7d: null,
    category: 'Developer Tools',
    categorySlug: 'developer-tools',
    score: 53,
    summary:
      'A behavioral layer on top of AI coding tools like Claude and Cursor that forces them to clarify requirements and get sign-off on a plan before writing a single line of code.',
    whyItMatters:
      'AI agents going rogue and building the wrong thing is the top frustration with coding tools. Guardrails like this are becoming their own product category.',
    stars7d: 8772,
    pct7d: 508,
    url: 'https://github.com/obra/superpowers',
  },
  {
    owner: 'anomalyco',
    name: 'opencode',
    language: 'TypeScript',
    stars: 116400,
    forks: 8900,
    contributors: 214,
    downloads7d: 89000,
    category: 'Developer Tools',
    categorySlug: 'developer-tools',
    score: 74,
    summary:
      'A free, open-source AI coding agent for the terminal — one of the most widely adopted alternatives to paid tools like GitHub Copilot.',
    whyItMatters:
      'Over 1,100 code changes in the past 30 days means the team is actively building, not coasting. Shipping software faster is no longer a function of headcount.',
    stars7d: 5057,
    pct7d: 12,
    url: 'https://github.com/anomalyco/opencode',
  },
  {
    owner: 'D4Vinci',
    name: 'Scrapling',
    language: 'Python',
    stars: 25400,
    forks: 980,
    contributors: 34,
    downloads7d: 412000,
    category: 'Developer Tools',
    categorySlug: 'developer-tools',
    score: 37,
    summary:
      'Web scraping that keeps working even when websites change or fight back — adaptive parsing for pricing intelligence, market research, and lead generation.',
    whyItMatters:
      'Web data collection has become a quiet competitive advantage. 143 commits in the last 30 days says this is actively maintained, not a fading spike.',
    stars7d: 5482,
    pct7d: -18,
    url: 'https://github.com/D4Vinci/Scrapling',
  },
  {
    owner: 'AlexsJones',
    name: 'llmfit',
    language: 'Rust',
    stars: 21300,
    forks: 640,
    contributors: 12,
    downloads7d: null,
    category: 'AI / Machine Learning',
    categorySlug: 'ai-ml',
    score: 44,
    summary:
      'Scans your machine and returns a ranked list of local AI models your hardware can actually run — one step instead of an afternoon of trial and error.',
    whyItMatters:
      'As teams run models locally for cost and privacy, hardware compatibility is quietly becoming its own product category inside the local AI ecosystem.',
    stars7d: 5313,
    pct7d: 3,
    url: 'https://github.com/AlexsJones/llmfit',
  },
  {
    owner: 'lingdojo',
    name: 'kana-dojo',
    language: 'TypeScript',
    stars: 9800,
    forks: 410,
    contributors: 6,
    downloads7d: null,
    category: 'Open Source Utilities',
    categorySlug: 'open-source-utilities',
    score: 64,
    summary:
      'A free, open-source Japanese learning tool that takes clear design cues from Duolingo — drills, streaks, and a polished consumer-grade UI.',
    whyItMatters:
      'A reminder that polished, consumer-grade UX is increasingly an expectation in open source — not a differentiator.',
    stars7d: 2140,
    pct7d: 310,
    url: 'https://github.com/lingdojo/kana-dojo',
  },
  {
    owner: 'linuxhsj',
    name: 'openclaw-zero-token',
    language: 'Python',
    stars: 6200,
    forks: 290,
    contributors: 0,
    downloads7d: null,
    category: 'Security',
    categorySlug: 'security',
    score: 27,
    summary:
      'Accesses paid AI services through an existing browser login instead of API keys — a case study in how aggressively users route around paywalls.',
    whyItMatters:
      'Worth knowing about as a signal of paywall workarounds — and for the security implications it raises for product teams.',
    stars7d: 1890,
    pct7d: 440,
    url: 'https://github.com/linuxhsj/openclaw-zero-token',
  },
]

export interface ScoreSignal {
  label: string
  weight: number // percent of total score
  value: number // 0–100
}

export const featured = {
  ...repos[0],
  trendNarrative: [
    'Nearly 9,000 developers starred this project in a single week — a signal that the frustration of AI coding tools going rogue and building the wrong thing has reached a tipping point.',
    'Growth accelerated after a widely shared demo of the “plan first, code second” workflow, and the star curve has held its slope for three consecutive weeks instead of spiking and flattening. Commit activity (61 in the last 30 days) and a contributor count that has doubled since April point to compounding word-of-mouth rather than a launch-day spike.',
    'For product leaders, this points directly at an emerging market category: AI workflow guardrails that make autonomous coding agents reliable enough to actually trust.',
  ],
  breakdown: [
    { label: 'Star growth', weight: 25, value: 61 },
    { label: 'Active builders', weight: 20, value: 42 },
    { label: 'Community buzz', weight: 15, value: 58 },
    { label: 'Commit pace', weight: 10, value: 70 },
    { label: 'Fork activity', weight: 10, value: 35 },
    { label: 'Star momentum', weight: 10, value: 44 },
    { label: 'Fork momentum', weight: 10, value: 30 },
  ] as ScoreSignal[],
  commits30d: 61,
  scoredAt: 'July 18, 2026',
}

export const related = [repos[1], repos[2], repos[3], repos[4]]

// --- AI commit chart (daily Claude Code commits across public GitHub) ---

export interface CommitDay {
  day: string
  commits: number
}

export const commitSeries: CommitDay[] = [
  { day: 'Jun 19', commits: 94200 },
  { day: 'Jun 20', commits: 97800 },
  { day: 'Jun 21', commits: 71500 },
  { day: 'Jun 22', commits: 68900 },
  { day: 'Jun 23', commits: 104300 },
  { day: 'Jun 24', commits: 108600 },
  { day: 'Jun 25', commits: 112400 },
  { day: 'Jun 26', commits: 116100 },
  { day: 'Jun 27', commits: 88200 },
  { day: 'Jun 28', commits: 84600 },
  { day: 'Jun 29', commits: 124900 },
  { day: 'Jun 30', commits: 129300 },
  { day: 'Jul 1', commits: 133800 },
  { day: 'Jul 2', commits: 137200 },
  { day: 'Jul 3', commits: 101400 },
  { day: 'Jul 4', commits: 97800 },
  { day: 'Jul 5', commits: 146500 },
  { day: 'Jul 6', commits: 151200 },
  { day: 'Jul 7', commits: 156800 },
  { day: 'Jul 8', commits: 161400 },
  { day: 'Jul 9', commits: 118900 },
  { day: 'Jul 10', commits: 113200 },
  { day: 'Jul 11', commits: 172600 },
  { day: 'Jul 12', commits: 178400 },
  { day: 'Jul 13', commits: 184100 },
  { day: 'Jul 14', commits: 190700 },
  { day: 'Jul 15', commits: 139600 },
  { day: 'Jul 16', commits: 134800 },
  { day: 'Jul 17', commits: 204300 },
  { day: 'Jul 18', commits: 218900 },
]

export const chartStats = {
  latest: 218900,
  deltaLabel: '+23% week over week',
  totalLabel: '3.9M commits in the last 30 days',
}

// --- Shared helpers ---

export function formatCount(n: number): string {
  if (n >= 1000) {
    const v = n / 1000
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}k`
  }
  return String(n)
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

export const SCORE_EXPLAINER =
  'Early Signal Score (0–100) blends star growth, active builders, community buzz, and commit pace. 70+ Breakout · 40–69 Hot · under 40 Active.'

export const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
}

// --- Chart math (shared by all three directions) ---

export interface Point {
  x: number
  y: number
}

export function toPoints(values: number[], w: number, h: number, padX = 0, padTop = 0, padBottom = 0): Point[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (w - padX * 2),
    y: padTop + (1 - (v - min) / range) * (h - padTop - padBottom),
  }))
}

export function linePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export function areaPath(points: Point[], h: number): string {
  return `${linePath(points)} L${points[points.length - 1].x.toFixed(1)},${h} L${points[0].x.toFixed(1)},${h} Z`
}

/** Retro block gauge, e.g. score 53 -> "█████░░░░░" */
export function gauge(score: number, cells = 10): string {
  const filled = Math.round((score / 100) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}
