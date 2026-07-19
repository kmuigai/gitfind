import Link from 'next/link'
import { featured, related, pctLabel } from '@/components/design-lab/sample-data'
import { ITicker, IHeader, IRepoEntry, ISpecScore, ISpecStats, INewsletter, IFooter } from '@/components/design-lab/i'

export default function DesignLabIProject() {
  return (
    <div className="dl-i min-h-screen bg-[var(--dl-paper)] text-[var(--dl-ink)]">
      <style>{'body { background: #f4f1e6; }'}</style>
      <ITicker />
      <IHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* spec header */}
        <div className="dl-halftone -mx-4 border-b-2 border-[var(--dl-line)] px-4 pb-8 sm:-mx-6 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--dl-muted)]" aria-label="Breadcrumb">
            <Link href="/design-lab/i" className="dl-invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span>{featured.category.toLowerCase()}</span>
            <span className="mx-1">/</span>
            <span className="text-[var(--dl-ink)]">{featured.owner}/{featured.name}</span>
          </nav>
          <h1 className="dl-pixel mt-5 text-2xl font-bold text-[var(--dl-ink)] sm:text-4xl">
            {featured.owner}/{featured.name}
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--dl-body)]">
            {featured.summary}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--dl-line)] bg-[var(--dl-accent)] px-2 py-0.5 font-bold text-[var(--dl-ink)]">
              ▲ {pctLabel(featured.pct7d)} this week
            </span>
            <span className="text-[var(--dl-body)]">+{featured.stars7d.toLocaleString('en-US')}★ / 7d</span>
            <span className="text-[var(--dl-body)]">{featured.commits30d} commits / 30d</span>
            <a
              href={featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="dl-invert-hover border-2 border-[var(--dl-line)] px-2 py-0.5 font-bold text-[var(--dl-ink)]"
            >
              source ↗
            </a>
          </div>
        </div>

        {/* body */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            <section>
              <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--dl-ink)]">
                § 1 — what it does
              </h2>
              <p className="mt-3 border-l-2 border-[var(--dl-line)] pl-4 font-mono text-[14px] leading-[1.85] text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a
                vague prompt, Superpowers inserts a planning step: the agent must
                restate the goal, propose an approach, and wait for explicit approval
                before it touches the codebase.
              </p>
            </section>

            <section>
              <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--dl-ink)]">
                § 2 — why it matters
              </h2>
              <p className="mt-3 border-l-2 border-[var(--dl-line)] pl-4 font-mono text-[14px] leading-[1.85] text-[var(--dl-body)]">
                {featured.whyItMatters} For product leaders, this points
                directly at an emerging market category: AI workflow guardrails that
                make autonomous coding agents reliable enough to actually trust.
              </p>
            </section>

            <section>
              <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--dl-ink)]">
                § 3 — why it’s trending
              </h2>
              <div className="mt-3 space-y-3 border-l-2 border-[var(--dl-line)] pl-4 font-mono text-[14px] leading-[1.85] text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <ISpecScore />
            <ISpecStats />
          </aside>
        </div>

        {/* related */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
            <p>§ 4 — related entries</p>
            <p>4 entries</p>
          </div>
          <div className="mt-5 space-y-6">
            {related.map((repo, i) => (
              <IRepoEntry key={`${repo.owner}/${repo.name}`} repo={repo} index={i} />
            ))}
          </div>
        </section>

        <div className="mt-10">
          <INewsletter />
        </div>
      </main>

      <IFooter />
    </div>
  )
}
