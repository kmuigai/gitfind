import Link from 'next/link'
import { ITicker, IHeader, INewsletter, IFooter } from '@/components/design-lab/i'
import {
  IIndexStatsStrip,
  ITotalChart,
  IShareBar,
  ISmallMultiples,
  IMomentumTable,
  IBriefLog,
} from '@/components/design-lab/i-index'

export default function DesignLabIAiIndex() {
  return (
    <div className="dl-i min-h-screen bg-[var(--dl-paper)] text-[var(--dl-ink)]">
      <style>{'body { background: #f4f1e6; }'}</style>
      <ITicker />
      <IHeader active="ai-index" />

      {/* spec header */}
      <div className="dl-halftone border-b-2 border-[var(--dl-line)]">
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-8 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--dl-muted)]" aria-label="Breadcrumb">
            <Link href="/design-lab/i" className="dl-invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--dl-ink)]">the ai code index</span>
          </nav>
          <h1 className="dl-pixel mt-5 text-2xl font-bold text-[var(--dl-ink)] sm:text-4xl">
            THE AI CODE INDEX
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[13px] leading-[1.8] text-[var(--dl-body)]">
            which ai coding tool is actually winning? daily commit volume, market
            share, and doubling time across 7 tools on all public github repos.
            tracked since 2025.
          </p>
          <IIndexStatsStrip />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* fig. 01 — total volume */}
        <div className="flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 1 — total daily commit volume, all tools</p>
          <p>fig. 01</p>
        </div>
        <div className="mt-4 border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] p-4">
          <ITotalChart />
        </div>

        {/* fig. 02 — share */}
        <div className="mt-10 flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 2 — market share of ai-written commits</p>
          <p>fig. 02</p>
        </div>
        <div className="mt-4 border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] p-4">
          <IShareBar />
        </div>

        {/* fig. 03 — small multiples */}
        <div className="mt-10 flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 3 — each tool, same scale</p>
          <p>fig. 03</p>
        </div>
        <div className="mt-4">
          <ISmallMultiples />
        </div>

        {/* fig. 04 — momentum */}
        <div className="mt-10 flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 4 — momentum, ranked</p>
          <p>fig. 04</p>
        </div>
        <div className="mt-4">
          <IMomentumTable />
        </div>

        {/* fig. 05 — intelligence brief */}
        <div className="mt-10 flex items-baseline justify-between font-mono text-[12px] text-[var(--dl-muted)]">
          <p>§ 5 — intelligence brief</p>
          <p>fig. 05</p>
        </div>
        <div className="mt-4">
          <IBriefLog />
        </div>

        <div className="mt-10">
          <INewsletter />
        </div>
      </main>

      <IFooter />
    </div>
  )
}
