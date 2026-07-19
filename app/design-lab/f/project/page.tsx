import Link from 'next/link'
import { featured, related, pctLabel } from '@/components/design-lab/sample-data'
import { FNav, FDivider, FRepoCard, FScorePanel, FStatsPanel, FNewsletter, FFooter } from '@/components/design-lab/f'

export default function DesignLabFProject() {
  return (
    <div className="dl-f min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #0e0e28; }'}</style>
      <FNav />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <nav className="font-mono text-[11px] tracking-wider text-[var(--dl-muted)]" aria-label="Breadcrumb">
          <Link href="/design-lab/f" className="hover:text-[var(--dl-accent)]">[MOVERS]</Link>
          <span className="mx-1.5 text-[var(--dl-border)]">»</span>
          <span>{featured.category.toUpperCase()}</span>
          <span className="mx-1.5 text-[var(--dl-border)]">»</span>
          <span className="text-[var(--dl-text)]">{featured.owner}/{featured.name}</span>
        </nav>

        {/* File header */}
        <header className="mt-6 border-[3px] border-double border-[var(--dl-accent)]/70 bg-[var(--dl-surface)] p-6 sm:p-8">
          <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-[var(--dl-magenta)]">
            ※ FILE VIEWER ※
          </p>
          <h1 className="mt-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="font-normal text-[var(--dl-muted)]">{featured.owner}/</span>
            <span className="text-[var(--dl-accent)]">{featured.name}</span>
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[13px] leading-[1.8] text-[var(--dl-body)]">
            {featured.summary}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px]">
            <p className="font-bold text-[var(--dl-positive)]">
              ▲ {pctLabel(featured.pct7d)} THIS WEEK
              <span className="ml-2 font-normal text-[var(--dl-muted)]">(+{featured.stars7d.toLocaleString('en-US')}★)</span>
            </p>
            <p className="text-[var(--dl-muted)]">{featured.commits30d} COMMITS / 30D</p>
            <a
              href={featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[var(--dl-accent)] px-3 py-1.5 font-bold tracking-wider text-[var(--dl-accent)] transition-colors hover:bg-[var(--dl-accent)] hover:text-[var(--dl-on-accent)]"
            >
              [DOWNLOAD FROM GITHUB ↗]
            </a>
          </div>
        </header>

        {/* Body grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_330px]">
          <div className="space-y-6 font-mono">
            <section className="border-[3px] border-double border-[var(--dl-border)] bg-[var(--dl-surface)] p-6">
              <h2 className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-accent)]">※ WHAT IT DOES</h2>
              <p className="mt-3 text-[13px] leading-[1.85] text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a vague prompt,
                Superpowers inserts a planning step: the agent must restate the goal,
                propose an approach, and wait for explicit approval before it touches
                the codebase.
              </p>
            </section>

            <section className="border-[3px] border-double border-[var(--dl-magenta)]/50 bg-[var(--dl-magenta)]/5 p-6">
              <h2 className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-magenta)]">※ WHY IT MATTERS</h2>
              <p className="mt-3 text-[13px] leading-[1.85] text-[var(--dl-body)]">
                {featured.whyItMatters} For product leaders, this points directly at an
                emerging market category: AI workflow guardrails that make autonomous
                coding agents reliable enough to actually trust.
              </p>
            </section>

            <section className="border-[3px] border-double border-[var(--dl-border)] bg-[var(--dl-surface)] p-6">
              <h2 className="text-[10px] font-bold tracking-[0.25em] text-[var(--dl-accent)]">※ WHY IT’S TRENDING</h2>
              <div className="mt-3 space-y-3 text-[13px] leading-[1.85] text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <FScorePanel />
            <FStatsPanel />
          </aside>
        </div>

        {/* Related */}
        <section className="mt-14">
          <FDivider label="MORE FILES LIKE THIS" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {related.map((repo) => (
              <FRepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <FNewsletter />
        </section>
      </div>

      <FFooter />
    </div>
  )
}
