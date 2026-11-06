import type { Metadata } from 'next'
import Link from 'next/link'
import ApiAccessForm from '@/components/ApiAccessForm'
import Reveal from '@/components/Reveal'

export const metadata: Metadata = {
  title: 'Developers — The GitFind API (Early Access) | GitFind',
  description:
    'Programmatic access to GitFind’s data: 40,000+ GitHub projects scored nightly, plain-English summaries, star velocity, and the AI Code Index. Request early access.',
  openGraph: {
    title: 'GitFind API — Early Access for Developers',
    description:
      'The scored, summarized, velocity-tracked open-source catalog — as an API. Request early access.',
    url: 'https://gitfind.ai/developers',
    type: 'website',
  },
}

export const revalidate = 86400

const CATALOG_POINTS = [
  '40,000+ GitHub projects tracked, rescanned nightly',
  'every project scored — Early Signal Score (0–100) with the full signal breakdown',
  'a plain-English summary and a “why it matters” for every project, written per repo',
  'star & fork velocity and momentum, from daily snapshots — not scraped on demand',
] as const

const INDEX_POINTS = [
  'AI Code Index — AI coding tools’ real share of commits and pull requests, daily',
  'Open Model Index — adoption metrics for open models, tracked the same way',
  'community buzz — mentions across Hacker News, Reddit, and GitHub discussions',
  'the same pipelines that power this site — the API is the data, not a copy of it',
] as const

const ENDPOINTS = [
  {
    path: 'GET /v1/projects/{owner}/{repo}',
    note: 'One project, full record: score + breakdown, summary, why it matters, stats.',
  },
  {
    path: 'GET /v1/projects/top',
    note: 'The highest-scored projects overall, or per category with ?category= and ?limit=.',
  },
  {
    path: 'GET /v1/projects/trending',
    note: 'Star-velocity leaders, risers, and breakouts — what is moving this week.',
  },
  {
    path: 'GET /v1/search?q=',
    note: 'Search the 40,000-project catalog by name, topic, or keyword.',
  },
  {
    path: 'GET /v1/ai-code-index',
    note: 'AI coding tools’ share of commits and PRs over time — the dataset behind the index.',
  },
  {
    path: 'GET /v1/models',
    note: 'Open Model Index metrics: which open models are gaining real adoption.',
  },
] as const

// A real record from the live catalog (react/create-react-app, scored
// Nov 6, 2026), trimmed of internal fields for readability.
const SAMPLE_JSON = `{
  "owner": "react",
  "name": "create-react-app",
  "url": "https://github.com/react/create-react-app",
  "description": "Set up a modern web app by running one command.",
  "language": "JavaScript",
  "license": "MIT",
  "topics": ["react", "zero-configuration", "build-tools"],
  "stars": 103228,
  "forks": 26860,
  "contributors": 946,
  "watchers": 1863,
  "pushed_at": "2025-02-15T01:32:11+00:00",
  "summary": "Create React App was a tool that let developers start
    building a website or web application with a single command,
    automatically handling all the complex setup work behind the
    scenes. It has since been officially retired...",
  "why_it_matters": "With over 103,000 stars and nearly 27,000 forks,
    this project shaped how millions of web products were built over
    the past decade...",
  "category": "Developer Tools",
  "early_signal_score": 9,
  "score_breakdown": {
    "star_velocity_score": 0,
    "fork_velocity_score": 65,
    "contributor_ratio_score": 5,
    "mention_velocity_score": 10,
    "commit_frequency_score": 0,
    "manipulation_penalty": 0
  },
  "scored_at": "2026-11-06T14:08:35.345+00:00"
}`

interface TierRow {
  label: string
  value: string
}

interface Tier {
  name: string
  price: string
  rows: TierRow[]
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    rows: [
      { label: 'calls / month', value: '100' },
      { label: 'project records + top lists', value: '✓' },
      { label: 'search + trending', value: '—' },
      { label: 'ai code index', value: '—' },
      { label: 'score history', value: '—' },
      { label: 'support', value: '—' },
      { label: 'attribution', value: 'required' },
    ],
  },
  {
    name: 'Builder',
    price: '$49/mo',
    rows: [
      { label: 'calls / month', value: '5,000' },
      { label: 'project records + top lists', value: '✓' },
      { label: 'search + trending', value: '✓' },
      { label: 'ai code index', value: 'last 30 days' },
      { label: 'score history', value: '30 days' },
      { label: 'support', value: 'email' },
      { label: 'attribution', value: 'not required' },
    ],
  },
  {
    name: 'Growth',
    price: '$149/mo',
    rows: [
      { label: 'calls / month', value: '25,000' },
      { label: 'project records + top lists', value: '✓' },
      { label: 'search + trending', value: '✓' },
      { label: 'ai code index', value: 'full history' },
      { label: 'score history', value: '12 months' },
      { label: 'support', value: 'email, same-day' },
      { label: 'attribution', value: 'not required' },
    ],
  },
  {
    name: 'Scale',
    price: '$499/mo+',
    rows: [
      { label: 'calls / month', value: '150,000+' },
      { label: 'project records + top lists', value: '✓' },
      { label: 'search + trending', value: '✓' },
      { label: 'ai code index', value: 'full history' },
      { label: 'score history', value: 'full + bulk export' },
      { label: 'support', value: 'priority + invoicing' },
      { label: 'attribution', value: 'not required' },
    ],
  },
]

function SectionHead({ index, title, fig }: { index: string; title: string; fig: string }) {
  return (
    <div className="flex flex-col gap-1 font-mono text-[12px] text-[var(--muted)] sm:flex-row sm:items-baseline sm:justify-between">
      <p className="font-bold tracking-[0.2em] text-[var(--ink)]">
        § {index} — {title}
      </p>
      <p>{fig}</p>
    </div>
  )
}

export default function DevelopersPage() {
  return (
    <div>
      {/* Spec header */}
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">developers</span>
          </nav>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-4xl">
              THE GITFIND API
            </h1>
            <span className="border-2 border-[var(--line)] bg-[var(--accent)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]">
              early access
            </span>
          </div>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Everything GitFind knows — 40,000+ open-source projects scored
            nightly, summarized in plain English, tracked for star velocity,
            plus the AI Code Index — as a simple read-only API. The API is not
            live yet: we are opening it to a first cohort and collecting
            requests now. If the data would power something you are building,
            ask for a key below.
          </p>
          <a
            href="#request-access"
            className="invert-hover mt-6 inline-block border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--body)]"
          >
            request access ↓
          </a>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* § 1 — the data */}
        <SectionHead index="1" title="the data" fig="fig. 01" />
        <Reveal className="mt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
              <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
                the catalog
              </p>
              <ul className="space-y-2 p-4 font-mono text-[12px] leading-relaxed text-[var(--body)]">
                {CATALOG_POINTS.map((point) => (
                  <li key={point}>· {point}</li>
                ))}
              </ul>
            </div>
            <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
              <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
                the indexes
              </p>
              <ul className="space-y-2 p-4 font-mono text-[12px] leading-relaxed text-[var(--body)]">
                {INDEX_POINTS.map((point) => (
                  <li key={point}>· {point}</li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* § 2 — endpoints */}
        <div className="mt-10">
          <SectionHead index="2" title="the endpoints" fig="fig. 02" />
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
            <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
              fig. 02 — six read-only endpoints, all early access
            </p>
            <div className="p-4 font-mono">
              {ENDPOINTS.map((endpoint) => (
                <div key={endpoint.path} className="border-b border-dashed border-[var(--line-soft)] py-3 last:border-0">
                  <p className="text-[12.5px] font-bold text-[var(--ink)]">{endpoint.path}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--body)]">{endpoint.note}</p>
                </div>
              ))}
              <p className="pt-3 text-[11px] leading-relaxed text-[var(--muted)]">
                plain JSON over HTTPS, key in a header. No SDKs, no query
                language — if you can read this page, you can call the API.
              </p>
            </div>
          </div>
        </Reveal>

        {/* § 3 — sample response */}
        <div className="mt-10">
          <SectionHead index="3" title="a sample response" fig="fig. 03" />
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
            <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
              fig. 03 — GET /v1/projects/react/create-react-app
            </p>
            <pre className="overflow-x-auto bg-[var(--ink)] p-4 font-mono text-[11.5px] leading-relaxed text-[var(--paper)]">
              {SAMPLE_JSON}
            </pre>
            <p className="px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
              a real record from the live catalog, scored Nov 6, 2026 —
              internal fields removed and long text shortened for readability.
            </p>
          </div>
        </Reveal>

        {/* § 4 — tiers */}
        <div className="mt-10">
          <SectionHead index="4" title="the tiers" fig="fig. 04" />
        </div>
        <Reveal className="mt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {TIERS.map((tier) => (
              <div key={tier.name} className="border-2 border-[var(--line)] bg-[var(--paper)]">
                <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]">
                  {tier.name}
                </p>
                <p className="font-display px-4 pt-4 text-2xl font-bold text-[var(--ink)]">
                  {tier.price}
                </p>
                <div className="p-4 font-mono">
                  {tier.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--line-soft)] py-2 text-[11.5px] last:border-0"
                    >
                      <span className="text-[var(--muted)]">{row.label}</span>
                      <span className="text-right font-bold text-[var(--ink)]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <p className="mt-4 max-w-2xl font-mono text-[11.5px] leading-[1.75] text-[var(--muted)]">
          Early access: the prices above are founding pricing for the first
          cohort, and keys are issued in small batches while we watch load.
          There is no SLA yet — if uptime terms matter to you, that is a Scale
          conversation. Free tier carries attribution; raw-dump resale is a
          Scale-only right.
        </p>

        {/* § 5 — request access */}
        <div className="mt-10" id="request-access">
          <SectionHead index="5" title="request access" fig="fig. 05" />
        </div>
        <Reveal className="mt-4">
          <div className="max-w-2xl">
            <p className="mb-4 font-mono text-[13px] leading-[1.8] text-[var(--body)]">
              Tell us what you would build. Requests are read by a human, in
              the order they arrive — the clearest use cases get the first keys.
            </p>
            <ApiAccessForm />
          </div>
        </Reveal>
      </main>
    </div>
  )
}
