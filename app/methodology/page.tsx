import type { Metadata } from 'next'
import Link from 'next/link'
import NewsletterSignup from '@/components/NewsletterSignup'
import Reveal from '@/components/Reveal'
import { gauge } from '@/lib/design'

export const metadata: Metadata = {
  title: 'Methodology — How the Early Signal Score Works | GitFind',
  description:
    'The Early Signal Score (0–100) blends star growth, active builders, community buzz, and commit pace. Here is exactly how it is computed, what the tiers mean, and the rules we do not break.',
  openGraph: {
    title: 'GitFind Methodology — How the Early Signal Score Works',
    description:
      'Every score on GitFind explains itself. The signals, the weights, the tiers, and the honesty rules.',
    url: 'https://gitfind.ai/methodology',
    type: 'article',
  },
}

export const revalidate = 86400

const SIGNALS = [
  { label: 'star growth', weight: 25, value: 61, note: 'New stars per week, and how that compares to the repo’s own history.' },
  { label: 'active builders', weight: 20, value: 42, note: 'Contributors committing in the last 30 days. A team, not a solo push.' },
  { label: 'community buzz', weight: 15, value: 58, note: 'Mentions across Hacker News, Reddit, and GitHub discussions.' },
  { label: 'commit pace', weight: 10, value: 70, note: 'Commits landing in the last 30 days. Alive repos breathe.' },
  { label: 'fork activity', weight: 10, value: 35, note: 'New forks — people building on the work, not just watching it.' },
  { label: 'star momentum', weight: 10, value: 44, note: 'Whether this week’s star growth is accelerating or cooling off.' },
  { label: 'fork momentum', weight: 10, value: 30, note: 'Same idea, for forks. Acceleration beats raw totals.' },
] as const

const TIERS = [
  { tier: 'Breakout', range: '70 – 100', chip: 'bg-[var(--tier-breakout)]', text: 'Strong early signal — breaking out. The repo is compounding on every axis at once.' },
  { tier: 'Hot', range: '40 – 69', chip: 'bg-[var(--tier-hot)]', text: 'Gaining traction — heating up. Real momentum, still building.' },
  { tier: 'Active', range: '0 – 39', chip: 'bg-[var(--tier-active)]', text: 'On the radar — early signal detected. Worth watching, not yet moving.' },
] as const

const RULES = [
  'every delta carries its timeframe — “+508%” means nothing without “this week”',
  'zero is a state, not a verdict — invisible to a metric is not the same as dead',
  'no fabricated precision — if a tool can’t be measured honestly, we say so on the page',
  'the score shows its work — every number links back here',
]

export default function MethodologyPage() {
  return (
    <div>
      {/* Spec header */}
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">methodology</span>
          </nav>
          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            HOW GITFIND SCORES
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            The Early Signal Score is a single 0–100 rating of how much a repo is
            moving right now — built so a builder can trust it without trusting us.
            Here is all of it: the signals, the weights, the tiers, and the rules
            we don’t break.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* § 1 — the signals */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 1 — the signals</p>
          <p>fig. 01</p>
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
            <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
              fig. 01 — seven weighted signals, example values
            </p>
            <div className="p-4 font-mono">
              {SIGNALS.map((s) => (
                <div key={s.label} className="border-b border-dashed border-[var(--line-soft)] py-2.5 last:border-0">
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="w-32 shrink-0 font-bold text-[var(--ink)]">{s.label}</span>
                    <span className="w-12 shrink-0 text-right tabular-nums text-[var(--muted)]">{s.weight}%</span>
                    <span className="flex-1 tracking-wider text-[var(--ink)]">{gauge(s.value, 20)}</span>
                    <span className="w-8 shrink-0 text-right tabular-nums text-[var(--ink)]">{s.value}</span>
                  </div>
                  <p className="mt-1 pl-36 text-[11px] leading-relaxed text-[var(--muted)] sm:pl-[11.25rem]">{s.note}</p>
                </div>
              ))}
              <p className="pt-3 text-[11px] leading-relaxed text-[var(--muted)]">
                raw signals are normalized against the repo’s own history and against
                every other repo we track, then blended into one score. a repo doesn’t
                compete with the biggest projects on GitHub — it competes with itself.
              </p>
            </div>
          </div>
        </Reveal>

        {/* § 2 — the tiers */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 2 — the tiers</p>
          <p>fig. 02</p>
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
            <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
              fig. 02 — three tiers, no mystery
            </p>
            <div className="p-4 font-mono">
              {TIERS.map((t) => (
                <div key={t.tier} className="flex flex-col gap-1 border-b border-dashed border-[var(--line-soft)] py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
                  <span className={`inline-block w-fit px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--paper)] ${t.chip}`}>
                    {t.tier}
                  </span>
                  <span className="w-20 shrink-0 tabular-nums text-[12px] font-bold text-[var(--ink)]">{t.range}</span>
                  <span className="text-[12px] leading-relaxed text-[var(--body)]">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* § 3 — manipulation filter */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 3 — the manipulation filter</p>
          <p>fig. 03</p>
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-5">
            <p className="font-mono text-[13px] leading-[1.8] text-[var(--body)]">
              Star counts can be bought, and we assume some are. When a repo’s star
              pattern looks inorganic — for example, near-identical weekly gains two
              weeks running, a pattern genuine growth almost never produces — a
              manipulation penalty is deducted from the score and shown openly on
              the project page. When you see it, you’re watching the filter work.
              Stars alone are never the story: engagement, commits, and community
              conversation are far harder to fake.
            </p>
          </div>
        </Reveal>

        {/* § 4 — data & cadence */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 4 — data &amp; cadence</p>
          <p>fig. 04</p>
        </div>
        <Reveal className="mt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
              <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
                sources
              </p>
              <ul className="space-y-2 p-4 font-mono text-[12px] leading-relaxed text-[var(--body)]">
                <li>· GitHub API — stars, forks, contributors, commits, licenses, daily snapshots</li>
                <li>· public GitHub event data (BigQuery) — ai-written commit volume</li>
                <li>· Hacker News, Reddit, GitHub discussions — community mentions</li>
                <li>· package registries — npm and PyPI weekly downloads, where linked</li>
              </ul>
            </div>
            <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
              <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
                cadence
              </p>
              <ul className="space-y-2 p-4 font-mono text-[12px] leading-relaxed text-[var(--body)]">
                <li>· pipeline runs nightly — new snapshots, new scores</li>
                <li>· pages refresh hourly — nothing you read is more than a day old</li>
                <li>· every score is stamped with its measurement date on the project page</li>
              </ul>
            </div>
          </div>
        </Reveal>

        {/* § 5 — the rules */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 5 — the rules we don’t break</p>
          <p>fig. 05</p>
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--ink)] p-5 font-mono">
            {RULES.map((r, i) => (
              <p key={r} className="py-1 text-[12.5px] leading-relaxed text-[var(--paper)]">
                <span className="mr-2 text-[var(--accent)]">{String(i + 1).padStart(2, '0')}</span>
                {r}
              </p>
            ))}
          </div>
        </Reveal>

        <div className="mt-12">
          <NewsletterSignup />
        </div>
      </main>
    </div>
  )
}
