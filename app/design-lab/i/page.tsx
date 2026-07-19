import Link from 'next/link'
import { repos } from '@/components/design-lab/sample-data'
import { ITicker, IHeader, IHero, IRepoEntry, IChart, INewsletter, IFooter } from '@/components/design-lab/i'

export default function DesignLabI() {
  return (
    <div className="dl-i min-h-screen bg-[var(--dl-paper)] text-[var(--dl-ink)]">
      <style>{'body { background: #f4f1e6; }'}</style>
      <ITicker />
      <IHeader />
      <IHero />

      {/* catalog */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 1 — this week’s movers</p>
          <p>6 entries · sorted by score</p>
        </div>
        <div className="mt-5 space-y-6">
          {repos.map((repo, i) => (
            <IRepoEntry key={`${repo.owner}/${repo.name}`} repo={repo} index={i} />
          ))}
        </div>

        <p className="mt-8 font-mono text-[11px] leading-relaxed text-[var(--dl-muted)]">
          scores are out of 100 and explain themselves: 70+ breakout, 40–69 hot, under
          40 active. hover any gauge for the full methodology.
        </p>

        {/* chart */}
        <div className="mt-10 flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 2 — machine output</p>
          <Link href="/design-lab/i/ai-index" className="dl-invert-hover px-1 text-[var(--dl-ink)]">
            see the full ai code index →
          </Link>
        </div>
        <div className="mt-5">
          <IChart />
        </div>

        {/* newsletter */}
        <div className="mt-10">
          <INewsletter />
        </div>
      </main>

      <IFooter />
    </div>
  )
}
