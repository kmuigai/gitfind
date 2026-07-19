import { repos } from '@/components/design-lab/sample-data'
import { FNav, FWordmark, FDivider, FRepoCard, FChart, FNewsletter, FFooter } from '@/components/design-lab/f'

export default function DesignLabF() {
  return (
    <div className="dl-f min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #0e0e28; }'}</style>
      <FNav />

      {/* BBS welcome screen */}
      <section className="border-b border-[var(--dl-border)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-12 text-center sm:px-6 sm:pt-16">
          <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--dl-muted)]">
            ● CONNECTED · NODE 7 · 2,847 FILES ONLINE
          </p>
          <FWordmark className="mx-auto mt-8 inline-block text-left" />
          <h1 className="mt-8 font-mono text-3xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            GITHUB, <span className="text-[var(--dl-accent)]">TRANSLATED</span>
            <span className="text-[var(--dl-magenta)]">.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl font-mono text-[13px] leading-[1.8] text-[var(--dl-body)]">
            The rising open-source projects that matter — explained in plain
            English, before everyone else sees them.
          </p>
          <p className="mt-8 font-mono text-[11px] tracking-[0.25em] text-[var(--dl-yellow)]">
            <span className="dl-blink">▼</span> THIS WEEK’S MOVERS <span className="dl-blink">▼</span>
          </p>
        </div>
      </section>

      {/* Trending grid */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <FDivider label="THIS WEEK’S MOVERS" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <FRepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </div>
        <p className="mt-6 text-center font-mono text-[10px] leading-relaxed tracking-wider text-[var(--dl-muted)]">
          SCORE /100 BLENDS STAR GROWTH, ACTIVE BUILDERS, COMMUNITY BUZZ, AND COMMIT PACE — HOVER ANY GAUGE FOR DETAILS.
        </p>
      </section>

      {/* Chart */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <FDivider label="AI COMMIT TRACKING" />
        <FChart />
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <FNewsletter />
      </section>

      <FFooter />
    </div>
  )
}
