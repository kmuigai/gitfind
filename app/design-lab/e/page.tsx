import { repos } from '@/components/design-lab/sample-data'
import { ENav, ETicker, ERepoRows, EStatStrip, EChart, ENewsletter, EFooter } from '@/components/design-lab/e'

export default function DesignLabE() {
  return (
    <div className="dl-e min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #0a0a0c; }'}</style>
      <ENav />
      <ETicker />

      {/* Market-header hero */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--dl-accent)]">
          OPEN SOURCE INTELLIGENCE TERMINAL
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          GITHUB, <span className="text-[var(--dl-accent)]">TRANSLATED.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--dl-body)]">
          The rising open-source projects that matter — ranked, scored, and explained
          in plain English, before everyone else sees them.
        </p>
        <div className="mt-8">
          <EStatStrip />
        </div>
      </section>

      {/* Trending panel */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <ERepoRows items={repos} />
        <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--dl-muted)]">
          SCORE /100 BLENDS STAR GROWTH, ACTIVE BUILDERS, COMMUNITY BUZZ, AND COMMIT PACE. HOVER ANY SCORE FOR THE FULL METHODOLOGY.
        </p>
      </section>

      {/* Chart */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <EChart />
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <ENewsletter />
      </section>

      <EFooter />
    </div>
  )
}
