import type { Metadata } from 'next'
import { getAICodeIndexData, getConfigAdoptionData, getSDKAdoptionData, getAgentPRData, getCommunityBuzzData, getOpenModelLayer } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import Reveal from '@/components/Reveal'
import VolumeChart from '@/components/VolumeChart'
import {
  IndexStatsStrip,
  IndexShareBar,
  RaceForSecond,
  MomentumTable,
  PRArena,
  OpenModelLayerSection,
  AdoptionTables,
  CommunityPulse,
  IntelligenceBrief,
} from '@/components/AICodeIndex'

export const metadata: Metadata = {
  title: 'AI Code Index — AI Coding Tool Adoption Tracker | GitFind',
  description:
    'Track which AI coding tools developers actually use. Daily commit volume, market share, and adoption data for Claude Code, Cursor, Copilot, and more.',
  openGraph: {
    title: 'AI Code Index — GitFind',
    description:
      'Which AI coding tool is winning? Live commit data across 7 tools on all public GitHub repos.',
    url: 'https://gitfind.ai/ai-code-index',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Code Index — GitFind',
    description: 'The rise of AI-written code, tracked live across 7 tools.',
  },
}

export const revalidate = 3600

export default async function AICodeIndexPage() {
  const [chartData, configData, sdkData, agentPRData, buzzData, modelLayer] = await Promise.all([
    getAICodeIndexData(),
    getConfigAdoptionData(),
    getSDKAdoptionData(),
    getAgentPRData(),
    getCommunityBuzzData(),
    getOpenModelLayer(),
  ])

  // Daily totals across all tracked tools, for the range-toggleable § 1 chart
  const dailyTotals = chartData.map((row) => ({
    date: row.date,
    value: Object.keys(row)
      .filter((k) => k !== 'date')
      .reduce((s, k) => s + (typeof row[k] === 'number' ? (row[k] as number) : 0), 0),
  }))

  return (
    <div>
      {/* Spec header */}
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">
            ai-written commits — tracked daily since 2025
          </p>
          <h1 className="font-display mt-4 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            THE AI CODE INDEX
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Which AI coding tool is actually winning? Daily commit volume, market
            share, and doubling time across 7 tools on all public GitHub repos.
          </p>
          <IndexStatsStrip rows={chartData} />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* fig. 01 — total volume */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 1 — total daily commit volume, all tools</p>
          <p>fig. 01</p>
        </div>
        <Reveal chart className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-4">
            <VolumeChart data={dailyTotals} />
          </div>
        </Reveal>

        {/* fig. 02 — share */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 2 — market share of ai-written commits</p>
          <p>fig. 02</p>
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-4">
            <IndexShareBar rows={chartData} />
          </div>
        </Reveal>

        {/* fig. 03 — the race for #2 */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 3 — the race for #2</p>
          <p>fig. 03</p>
        </div>
        <Reveal className="mt-4">
          <RaceForSecond rows={chartData} />
        </Reveal>

        {/* fig. 04 — momentum */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 4 — momentum, ranked</p>
          <p>fig. 04</p>
        </div>
        <Reveal className="mt-4">
          <MomentumTable rows={chartData} />
        </Reveal>

        {/* fig. 05 — the pr arena */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 5 — the pr arena</p>
          <p>fig. 05</p>
        </div>
        <Reveal className="mt-4">
          <PRArena agentPR={agentPRData} />
        </Reveal>

        {/* fig. 06 — open model layer */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 6 — the open model layer</p>
          <p>fig. 06</p>
        </div>
        <Reveal className="mt-4">
          <OpenModelLayerSection layer={modelLayer} />
        </Reveal>
        <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
          the tools above run on these. open models don’t sign their commits, so this
          layer is repo traction — not usage share. anything else would be made up.
        </p>

        {/* fig. 07 — adoption */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 7 — ecosystem adoption</p>
          <p>fig. 07</p>
        </div>
        <Reveal className="mt-4">
          <AdoptionTables config={configData} sdk={sdkData} />
        </Reveal>
        <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
          note: agents.md (an open format) beats every vendor-specific config file.
        </p>

        {/* fig. 08 — community pulse */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 8 — community pulse</p>
          <p>fig. 08</p>
        </div>
        <Reveal className="mt-4">
          <CommunityPulse buzz={buzzData} />
        </Reveal>

        {/* fig. 09 — intelligence brief */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 9 — intelligence brief</p>
          <p>fig. 09</p>
        </div>
        <Reveal className="mt-4">
          <IntelligenceBrief rows={chartData} agentPR={agentPRData} />
        </Reveal>

        <div className="mt-12">
          <NewsletterSignup />
        </div>
      </main>
    </div>
  )
}
