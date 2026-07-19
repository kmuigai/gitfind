import Link from 'next/link'
import { featured, related, formatCount, pctLabel } from '@/components/design-lab/sample-data'
import { DChrome, DNav, DStatusBar, DSectionHead, DRepoCard, DScorePanel, DStatsPanel, DNewsletter } from '@/components/design-lab/d'

export default function DesignLabDProject() {
  return (
    <DChrome>
      <DNav />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <nav className="text-[11px] tracking-wider text-[var(--dl-muted)]" aria-label="Breadcrumb">
          <Link href="/design-lab/d" className="hover:text-[var(--dl-accent)]">~/TRENDING</Link>
          <span className="mx-1.5 text-[var(--dl-border)]">/</span>
          <span>{featured.category.toUpperCase()}</span>
          <span className="mx-1.5 text-[var(--dl-border)]">/</span>
          <span className="text-[var(--dl-text)]">{featured.owner}/{featured.name}</span>
        </nav>

        {/* Header */}
        <header className="mt-6 border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">
            <span>┌─[ FILE: {featured.name.toUpperCase()}.MD ]</span>
            <span className="flex-1 border-t border-[var(--dl-border)]" />
            <span className="text-[var(--dl-border)]">┐</span>
          </div>
          <h1 className="dl-glow-green mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="font-normal text-[var(--dl-muted)]">{featured.owner}/</span>
            {featured.name}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.8] text-[var(--dl-body)]">
            {featured.summary}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
            <p className="font-semibold text-[var(--dl-positive)]">
              ▲ {pctLabel(featured.pct7d)} THIS WEEK
              <span className="ml-2 font-normal text-[var(--dl-muted)]">(+{featured.stars7d.toLocaleString('en-US')} stars)</span>
            </p>
            <p className="text-[var(--dl-muted)]">{featured.commits30d} COMMITS / 30D</p>
            <a
              href={featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[var(--dl-accent)]/60 px-3 py-1.5 font-bold tracking-wider text-[var(--dl-accent)] transition-colors hover:bg-[var(--dl-accent)] hover:text-[var(--dl-on-accent)]"
            >
              [OPEN GITHUB ↗]
            </a>
          </div>
        </header>

        {/* Body grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6">
              <h2 className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: WHAT IT DOES</h2>
              <p className="mt-3 text-[13px] leading-[1.85] text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a vague prompt,
                Superpowers inserts a planning step: the agent must restate the goal,
                propose an approach, and wait for explicit approval before it touches
                the codebase.
              </p>
            </section>

            <section className="border border-[var(--dl-accent)]/50 bg-[var(--dl-accent)]/5 p-6">
              <h2 className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: WHY IT MATTERS</h2>
              <p className="mt-3 text-[13px] leading-[1.85] text-[var(--dl-body)]">
                {featured.whyItMatters} For product leaders, this points directly at an
                emerging market category: AI workflow guardrails that make autonomous
                coding agents reliable enough to actually trust.
              </p>
            </section>

            <section className="border border-[var(--dl-border)] bg-[var(--dl-surface)] p-6">
              <h2 className="text-[10px] tracking-[0.25em] text-[var(--dl-accent)]">:: WHY IT’S TRENDING</h2>
              <div className="mt-3 space-y-3 text-[13px] leading-[1.85] text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
              <p className="mt-5 border-t border-[var(--dl-border)] pt-3 text-[11px] tracking-wide text-[var(--dl-muted)]">
                {formatCount(featured.stars)}★ · {formatCount(featured.forks)}⑂ · {featured.commits30d} COMMITS/30D
              </p>
            </section>
          </div>

          <aside className="space-y-5">
            <DScorePanel />
            <DStatsPanel />
          </aside>
        </div>

        {/* Related */}
        <section className="mt-14">
          <DSectionHead index="→" title="RELATED FILES" note="More Developer Tools moving this week." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {related.map((repo) => (
              <DRepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <DNewsletter />
        </section>
      </div>

      <DStatusBar />
    </DChrome>
  )
}
