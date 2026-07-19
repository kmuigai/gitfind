import { repos } from '@/components/design-lab/sample-data'
import { ANav, AFooter, ALabel, ARepoCard, AChart, ANewsletter } from '@/components/design-lab/a'

export default function DesignLabA() {
  return (
    <div className="dl-a min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #0b0d11; }'}</style>
      <ANav />

      {/* Hero */}
      <section className="border-b border-[var(--dl-border)]">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-[var(--dl-accent)]">
            Trending intelligence · Updated daily
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            GitHub, translated.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--dl-body)] sm:text-xl">
            The rising open-source projects that matter — explained in plain English,
            before everyone else sees them.
          </p>

          <div className="mt-10 flex max-w-xl items-center gap-3 rounded-lg border border-[var(--dl-border)] bg-[var(--dl-surface)] px-4 py-3 transition-colors focus-within:border-[var(--dl-accent)]">
            <span className="font-mono text-sm text-[var(--dl-accent)]">❯</span>
            <input
              type="search"
              aria-label="Search repositories"
              placeholder="Search repos, topics, or owners…"
              className="w-full bg-transparent text-sm text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-[var(--dl-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--dl-muted)] sm:block">
              ⌘K
            </kbd>
          </div>
        </div>
      </section>

      {/* Trending grid */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <ALabel
          index="01"
          title="This week’s movers"
          note="Ranked by Early Signal Score — a 0–100 blend of star growth, active builders, community buzz, and commit pace. Hover any score for what it means."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <ARepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </div>
      </section>

      {/* AI commit chart */}
      <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
        <ALabel
          index="02"
          title="AI commit tracking"
          note="How much code AI tools are actually shipping — tracked daily across public GitHub."
        />
        <AChart />
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
        <ANewsletter />
      </section>

      <AFooter />
    </div>
  )
}
