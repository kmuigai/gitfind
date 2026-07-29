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

/* --- computation helpers --- */

interface DayPoint {
  date: string
  value: number
}

interface ModelStat {
  key: string
  name: string
  family: string
  isRuntime: boolean
  latestCum: number
  prevCum: number | null
  delta30d: number | null // new downloads in the last 30 days
  momentumPct: number | null
  doublingDays: number | null
  dailyPerDay: number // avg new downloads/day over the window
  share: number // share of new downloads across all models (30d window)
  dailySeries: DayPoint[] // new downloads per day
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

function dailyDeltas(series: ModelMetricRow[]): DayPoint[] {
  const out: DayPoint[] = []
  for (let i = 1; i < series.length; i++) {
    const d = series[i].hf_downloads - series[i - 1].hf_downloads
    if (d >= 0) out.push({ date: series[i].snapshot_date, value: d })
  }
  return out
}

function computeStats(rows: ModelMetricRow[]): ModelStat[] {
  const grouped = byModel(rows)
  const raw = MODEL_REGISTRY.map((m) => {
    const series = grouped.get(m.key) ?? []
    const latest = series[series.length - 1]
    const prev30 = series.length > 1 ? series[Math.max(0, series.length - 31)] : null
    const latestCum = latest?.hf_downloads ?? 0
    const prevCum = prev30?.hf_downloads ?? null
    const delta30d = prevCum != null && series.length > 1 ? latestCum - prevCum : null
    const momentumPct =
      delta30d != null && prevCum != null && prevCum > 0 ? Math.round((delta30d / prevCum) * 100) : null
    const doublingDays =
      delta30d != null && prevCum != null && prevCum > 0 && delta30d > 0
        ? Math.round(((series.length - 1) * Math.LN2) / Math.log(latestCum / prevCum))
        : null
    const days = Math.max(1, series.length - 1)
    return {
      key: m.key,
      name: m.name,
      family: m.family,
      isRuntime: m.family === 'runtime',
      latestCum,
      prevCum,
      delta30d,
      momentumPct,
      doublingDays,
      dailyPerDay: delta30d != null ? Math.round(delta30d / days) : 0,
      share: 0,
      dailySeries: dailyDeltas(series),
      ghStars: latest?.gh_stars ?? 0,
      ghForks: latest?.gh_forks ?? 0,
      ghContributors: latest?.gh_contributors ?? 0,
    } satisfies Omit<ModelStat, 'share'> & { share: number }
  })

  const totalDelta = raw.reduce((s, m) => s + (m.delta30d ?? 0), 0) || 1
  return raw.map((m) => ({ ...m, share: ((m.delta30d ?? 0) / totalDelta) * 100 }))
}

function totalDailySeries(stats: ModelStat[]): DayPoint[] {
  const totals = new Map<string, number>()
  for (const m of stats) {
    for (const p of m.dailySeries) totals.set(p.date, (totals.get(p.date) ?? 0) + p.value)
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
  return computeStats(rows).some((m) => m.latestCum > 0 || m.ghStars > 0)
}

/* --- header strip --- */

export function ModelStatsStrip({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
  if (!hasData(rows)) return null
  const withDelta = stats.filter((m) => m.delta30d != null)
  const totalPerDay = withDelta.reduce((s, m) => s + m.dailyPerDay, 0)
  const allTimeTotal = stats.filter((m) => !m.isRuntime).reduce((s, m) => s + m.latestCum, 0)
  const leader = [...withDelta].sort((a, b) => b.dailyPerDay - a.dailyPerDay)[0]
  const allTimeLeader = stats.filter((m) => !m.isRuntime).sort((a, b) => b.latestCum - a.latestCum)[0]
  const fastest = withDelta
    .filter((m) => m.doublingDays != null)
    .sort((a, b) => (a.doublingDays ?? 0) - (b.doublingDays ?? 0))[0]
  const modelCount = stats.filter((m) => !m.isRuntime).length

  return (
    <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11.5px]">
      {totalPerDay > 0 ? (
        <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
          weight downloads: <b className="text-[var(--ink)]"><CountUp value={totalPerDay} />/day</b>
        </span>
      ) : (
        <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
          all-time pulls: <b className="text-[var(--ink)]"><CountUp value={allTimeTotal} /></b>
        </span>
      )}
      <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
        models tracked: <b className="text-[var(--ink)]">{modelCount} + {stats.length - modelCount} runtimes</b>
      </span>
      {leader ? (
        <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
          leader: <b className="text-[var(--ink)]">{leader.name} {leader.share.toFixed(0)}%</b>
        </span>
      ) : allTimeLeader ? (
        <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[var(--body)]">
          leader: <b className="text-[var(--ink)]">{allTimeLeader.name} {formatCount(allTimeLeader.latestCum)} all-time</b>
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

/* --- fig. 01: total daily weight downloads --- */

export function ModelVolumeChart({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
  const totals = totalDailySeries(stats)
  if (totals.length > 0) {
    return (
      <BarChart
        data={totals.map((p) => ({ label: shortDate(p.date), value: p.value }))}
        ariaLabel="Daily Hugging Face weight downloads across tracked open models"
        labelEvery={Math.max(1, Math.floor(totals.length / 8))}
      />
    )
  }

  // Day-1 fallback: all-time cumulative weight pulls, ranked (deltas start tomorrow)
  const ranked = stats
    .filter((m) => !m.isRuntime && m.latestCum > 0)
    .sort((a, b) => b.latestCum - a.latestCum)
  if (ranked.length === 0) {
    return (
      <p className="font-mono text-[12px] text-[var(--muted)]">
        collecting daily snapshots — the chart fills in as they accrue.
      </p>
    )
  }
  const max = ranked[0].latestCum || 1
  return (
    <div className="font-mono text-[12px]">
      {ranked.map((m) => (
        <div key={m.key} className="flex items-center gap-3 py-1.5">
          <span className="w-32 shrink-0 truncate text-[var(--body)]">{m.name}</span>
          <span className="h-2.5 min-w-0 flex-1">
            <span className="block h-full bg-[var(--ink)]" style={{ width: `${Math.max((m.latestCum / max) * 100, 2)}%` }} />
          </span>
          <span className="shrink-0 font-bold tabular-nums text-[var(--ink)]">{formatCount(m.latestCum)}</span>
        </div>
      ))}
      <p className="mt-3 text-[11px] text-[var(--muted)]">
        all-time cumulative weight pulls today · daily bars start tomorrow as snapshots accrue.
      </p>
    </div>
  )
}

/* --- fig. 02: download share --- */

export function ModelShareBar({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
  const withDelta = stats
    .filter((m) => !m.isRuntime && (m.delta30d ?? 0) > 0)
    .sort((a, b) => (b.delta30d ?? 0) - (a.delta30d ?? 0))

  // Before the 30-day window fills: all-time cumulative share (still real data)
  if (withDelta.length === 0) {
    const allTime = stats
      .filter((m) => !m.isRuntime && m.latestCum > 0)
      .sort((a, b) => b.latestCum - a.latestCum)
    if (allTime.length === 0) {
      return (
        <p className="font-mono text-[12px] text-[var(--muted)]">
          share computes once 30 days of snapshots exist — check back as data accrues.
        </p>
      )
    }
    return (
      <div>
        <ShareBar
          segments={allTime.map((m) => ({ label: m.name, value: m.latestCum }))}
          ariaLabel="All-time Hugging Face weight download share by model"
        />
        <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
          all-time cumulative share today · switches to the 30-day window as snapshots accrue.
        </p>
      </div>
    )
  }

  return (
    <ShareBar
      segments={withDelta.map((m) => ({ label: m.name, value: m.delta30d ?? 0 }))}
      ariaLabel="Share of new Hugging Face downloads by model over the last 30 days"
    />
  )
}

/* --- fig. 03: per-model small multiples (same scale) --- */

export function ModelSmallMultiples({ rows }: { rows: ModelMetricRow[] }) {
  const stats = computeStats(rows)
    .filter((m) => !m.isRuntime && m.dailySeries.length > 0)
    .sort((a, b) => b.dailyPerDay - a.dailyPerDay)
  if (stats.length === 0) return null

  const bucketed = stats.map((m) => ({
    name: m.name,
    values: Array.from({ length: Math.ceil(m.dailySeries.length / 3) }, (_, b) =>
      m.dailySeries.slice(b * 3, b * 3 + 3).reduce((s, p) => s + p.value, 0)
    ),
    caption: `${formatCount(m.dailyPerDay)}/day${m.momentumPct != null ? ` · ${m.momentumPct >= 0 ? '▲' : '▼'} ${Math.abs(m.momentumPct)}%` : ''}`,
  }))

  return (
    <SmallMultiples
      series={bucketed}
      note="new weight downloads per day · all charts share one scale — bar heights are comparable across models."
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
        momentum ranks once 30 days of snapshots exist.
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
              <th className="px-3 py-2 text-right font-normal">new downloads 30d</th>
              <th className="px-3 py-2 text-right font-normal">per day</th>
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
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">{formatCount(m.delta30d ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--body)]">{formatCount(m.dailyPerDay)}</td>
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
              {m.momentumPct != null ? `${m.momentumPct >= 0 ? '▲' : '▼'} ${Math.abs(m.momentumPct)}%` : '—'} ·{' '}
              {formatCount(m.dailyPerDay)}/day ·{' '}
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
  const withDelta = stats.filter((m) => m.delta30d != null)
  const leader = [...stats].sort((a, b) => b.latestCum - a.latestCum)[0]
  const biggestGain = [...withDelta].sort((a, b) => (b.delta30d ?? 0) - (a.delta30d ?? 0))[0]
  const fastest = withDelta
    .filter((m) => m.doublingDays != null)
    .sort((a, b) => (a.doublingDays ?? 0) - (b.doublingDays ?? 0))[0]
  const runtimeLeader = stats.filter((m) => m.isRuntime).sort((a, b) => b.ghStars - a.ghStars)[0]

  const lines = [
    `${stats.filter((m) => !m.isRuntime).length} open models + ${stats.filter((m) => m.isRuntime).length} runtimes tracked — hf downloads + github velocity, nothing fabricated`,
    ...(leader ? [`${leader.name} leads cumulative weight pulls at ${formatCount(leader.latestCum)} all-time`] : []),
    ...(biggestGain ? [`${biggestGain.name} added the most new downloads this month — ${formatCount(biggestGain.delta30d ?? 0)} in 30 days`] : []),
    ...(fastest ? [`${fastest.name} is the fastest doubler — every ${fastest.doublingDays} days at current pace`] : []),
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
