import { repos } from '@/components/design-lab/sample-data'
import { BNav, BFooter, BSectionHeader, BRepoCard, BChart, BNewsletter } from '@/components/design-lab/b'

export default function DesignLabB() {
  return (
    <div className="dl-b min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #faf9f6; }'}</style>
      <BNav />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-5 pb-14 pt-14 text-center sm:px-8 sm:pb-20 sm:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--dl-accent)]">
          The open-source briefing
        </p>
        <h1 className="dl-serif mt-5 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          GitHub, <em className="text-[var(--dl-accent)]">translated.</em>
        </h1>
        <p className="dl-serif mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-[var(--dl-body)] sm:text-[22px]">
          The rising open-source projects that matter — explained in plain English,
          before everyone else sees them.
        </p>
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dl-muted)]">
          2,847 projects tracked · 6 moving this week · Updated Jul 19, 2026
        </p>
      </section>

      {/* Trending grid */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
        <BSectionHeader
          kicker="This week"
          title="The movers"
          lede="Ranked by Early Signal Score — a 0–100 blend of star growth, active builders, community buzz, and commit pace. Every score explains itself."
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <BRepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </div>
      </section>

      {/* Chart of the week */}
      <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8 sm:pb-24">
        <BSectionHeader
          kicker="Chart of the week"
          title="AI commit tracking"
          lede="How much code AI tools are actually shipping — tracked daily across public GitHub."
        />
        <BChart />
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-4xl px-5 pb-20 sm:px-8 sm:pb-28">
        <BNewsletter />
      </section>

      <BFooter />
    </div>
  )
}
