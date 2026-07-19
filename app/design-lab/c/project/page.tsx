import Link from 'next/link'
import { featured, related, pctLabel } from '@/components/design-lab/sample-data'
import { CNav, CFooter, CScorePanel, CStatsPanel, CRepoTable, CNewsletter } from '@/components/design-lab/c'

export default function DesignLabCProject() {
  return (
    <div className="dl-c min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #fafafa; }'}</style>
      <CNav />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="text-xs text-[var(--dl-dim)]" aria-label="Breadcrumb">
          <Link href="/design-lab/c" className="hover:text-[var(--dl-text)]">Trending</Link>
          <span className="mx-1.5">/</span>
          <span>{featured.category}</span>
          <span className="mx-1.5">/</span>
          <span className="text-[var(--dl-text)]">{featured.owner}/{featured.name}</span>
        </nav>

        {/* Header */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-xl font-semibold tracking-tight">
              {featured.owner}/{featured.name}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--dl-muted)]">
              {featured.summary}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-[var(--dl-positive)]/10 px-2.5 py-1 font-medium text-[var(--dl-positive)]">
                {pctLabel(featured.pct7d)} this week
              </span>
              <span className="rounded-full bg-[var(--dl-surface-2)] px-2.5 py-1 text-[var(--dl-muted)]">
                +{featured.stars7d.toLocaleString('en-US')} stars / 7d
              </span>
              <span className="rounded-full bg-[var(--dl-surface-2)] px-2.5 py-1 text-[var(--dl-muted)]">
                {featured.commits30d} commits / 30d
              </span>
            </div>
          </div>
          <a
            href={featured.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--dl-border)] bg-[var(--dl-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--dl-text)] transition-colors hover:border-[var(--dl-accent)] hover:text-[var(--dl-accent)]"
          >
            View on GitHub ↗
          </a>
        </div>

        {/* Body grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5">
              <h2 className="text-[13px] font-semibold text-[var(--dl-text)]">What it does</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a vague prompt,
                Superpowers inserts a planning step: the agent must restate the goal,
                propose an approach, and wait for explicit approval before it touches
                the codebase.
              </p>
            </section>

            <section className="rounded-lg border border-[var(--dl-border)] border-l-2 border-l-[var(--dl-accent)] bg-[var(--dl-surface)] p-5">
              <h2 className="text-[13px] font-semibold text-[var(--dl-text)]">Why it matters</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--dl-body)]">
                {featured.whyItMatters} For product leaders, this points directly at an
                emerging market category: AI workflow guardrails that make autonomous
                coding agents reliable enough to actually trust.
              </p>
            </section>

            <section className="rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] p-5">
              <h2 className="text-[13px] font-semibold text-[var(--dl-text)]">Why it’s trending</h2>
              <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <CScorePanel />
            <CStatsPanel />
          </aside>
        </div>

        {/* Related */}
        <section className="mt-10">
          <h2 className="text-[13px] font-semibold text-[var(--dl-text)]">
            Related projects
            <span className="ml-2 font-normal text-[var(--dl-dim)]">More in {featured.category}</span>
          </h2>
          <div className="mt-3">
            <CRepoTable items={related} />
          </div>
        </section>

        <div className="mt-8">
          <CNewsletter />
        </div>
      </main>

      <CFooter />
    </div>
  )
}
