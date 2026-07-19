// AI Code Index — catalog sections wired to the real BigQuery aggregate data.
// 1-bit multi-series strategy: hatch patterns by rank, solid ink for totals,
// genuinely same-scale small multiples, computed leader/fastest tags.

import ShareBar from '@/components/charts/ShareBar'
import SmallMultiples from '@/components/charts/SmallMultiples'
import CountUp from '@/components/CountUp'
import { formatCount } from '@/lib/design'
import type { AICodeIndexRow, ConfigAdoptionRow } from '@/lib/queries'

/* --- computation helpers --- */

const DAYS = 30

function toolNames(rows: AICodeIndexRow[]): string[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0]).filter((k) => k !== 'date')
}

function val(row: AICodeIndexRow, tool: string): number {
  const v = row[tool]
  return typeof v === 'number' ? v : 0
}

interface ToolStat {
  tool: string
  name: string
  latest: number
  prev: number
  momentum: number | null // null when prev is 0 (new tool)
  share: number
  doublingDays: number | null
  buckets: number[]
  maxEver: number
  hasSignal: boolean // commits are actually measurable for this tool
}

function computeStats(rows: AICodeIndexRow[]): ToolStat[] {
  const window = rows.slice(-DAYS)
  if (window.length === 0) return []
  const lastRow = window[window.length - 1]
  const firstRow = window[0]
  const totalLatest = toolNames(rows).reduce((s, t) => s + val(lastRow, t), 0) || 1

  return toolNames(rows).map((tool) => {
    const latest = val(lastRow, tool)
    const prev = val(firstRow, tool)
    const momentum = prev > 0 ? Math.round(((latest - prev) / prev) * 100) : null
    const doublingDays =
      prev > 0 && latest > prev
        ? Math.round(((window.length - 1) * Math.LN2) / Math.log(latest / prev))
        : null
    const buckets = Array.from({ length: 10 }, (_, b) =>
      window.slice(b * 3, b * 3 + 3).reduce((s, r) => s + val(r, tool), 0)
    )
    const maxEver = rows.reduce((m, r) => Math.max(m, val(r, tool)), 0)
    return {
      tool,
      name: tool.toLowerCase(),
      latest,
      prev,
      momentum,
      share: (latest / totalLatest) * 100,
      doublingDays,
      buckets,
      maxEver,
      // Some tools (Copilot, Devin) don't sign commits — a handful of stray
      // attributions isn't a signal, it's noise. 100/day ever is the bar.
      hasSignal: maxEver >= 100,
    }
  })
}

/* --- header strip --- */

export function IndexStatsStrip({ rows }: { rows: AICodeIndexRow[] }) {
  const stats = computeStats(rows)
  if (stats.length === 0) return null
  const withSignal = stats.filter((t) => t.hasSignal)
  const total = stats.reduce((s, t) => s + t.latest, 0)
  const leader = [...stats].sort((a, b) => b.latest - a.latest)[0]
  const fastest = withSignal.filter((t) => t.doublingDays != null).sort((a, b) => (a.doublingDays ?? 0) - (b.doublingDays ?? 0))[0]

  return (
    <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11.5px]">
      <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
        commits yesterday: <b className="text-[var(--ink)]"><CountUp value={total} /></b>
      </span>
      <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
        with commit signal: <b className="text-[var(--ink)]">{withSignal.length} of {stats.length}</b>
      </span>
      <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
        leader: <b className="text-[var(--ink)]">{leader.name} {leader.share.toFixed(0)}%</b>
      </span>
      {fastest ? (
        <span className="border-2 border-[var(--line)] bg-[var(--accent)] px-3 py-1.5 font-bold text-[var(--ink)]">
          fastest doubler: {fastest.name} · {fastest.doublingDays}d
        </span>
      ) : null}
    </div>
  )
}

/* --- fig. 02: market share (commit-signing tools only) --- */

export function IndexShareBar({ rows }: { rows: AICodeIndexRow[] }) {
  const stats = computeStats(rows)
    .filter((t) => t.hasSignal)
    .sort((a, b) => b.latest - a.latest)
  if (stats.length === 0) return null
  const top = stats.slice(0, 4)
  const rest = stats.slice(4)
  const segments = top.map((t) => ({ label: t.name, value: t.latest }))
  if (rest.length > 0) {
    segments.push({ label: rest.map((t) => t.name).join(' + '), value: rest.reduce((s, t) => s + t.latest, 0) })
  }
  return <ShareBar segments={segments} ariaLabel="Market share of AI-written commits by tool" />
}

/* --- fig. 03: the race for #2 (leader excluded, one shared scale) --- */

export function RaceForSecond({ rows }: { rows: AICodeIndexRow[] }) {
  const stats = computeStats(rows)
    .filter((t) => t.hasSignal)
    .sort((a, b) => b.latest - a.latest)
    .slice(1) // drop the leader — the interesting race is everything below it
  if (stats.length === 0) return null
  return (
    <SmallMultiples
      series={stats.map((t) => ({
        name: t.name,
        values: t.buckets,
        caption: `${formatCount(t.latest)}/day · ${t.momentum != null ? `${t.momentum >= 0 ? '▲' : '▼'} ${Math.abs(t.momentum)}%` : 'new'}`,
      }))}
      note="claude code owns the index, so it's out of this grid — one shared scale for everyone else."
    />
  )
}

/* --- fig. 04: momentum table (signal tools only) --- */

export function MomentumTable({ rows }: { rows: AICodeIndexRow[] }) {
  const ranked = computeStats(rows)
    .filter((t) => t.hasSignal)
    .sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0))
  if (ranked.length === 0) return null
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto border-2 border-[var(--line)] bg-[var(--paper)] sm:block">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="border-b-2 border-[var(--line)] text-left text-[11px] text-[var(--muted)]">
              <th className="px-3 py-2 font-normal">no.</th>
              <th className="px-3 py-2 font-normal">tool</th>
              <th className="px-3 py-2 text-right font-normal">momentum 30d</th>
              <th className="px-3 py-2 text-right font-normal">commits/day</th>
              <th className="px-3 py-2 text-right font-normal">doubles every</th>
              <th className="px-3 py-2 text-right font-normal">share</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((t, i) => (
              <tr key={t.tool} className="border-b border-dashed border-[var(--line-soft)] last:border-0">
                <td className="px-3 py-2 text-[var(--muted)]">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-3 py-2 font-bold text-[var(--ink)]">
                  {t.name}
                  {i === 0 ? (
                    <span className="ml-2 border border-[var(--line)] bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--ink)]">
                      fastest
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right text-[var(--body)]">
                  {t.momentum != null ? `${t.momentum >= 0 ? '▲' : '▼'} ${Math.abs(t.momentum)}%` : 'new'}
                </td>
                <td className="px-3 py-2 text-right text-[var(--body)]">{formatCount(t.latest)}</td>
                <td className="px-3 py-2 text-right text-[var(--body)]">
                  {t.doublingDays != null ? `${t.doublingDays} days` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-[var(--body)]">{t.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="space-y-3 sm:hidden">
        {ranked.map((t, i) => (
          <li key={t.tool} className="border-2 border-[var(--line)] bg-[var(--paper)] p-3 font-mono text-[12px]">
            <p className="font-bold text-[var(--ink)]">
              <span className="mr-2 font-normal text-[var(--muted)]">{String(i + 1).padStart(2, '0')}</span>
              {t.name}
              {i === 0 ? (
                <span className="ml-2 border border-[var(--line)] bg-[var(--accent)] px-1 text-[10px]">fastest</span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[var(--body)]">
              {t.momentum != null ? `${t.momentum >= 0 ? '▲' : '▼'} ${Math.abs(t.momentum)}%` : 'new'} · {formatCount(t.latest)}/day ·{' '}
              {t.doublingDays != null ? `${t.doublingDays}d to double` : '—'} · {t.share.toFixed(1)}%
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

/* --- fig. 05: the open model layer --- */

import Link from 'next/link'
import { tierFor, tierExplainer, SCORE_EXPLAINER } from '@/lib/design'
import type { RepoWithEnrichment } from '@/lib/database.types'
import type { OpenModelLayer } from '@/lib/queries'

function tierChipClass(tier: string): string {
  if (tier === 'Breakout') return 'bg-[var(--tier-breakout)]'
  if (tier === 'Hot') return 'bg-[var(--tier-hot)]'
  return 'bg-[var(--tier-active)]'
}

function ModelRow({ repo }: { repo: RepoWithEnrichment }) {
  const score = repo.enrichment?.early_signal_score
  const tier = score != null ? tierFor(score) : null
  const oneLiner = repo.enrichment?.summary ?? repo.description ?? ''
  return (
    <li>
      <Link
        href={`/project/${repo.owner}/${repo.name}`}
        className="grid grid-cols-1 gap-1 border-b border-dashed border-[var(--line-soft)] px-4 py-2.5 font-mono last:border-0 hover:bg-[var(--ink)] hover:text-[var(--paper)] sm:grid-cols-[minmax(0,1.4fr)_auto_90px] sm:items-center sm:gap-3"
      >
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold">
            {repo.owner}/{repo.name}
          </span>
          {oneLiner ? (
            <span className="mt-0.5 block truncate text-[11px] opacity-70">{oneLiner}</span>
          ) : null}
        </span>
        <span
          className="flex items-center gap-2 text-[11px]"
          title={score != null && tier ? `Early Signal Score: ${score}/100 — ${tier}. ${tierExplainer(tier)}. ${SCORE_EXPLAINER}` : 'Not yet scored'}
        >
          {score != null && tier ? (
            <>
              <b>{score}<span className="font-normal opacity-60">/100</span></b>
              <span className={`px-1 text-[9px] font-bold uppercase tracking-wider text-[var(--paper)] ${tierChipClass(tier)}`}>
                {tier}
              </span>
            </>
          ) : (
            <span className="opacity-60">—</span>
          )}
        </span>
        <span className="text-[11px] opacity-80 sm:text-right">
          {formatCount(repo.stars)}★ · {formatCount(repo.forks)}⑂
        </span>
      </Link>
    </li>
  )
}

export function OpenModelLayerSection({ layer }: { layer: OpenModelLayer }) {
  if (layer.models.length === 0 && layer.runtime.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {layer.models.length > 0 ? (
        <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
          <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
            models — release artifacts (big stars, low velocity)
          </p>
          <ul>
            {layer.models.map((r) => (
              <ModelRow key={r.id} repo={r} />
            ))}
          </ul>
        </div>
      ) : null}
      {layer.runtime.length > 0 ? (
        <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
          <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
            runtime — where open-model energy lives
          </p>
          <ul>
            {layer.runtime.map((r) => (
              <ModelRow key={r.id} repo={r} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/* --- fig. 05: the PR arena (where Copilot and Devin actually compete) --- */

export function PRArena({ agentPR }: { agentPR: ConfigAdoptionRow[] }) {
  const data = latestByTool(agentPR).slice(0, 6)
  if (data.length === 0) return null
  const max = data[0].count || 1
  return (
    <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
      <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
        fig. 05 — autonomous agent prs, all time
      </p>
      <div className="p-4 font-mono text-[12px]">
        {data.map((d, i) => (
          <div key={d.tool} className="flex items-center gap-3 border-b border-dashed border-[var(--line-soft)] py-2 last:border-0">
            <span className="w-6 shrink-0 text-[var(--muted)]">{String(i + 1).padStart(2, '0')}</span>
            <span className="w-32 shrink-0 truncate font-bold text-[var(--ink)] sm:w-40">{d.tool}</span>
            <span className="h-2.5 min-w-0 flex-1">
              <span className="block h-full bg-[var(--ink)]" style={{ width: `${Math.max((d.count / max) * 100, 2)}%` }} />
            </span>
            <span className="shrink-0 font-bold text-[var(--ink)]">{formatCount(d.count)}</span>
          </div>
        ))}
      </div>
      <p className="border-t-2 border-[var(--line)] px-4 py-2.5 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
        github copilot and devin don’t sign their commits, so they score zero in the
        charts above. zero there isn’t absence — it’s invisibility. this is their arena.
      </p>
    </div>
  )
}

/* --- fig. 07: adoption tables (config files, SDKs) --- */

function latestByTool(rows: ConfigAdoptionRow[]): { tool: string; count: number }[] {
  const latest = new Map<string, number>()
  const dates = rows.map((r) => r.date).sort()
  const latestDate = dates[dates.length - 1]
  for (const r of rows) {
    if (r.date === latestDate) latest.set(r.tool, r.count)
  }
  return Array.from(latest.entries())
    .map(([tool, count]) => ({ tool: tool.toLowerCase(), count }))
    .sort((a, b) => b.count - a.count)
}

function AdoptionTable({ title, rows }: { title: string; rows: ConfigAdoptionRow[] }) {
  const data = latestByTool(rows).slice(0, 8)
  if (data.length === 0) return null
  const max = data[0].count || 1
  return (
    <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
      <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">{title}</p>
      <div className="p-4 font-mono text-[12px]">
        {data.map((d) => (
          <div key={d.tool} className="flex items-center gap-3 py-1.5">
            <span className="w-28 shrink-0 truncate text-[var(--body)] sm:w-36">{d.tool}</span>
            <span className="h-2.5 min-w-0 flex-1">
              <span className="block h-full bg-[var(--ink)]" style={{ width: `${Math.max((d.count / max) * 100, 2)}%` }} />
            </span>
            <span className="shrink-0 font-bold text-[var(--ink)]">{formatCount(d.count)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdoptionTables({
  config,
  sdk,
}: {
  config: ConfigAdoptionRow[]
  sdk: ConfigAdoptionRow[]
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <AdoptionTable title="config files in repos" rows={config} />
      <AdoptionTable title="sdk / package adoption" rows={sdk} />
    </div>
  )
}

/* --- fig. 06: community pulse --- */

export function CommunityPulse({
  buzz,
}: {
  buzz: Array<{ tool: string; mentions: number; hn: number; reddit: number; ghDiscussions: number }>
}) {
  const ranked = [...buzz].sort((a, b) => b.mentions - a.mentions).slice(0, 7)
  if (ranked.length === 0) return null
  const max = ranked[0].mentions || 1
  return (
    <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
      <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
        fig. 08 — community pulse, 7 days
      </p>
      <div className="overflow-x-auto p-4">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[11px] text-[var(--muted)]">
              <th className="py-1 pr-3 font-normal">tool</th>
              <th className="py-1 pr-3 font-normal">mentions</th>
              <th className="py-1 pr-3 text-right font-normal">hn</th>
              <th className="py-1 pr-3 text-right font-normal">reddit</th>
              <th className="py-1 text-right font-normal">github</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((b) => (
              <tr key={b.tool} className="border-t border-dashed border-[var(--line-soft)]">
                <td className="py-1.5 pr-3 font-bold text-[var(--ink)]">{b.tool.toLowerCase()}</td>
                <td className="py-1.5 pr-3">
                  <span className="mr-2 inline-block h-2.5 bg-[var(--ink)] align-middle" style={{ width: `${Math.max((b.mentions / max) * 80, 2)}px` }} />
                  <span className="text-[var(--body)]">{formatCount(b.mentions)}</span>
                </td>
                <td className="py-1.5 pr-3 text-right text-[var(--body)]">{formatCount(b.hn)}</td>
                <td className="py-1.5 pr-3 text-right text-[var(--body)]">{formatCount(b.reddit)}</td>
                <td className="py-1.5 text-right text-[var(--body)]">{formatCount(b.ghDiscussions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --- fig. 09: intelligence brief --- */

export function IntelligenceBrief({
  rows,
  agentPR,
}: {
  rows: AICodeIndexRow[]
  agentPR: ConfigAdoptionRow[]
}) {
  const stats = computeStats(rows)
  if (stats.length === 0) return null
  const withSignal = stats.filter((t) => t.hasSignal)
  const leader = [...stats].sort((a, b) => b.latest - a.latest)[0]
  const fastest = withSignal.filter((t) => t.doublingDays != null).sort((a, b) => (a.doublingDays ?? 0) - (b.doublingDays ?? 0))[0]
  const biggestGain = withSignal.sort((a, b) => b.latest - b.prev - (a.latest - a.prev))[0]
  const decliner = withSignal
    .filter((t) => t.momentum != null && t.momentum < -10)
    .sort((a, b) => (a.momentum ?? 0) - (b.momentum ?? 0))[0]
  const total = stats.reduce((s, t) => s + t.latest, 0)
  const prLeader = latestByTool(agentPR)[0]

  const lines = [
    `index sync completed — ${formatCount(total)} commits counted across ${withSignal.length} of ${stats.length} tools`,
    `${leader.name} leads the index at ${leader.share.toFixed(1)}% of ai-written commits`,
    `${biggestGain.name} added ${formatCount(Math.max(biggestGain.latest - biggestGain.prev, 0))}/day this month — biggest absolute gain`,
    ...(fastest ? [`${fastest.name} is the fastest doubler — every ${fastest.doublingDays} days at current pace`] : []),
    ...(prLeader
      ? [`${prLeader.tool} leads the pr arena with ${formatCount(prLeader.count)} agent prs — without signing a single commit`]
      : []),
    ...(decliner
      ? [`${decliner.name} down ${Math.abs(decliner.momentum ?? 0)}% this month — watching for a floor`]
      : []),
  ]

  return (
    <div className="border-2 border-[var(--line)] bg-[var(--ink)] p-4 font-mono text-[12px] leading-[1.9] text-[var(--paper)]">
      <p className="text-[var(--accent)]">$ tail -f /var/log/gitfind/index.log</p>
      {lines.map((l, i) => (
        <p key={l}>
          09:41:0{i + 2} {l}
        </p>
      ))}
      <p>
        09:41:0{lines.length + 2} <span className="blink">█</span>
      </p>
    </div>
  )
}
