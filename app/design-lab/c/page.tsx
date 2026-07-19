import { repos } from '@/components/design-lab/sample-data'
import { CNav, CFooter, CMetricCards, CRepoTable, CChart, CNewsletter } from '@/components/design-lab/c'

export default function DesignLabC() {
  return (
    <div className="dl-c min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #fafafa; }'}</style>
      <CNav />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GitHub, translated.</h1>
            <p className="mt-1 text-[13px] text-[var(--dl-muted)]">
              The rising open-source projects that matter — explained in plain English.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-[var(--dl-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--dl-positive)]" />
              Updated 12 min ago
            </span>
            <div className="flex rounded-md border border-[var(--dl-border)] bg-[var(--dl-surface)] text-xs">
              {['24h', '7d', '30d'].map((r) => (
                <span
                  key={r}
                  className={`cursor-pointer px-3 py-1.5 ${
                    r === '7d'
                      ? 'bg-[var(--dl-surface-2)] font-medium text-[var(--dl-text)]'
                      : 'text-[var(--dl-muted)] hover:text-[var(--dl-text)]'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-6">
          <CMetricCards />
        </div>

        {/* Trending table */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[var(--dl-text)]">
            Trending repositories
            <span className="ml-2 font-normal text-[var(--dl-dim)]">6 projects, ranked by Early Signal Score /100</span>
          </h2>
        </div>
        <div className="mt-3">
          <CRepoTable items={repos} />
        </div>
        <p className="mt-2 text-[11px] text-[var(--dl-dim)]">
          Score blends star growth, active builders, community buzz, and commit pace. Hover any score for the full explanation.
        </p>

        {/* Chart */}
        <div className="mt-8">
          <CChart />
        </div>

        {/* Newsletter */}
        <div className="mt-8">
          <CNewsletter />
        </div>
      </main>

      <CFooter />
    </div>
  )
}
