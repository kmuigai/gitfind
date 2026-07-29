// Open Model Index — catalog sections wired to model_metrics.
// Honesty rules: hf downloads are cumulative pulls of model weights; repo
// traction is not usage share; nothing here is fabricated.

import BarChart from '@/components/charts/BarChart'
import ShareBar from '@/components/charts/ShareBar'
import SmallMultiples from '@/components/charts/SmallMultiples'
import CountUp from '@/components/CountUp'
import { formatCount } from '@/lib/design'
import { MODEL_REGISTRY, type ModelEntry } from '@/lib/models'
import type { ModelMetricRow } from '@/lib/queries'

/* --- computation helpers ---
 * hf_downloads is Hugging Face's "Downloads last month" — a trailing 30-day
 * window, NOT cumulative. The chart plots that window over time (the rate);
 * momentum/doubling measure change in the rate. Nothing here is fabricated. */

interface DayPoint {
  date: string
  value: number
}

interface ModelStat {
  key: string
  name: string
  family: string
  isRuntime: boolean
  latest: number // current trailing-30d downloads
  prev: number | null // trailing-30d downloads ~30 days ago
  delta30d: number | null // change in the 30d rate over the window
  momentumPct: number | null
  doublingDays: number | null
  share: number // share of the current 30d window across models
  rateSeries: DayPoint[] // the 30d window value per day
  ghStars: number
  ghForks: number
  ghContributors: number
}

function byModel(rows: ModelMetricRow[]): Map<string, ModelMetricRow[]> {
  const map = new Map<string, ModelMetricRow[]>()
  for (const r of rows) {
    const list = map.get(r.model_key) ?? []
    list.push(r)
    map.set(r.model_key, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  return map
}

function computeStats(rows: ModelMetricRow[]): ModelStat[] {
  const grouped = byModel(rows)
  const totalLatest = MODEL_REGISTRY.reduce((sum, m) => {
    const series = grouped.get(m.key) ?? []
    return sum + (series[series.length - 1]?.hf_downloads ?? 0)
  }, 0) || 1

  return MODEL_REGISTRY.map((m) => {
    const series = grouped.get(m.key) ?? []
    const latestRow = series[series.length - 1]
    const prevRow = series.length > 1 ? series[Math.max(0, series.length - 31)] : null
    const latest = latestRow?.hf_downloads ?? 0
    const prev = prevRow?.hf_downloads ?? null
    const delta30d = prev != null && series.length > 1 ? latest - prev : null
    const momentumPct = delta30d != null && prev != null && prev > 0 ? Math.round((delta30d / prev) * 100) : null
    const doublingDays =
      delta30d != null && prev != null && prev > 0 && latest > prev
        ? Math.round(((series.length - 1) * Math.LN2) / Math.log(latest / prev))
        : null
    return {
      key: m.key,
      name: m.name,
      family: m.family,
      isRuntime: m.family === 'runtime',
      latest,
      prev,
      delta30d,
      momentumPct,
      doublingDays,
      share: (latest / totalLatest) * 100,
      rateSeries: series.map((r) => ({ date: r.snapshot_date, value: r.hf_downloads })),
      ghStars: latestRow?.gh_stars ?? 0,
      ghForks: latestRow?.gh_forks ?? 0,
      ghContributors: latestRow?.gh_contributors ?? 0,
    }
  })
}

function totalRateSeries(stats: ModelStat[]): DayPoint[] {
  const totals = new Map<string, number>()
  for (const m of stats) {
    if (m.isRuntime) continue
    for (const p of m.rateSeries) totals.set(p.date, (totals.get(p.date) ?? 0) + p.value)
  }
  return [...totals.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

function hasData(rows: ModelMetricRow[]): boolean {
  return computeStats(rows).some((m) => m.latest > 0 || m.ghStars > 0)
}

/* --- header strip --- */

export function ModelStatsStrip({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
  if (!hasData(rows)) return null
  const total30d = stats.filter((m) => !m.isRuntime).reduce((s, m) => s + m.latest, 0)
  const leader = stats.filter((m) => !m.isRuntime).sort((a, b) => b.latest - a.latest)[0]
  const fastest = stats
    .filter((m) => m.doublingDays != null)
    .sort((a, b) => (a.doublingDays ?? 0) - (b.doublingDays ?? 0))[0]
  const modelCount = stats.filter((m) => !m.isRuntime).length

  return (
    <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11.5px]">
      <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
        30-day pulls: <b className="text-[var(--ink)]"><CountUp value={total30d} /></b>
      </span>
      <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
        models tracked: <b className="text-[var(--ink)]">{modelCount} + {stats.length - modelCount} runtimes</b>
      </span>
      {leader ? (
        <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
          leader: <b className="text-[var(--ink)]">{leader.name} {formatCount(leader.latest)}/30d</b>
        </span>
      ) : null}
      {fastest ? (
        <span className="border-2 border-[var(--line)] bg-[var(--accent)] px-3 py-1.5 font-bold text-[var(--ink)]">
          fastest riser: {fastest.name} · {fastest.doublingDays}d
        </span>
      ) : null}
    </div>
  )
}

/* --- fig. 01: the 30-day download window, daily --- */

export function ModelVolumeChart({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
  const totals = totalRateSeries(stats)
  if (totals.length >= 2) {
    return (
      <BarChart
        data={totals.map((p) => ({ label: shortDate(p.date), value: p.value }))}
        ariaLabel="Hugging Face trailing 30-day weight downloads per day across tracked open models"
        labelEvery={Math.max(1, Math.floor(totals.length / 8))}
      />
    )
  }

  // Day-1 fallback: the current 30-day window, ranked (rate bars start tomorrow)
  const ranked = stats
    .filter((m) => !m.isRuntime && m.latest > 0)
    .sort((a, b) => b.latest - a.latest)
  if (ranked.length === 0) {
    return (
      <p className="font-mono text-[12px] text-[var(--muted)]">
        collecting daily snapshots — the chart fills in as they accrue.
      </p>
    )
  }
  const max = ranked[0].latest || 1
  return (
    <div className="font-mono text-[12px]">
      {ranked.map((m) => (
        <div key={m.key} className="flex items-center gap-3 py-1.5">
          <span className="w-32 shrink-0 truncate text-[var(--body)]">{m.name}</span>
          <span className="h-2.5 min-w-0 flex-1">
            <span className="block h-full bg-[var(--ink)]" style={{ width: `${Math.max((m.latest / max) * 100, 2)}%` }} />
          </span>
          <span className="shrink-0 font-bold tabular-nums text-[var(--ink)]">{formatCount(m.latest)}</span>
        </div>
      ))}
      <p className="mt-3 text-[11px] text-[var(--muted)]">
        trailing 30-day weight pulls, ranked · the rate chart starts tomorrow as snapshots accrue.
      </p>
    </div>
  )
}

/* --- fig. 02: share of the 30-day window --- */

export function ModelShareBar({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
    .filter((m) => !m.isRuntime && m.latest > 0)
    .sort((a, b) => b.latest - a.latest)
  if (stats.length === 0) {
    return (
      <p className="font-mono text-[12px] text-[var(--muted)]">
        share computes once snapshots exist — check back as data accrues.
      </p>
    )
  }
  const hasDelta = stats.some((m) => m.delta30d != null)
  return (
    <div>
      <ShareBar
        segments={stats.map((m) => ({ label: m.name, value: m.latest }))}
        ariaLabel="Share of trailing 30-day Hugging Face weight downloads by model"
      />
      <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
        share of the trailing 30-day window{hasDelta ? '' : ' today · tracks how it shifts as snapshots accrue'}.
      </p>
    </div>
  )
}

/* --- fig. 03: per-model small multiples (same scale) --- */

export function ModelSmallMultiples({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
    .filter((m) => !m.isRuntime && m.rateSeries.length > 1)
    .sort((a, b) => b.latest - a.latest)
  if (stats.length === 0) return null

  const bucketed = stats.map((m) => ({
    name: m.name,
    values: Array.from({ length: Math.ceil(m.rateSeries.length / 3) }, (_, b) =>
      m.rateSeries.slice(b * 3, b * 3 + 3).reduce((s, p) => s + p.value, 0) / Math.min(3, m.rateSeries.length - b * 3)
    ),
    caption: `${formatCount(m.latest)}/30d${m.momentumPct != null ? ` · ${m.momentumPct >= 0 ? '▲' : '▼'} ${Math.abs(m.momentumPct)}%` : ''}`,
  }))

  return (
    <SmallMultiples
      series={bucketed}
      note="trailing 30-day weight downloads per day, averaged over 3-day buckets · all charts share one scale."
    />
  )
}

/* --- fig. 04: momentum, ranked --- */

export function ModelMomentumTable({ rows }: { rows: ModelMetricRow[] }) {
  const ranked = computeStats(rows)
    .filter((m) => !m.isRuntime && m.delta30d != null)
    .sort((a, b) => (b.momentumPct ?? 0) - (a.momentumPct ?? 0))
  if (ranked.length === 0) {
    return (
      <p className="font-mono text-[12px] text-[var(--muted)]">
        momentum ranks once a second snapshot lands — the window comparison begins tomorrow.
      </p>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto border-2 border-[var(--line)] bg-[var(--paper)] sm:block">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="border-b-2 border-[var(--line)] text-left text-[11px] text-[var(--muted)]">
              <th className="px-3 py-2 font-normal">no.</th>
              <th className="px-3 py-2 font-normal">model</th>
              <th className="px-3 py-2 text-right font-normal">downloads (30d)</th>
              <th className="px-3 py-2 text-right font-normal">Δ vs 30d ago</th>
              <th className="px-3 py-2 text-right font-normal">momentum</th>
              <th className="px-3 py-2 text-right font-normal">doubles every</th>
              <th className="px-3 py-2 text-right font-normal">share</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((m, i) => (
              <tr key={m.key} className="border-b border-dashed border-[var(--line-soft)] last:border-0">
                <td className="px-3 py-2 text-[var(--muted)]">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-3 py-2 font-bold text-[var(--ink)]">
                  {m.name}
                  {i === 0 ? (
                    <span className="ml-2 border border-[var(--line)] bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--ink)]">
                      fastest
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">{formatCount(m.latest)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">
                  {m.delta30d != null ? `${m.delta30d >= 0 ? '+' : '−'}${formatCount(Math.abs(m.delta30d))}` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">
                  {m.momentumPct != null ? `${m.momentumPct >= 0 ? '▲' : '▼'} ${Math.abs(m.momentumPct)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">
                  {m.doublingDays != null ? `${m.doublingDays} days` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">{m.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 sm:hidden">
        {ranked.map((m, i) => (
          <li key={m.key} className="border-2 border-[var(--line)] bg-[var(--paper)] p-3 font-mono text-[12px]">
            <p className="font-bold text-[var(--ink)]">
              <span className="mr-2 font-normal text-[var(--muted)]">{String(i + 1).padStart(2, '0')}</span>
              {m.name}
              {i === 0 ? (
                <span className="ml-2 border border-[var(--line)] bg-[var(--accent)] px-1 text-[10px]">fastest</span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[var(--body)]">
              {formatCount(m.latest)}/30d ·{' '}
              {m.momentumPct != null ? `${m.momentumPct >= 0 ? '▲' : '▼'} ${Math.abs(m.momentumPct)}%` : '—'} ·{' '}
              {m.doublingDays != null ? `${m.doublingDays}d to double` : '—'} · {m.share.toFixed(1)}%
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

/* --- fig. 05: the runtime layer --- */

export function ModelRuntimeLayer({ rows }: { rows: ModelMetricRow[] }) {
  const runtimes = computeStats(rows)
    .filter((m) => m.isRuntime && m.ghStars > 0)
    .sort((a, b) => b.ghStars - a.ghStars)
  if (runtimes.length === 0) return null

  return (
    <div className="border-2 border-[var(--line)] bg-[var(--paper)]">
      <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
        fig. 05 — the runtime layer (what people run open models with)
      </p>
      <div className="overflow-x-auto p-4">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[11px] text-[var(--muted)]">
              <th className="py-1 pr-3 font-normal">tool</th>
              <th className="py-1 pr-3 text-right font-normal">stars</th>
              <th className="py-1 pr-3 text-right font-normal">forks</th>
              <th className="py-1 text-right font-normal">contributors</th>
            </tr>
          </thead>
          <tbody>
            {runtimes.map((m) => (
              <tr key={m.key} className="border-t border-dashed border-[var(--line-soft)]">
                <td className="py-1.5 pr-3 font-bold text-[var(--ink)]">{m.name}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--body)]">{formatCount(m.ghStars)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--body)]">{formatCount(m.ghForks)}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--body)]">
                  {m.ghContributors > 0 ? formatCount(m.ghContributors) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t-2 border-[var(--line)] px-4 py-2.5 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
        runtimes don’t publish weight downloads — repo traction is the honest proxy here.
      </p>
    </div>
  )
}

/* --- fig. 06: intelligence brief --- */

export function ModelBrief({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
  if (!hasData(rows)) return null
  const leader = stats.filter((m) => !m.isRuntime).sort((a, b) => b.latest - a.latest)[0]
  const biggestGain = stats
    .filter((m) => m.delta30d != null)
    .sort((a, b) => (b.delta30d ?? 0) - (a.delta30d ?? 0))[0]
  const fastest = stats
    .filter((m) => m.doublingDays != null)
    .sort((a, b) => (a.doublingDays ?? 0) - (b.doublingDays ?? 0))[0]
  const runtimeLeader = stats.filter((m) => m.isRuntime).sort((a, b) => b.ghStars - a.ghStars)[0]

  const lines = [
    `${stats.filter((m) => !m.isRuntime).length} open models + ${stats.filter((m) => m.isRuntime).length} runtimes tracked — hf trailing-30d downloads + github velocity, nothing fabricated`,
    ...(leader ? [`${leader.name} leads the 30-day window at ${formatCount(leader.latest)}`] : []),
    ...(biggestGain ? [`${biggestGain.name} gained the most rate this month — ${biggestGain.delta30d != null && biggestGain.delta30d >= 0 ? '+' : '−'}${formatCount(Math.abs(biggestGain.delta30d ?? 0))} on the 30d window`] : []),
    ...(fastest ? [`${fastest.name} is the fastest riser — doubling every ${fastest.doublingDays} days at current pace`] : []),
    ...(runtimeLeader ? [`${runtimeLeader.name} leads the runtime layer at ${formatCount(runtimeLeader.ghStars)}★`] : []),
    'router share coming when there’s a stable public source — we don’t scrape',
  ]

  return (
    <div className="border-2 border-[var(--line)] bg-[var(--ink)] p-4 font-mono text-[12px] leading-[1.9] text-[var(--paper)]">
      <p className="text-[var(--accent)]">$ tail -f /var/log/gitfind/models.log</p>
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

export function registryEntry(key: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.key === key)
}
