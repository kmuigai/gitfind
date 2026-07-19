import Link from 'next/link'
import { featured, related, pctLabel } from '@/components/design-lab/sample-data'
import { ENav, ETicker, EPanelHead, ERepoRows, EScorePanel, EStatsPanel, ENewsletter, EFooter } from '@/components/design-lab/e'

export default function DesignLabEProject() {
  return (
    <div className="dl-e min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #0a0a0c; }'}</style>
      <ENav />
      <ETicker />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="font-mono text-[11px] tracking-wider text-[var(--dl-muted)]" aria-label="Breadcrumb">
          <Link href="/design-lab/e" className="hover:text-[var(--dl-accent)]">TRENDING</Link>
          <span className="mx-1.5">›</span>
          <span>{featured.category.toUpperCase()}</span>
          <span className="mx-1.5">›</span>
          <span className="text-[var(--dl-text)]">{featured.owner}/{featured.name}</span>
        </nav>

        {/* Security-style header */}
        <div className="mt-4 border border-[var(--dl-border)] bg-[var(--dl-surface)]">
          <EPanelHead title="PROJECT PROFILE" right="DEV TOOLS" />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
                  {featured.owner}/<span className="text-[var(--dl-accent)]">{featured.name}</span>
                </h1>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--dl-body)]">
                  {featured.summary}
                </p>
              </div>
              <a
                href={featured.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[var(--dl-accent)] px-3.5 py-2 font-mono text-[11px] font-bold tracking-wider text-[var(--dl-accent)] transition-colors hover:bg-[var(--dl-accent)] hover:text-[var(--dl-on-accent)]"
              >
                GITHUB &lt;GO&gt; ↗
              </a>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--dl-border)] pt-4 font-mono text-[11px]">
              <span className="font-semibold text-[var(--dl-positive)]">
                ▲ {pctLabel(featured.pct7d)} THIS WEEK
              </span>
              <span className="text-[var(--dl-muted)]">+{featured.stars7d.toLocaleString('en-US')} STARS / 7D</span>
              <span className="text-[var(--dl-muted)]">{featured.commits30d} COMMITS / 30D</span>
            </div>
          </div>
        </div>

        {/* Body grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
              <EPanelHead title="WHAT IT DOES" />
              <p className="p-5 text-[14px] leading-[1.8] text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a vague prompt,
                Superpowers inserts a planning step: the agent must restate the goal,
                propose an approach, and wait for explicit approval before it touches
                the codebase.
              </p>
            </section>

            <section className="border border-[var(--dl-accent)]/50 bg-[var(--dl-accent)]/5">
              <EPanelHead title="WHY IT MATTERS" />
              <p className="p-5 text-[14px] leading-[1.8] text-[var(--dl-body)]">
                {featured.whyItMatters} For product leaders, this points directly at an
                emerging market category: AI workflow guardrails that make autonomous
                coding agents reliable enough to actually trust.
              </p>
            </section>

            <section className="border border-[var(--dl-border)] bg-[var(--dl-surface)]">
              <EPanelHead title="WHY IT’S TRENDING" right="ANALYST NOTE" />
              <div className="space-y-3 p-5 text-[14px] leading-[1.8] text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <EScorePanel />
            <EStatsPanel />
          </aside>
        </div>

        {/* Related */}
        <section className="mt-10">
          <ERepoRows items={related} />
        </section>

        <section className="mt-8">
          <ENewsletter />
        </section>
      </main>

      <EFooter />
    </div>
  )
}
