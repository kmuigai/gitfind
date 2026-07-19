import Link from 'next/link'
import { featured, related, pctLabel } from '@/components/design-lab/sample-data'
import { ANav, AFooter, ALabel, ARepoCard, AScoreCard, AStatGrid, ANewsletter } from '@/components/design-lab/a'

export default function DesignLabAProject() {
  return (
    <div className="dl-a min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #0b0d11; }'}</style>
      <ANav />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Breadcrumb */}
        <nav className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--dl-muted)]" aria-label="Breadcrumb">
          <Link href="/design-lab/a" className="transition-colors hover:text-[var(--dl-text)]">GitFind</Link>
          <span className="mx-2 text-[var(--dl-border)]">/</span>
          <span>{featured.category}</span>
          <span className="mx-2 text-[var(--dl-border)]">/</span>
          <span className="text-[var(--dl-text)]">{featured.owner}/{featured.name}</span>
        </nav>

        {/* Header */}
        <header className="mt-6 border-b border-[var(--dl-border)] pb-10">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="font-normal text-[var(--dl-muted)]">{featured.owner}/</span>
            {featured.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--dl-body)]">
            {featured.summary}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="font-mono text-sm font-medium text-[var(--dl-positive)]">
              ▲ +{featured.stars7d.toLocaleString('en-US')} stars this week ({pctLabel(featured.pct7d)})
            </p>
            <p className="font-mono text-sm text-[var(--dl-muted)]">
              {featured.commits30d} commits in 30 days
            </p>
            <a
              href={featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[var(--dl-accent)]/50 px-4 py-2 text-sm font-medium text-[var(--dl-accent-strong)] transition-colors hover:border-[var(--dl-accent)] hover:bg-[var(--dl-accent)]/10"
            >
              View on GitHub ↗
            </a>
          </div>
        </header>

        {/* Body grid */}
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            <section>
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
                What it does
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a vague prompt,
                Superpowers inserts a planning step: the agent must restate the goal,
                propose an approach, and wait for explicit approval before it touches
                the codebase.
              </p>
            </section>

            <section className="rounded-lg border border-[var(--dl-accent)]/30 bg-[var(--dl-accent)]/5 p-6 sm:p-8">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
                Why it matters
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-[var(--dl-body)]">
                {featured.whyItMatters} For product leaders, this points directly at an
                emerging market category: AI workflow guardrails that make autonomous
                coding agents reliable enough to actually trust.
              </p>
            </section>

            <section>
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
                Why it’s trending
              </h2>
              <div className="mt-3 space-y-4 text-[17px] leading-relaxed text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <AScoreCard />
            <AStatGrid />
          </aside>
        </div>

        {/* Related */}
        <section className="mt-16 border-t border-[var(--dl-border)] pt-14">
          <ALabel index="→" title="Related projects" note="More Developer Tools moving this week." />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {related.map((repo) => (
              <ARepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <ANewsletter />
        </section>
      </div>

      <AFooter />
    </div>
  )
}
