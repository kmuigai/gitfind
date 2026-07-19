// Direction I — AI Code Index page ("the ai code index" as a spec catalog)
// 1-bit multi-series strategy: hatch patterns instead of colors, small
// multiples, 100% share bar, machine-log intelligence brief.
// Data below is deterministic mock data — no fetching.

/* --- deterministic mock series: 30 days per tool --- */

const DAYS = 30

function rand(seed: number, i: number): number {
  const x = Math.sin(seed * 999.7 + i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export interface ToolSeries {
  key: string
  name: string
  values: number[] // daily commits, 30 days
}

function makeSeries(seed: number, start: number, end: number): number[] {
  const g = Math.pow(end / start, 1 / (DAYS - 1))
  return Array.from({ length: DAYS }, (_, i) => {
    const weekend = i % 7 === 2 || i % 7 === 3 ? 0.74 : 1
    const wobble = 0.82 + 0.36 * rand(seed, i)
    return Math.round(start * Math.pow(g, i) * wobble * weekend)
  })
}

export const tools: ToolSeries[] = [
  { key: 'claude', name: 'claude code', values: makeSeries(1, 94000, 219000) },
  { key: 'copilot', name: 'copilot', values: makeSeries(2, 176000, 198000) },
  { key: 'cursor', name: 'cursor', values: makeSeries(3, 82000, 108000) },
  { key: 'gemini', name: 'gemini cli', values: makeSeries(4, 31000, 74000) },
  { key: 'codex', name: 'codex', values: makeSeries(5, 19000, 52000) },
  { key: 'aider', name: 'aider', values: makeSeries(6, 13000, 16500) },
  { key: 'devin', name: 'devin', values: makeSeries(7, 5200, 8100) },
]

const otherKeys = ['codex', 'aider', 'devin']

export function latest(t: ToolSeries): number {
  return t.values[t.values.length - 1]
}

export function momentumPct(t: ToolSeries): number {
  return Math.round(((latest(t) - t.values[0]) / t.values[0]) * 100)
}

export function doublingDays(t: ToolSeries): number {
  return Math.round(((DAYS - 1) * Math.LN2) / Math.log(latest(t) / t.values[0]))
}

export function totalLatest(): number {
  return tools.reduce((s, t) => s + latest(t), 0)
}

export function shareOf(t: ToolSeries): number {
  return (latest(t) / totalLatest()) * 100
}

export function fmtK(n: number): string {
  if (n >= 1000) {
    const v = n / 1000
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}k`
  }
  return String(n)
}

/* --- hatch patterns (print-style series encoding) --- */

function PatternDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      <pattern id={`${prefix}-solid`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="var(--dl-ink)" />
      </pattern>
      <pattern id={`${prefix}-checker`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="var(--dl-paper)" />
        <rect width="2" height="2" fill="var(--dl-ink)" />
        <rect x="2" y="2" width="2" height="2" fill="var(--dl-ink)" />
      </pattern>
      <pattern id={`${prefix}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--dl-paper)" />
        <path d="M-1,7 L7,-1" stroke="var(--dl-ink)" strokeWidth="1.4" />
      </pattern>
      <pattern id={`${prefix}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--dl-paper)" />
        <circle cx="3" cy="3" r="1.1" fill="var(--dl-ink)" />
      </pattern>
      <pattern id={`${prefix}-cross`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--dl-paper)" />
        <path d="M-1,7 L7,-1 M-1,-1 L7,7" stroke="var(--dl-ink)" strokeWidth="1" />
      </pattern>
    </defs>
  )
}

const LAYERS = [
  { key: 'claude', label: 'claude code', pat: 'solid' },
  { key: 'copilot', label: 'copilot', pat: 'checker' },
  { key: 'cursor', label: 'cursor', pat: 'hatch' },
  { key: 'gemini', label: 'gemini cli', pat: 'dots' },
  { key: 'others', label: 'codex + aider + devin', pat: 'cross' },
] as const

function layerValue(key: string, i: number): number {
  if (key === 'others') {
    return otherKeys.reduce((s, k) => s + (tools.find((t) => t.key === k)?.values[i] ?? 0), 0)
  }
  return tools.find((t) => t.key === key)?.values[i] ?? 0
}

/* --- fig. 01: total daily volume (single solid series) --- */

export function ITotalChart() {
  const W = 680
  const H = 200
  const padTop = 8
  const padBottom = 20
  const totals = Array.from({ length: DAYS }, (_, i) =>
    LAYERS.reduce((s, l) => s + layerValue(l.key, i), 0)
  )
  const max = Math.max(...totals)
  const barW = W / DAYS
  const gridLevels = [250000, 500000]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart of total daily AI coding tool commits over 30 days">
        {gridLevels.map((g) => {
          const y = H - padBottom - (g / max) * (H - padTop - padBottom)
          return (
            <g key={g}>
              <line x1={0} x2={W} y1={y} y2={y} stroke="var(--dl-ink)" strokeWidth={0.75} strokeDasharray="2 4" opacity={0.35} />
              <text x={0} y={y - 3} fontSize={9} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
                {fmtK(g)}
              </text>
            </g>
          )
        })}
        {totals.map((v, i) => {
          const h = (v / max) * (H - padTop - padBottom)
          const isLast = i === DAYS - 1
          return (
            <rect
              key={i}
              x={i * barW + 1}
              y={H - padBottom - h}
              width={barW - 2}
              height={h}
              fill={isLast ? 'var(--dl-accent)' : 'var(--dl-ink)'}
              stroke={isLast ? 'var(--dl-ink)' : 'none'}
              strokeWidth={isLast ? 2 : 0}
            />
          )
        })}
        <text
          x={W - 4}
          y={H - padBottom - (totals[DAYS - 1] / max) * (H - padTop - padBottom) - 5}
          textAnchor="end"
          fontSize={11}
          fontWeight="bold"
          fill="var(--dl-ink)"
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          {fmtK(totals[DAYS - 1])}
        </text>
        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--dl-ink)" strokeWidth={2} />
        {[0, 14, 29].map((i) => (
          <text key={i} x={i * barW + 2} y={H - 5} fontSize={10} fill="var(--dl-muted)" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
            {['jun 19', 'jul 3', 'jul 18'][[0, 14, 29].indexOf(i)]}
          </text>
        ))}
      </svg>
      <p className="mt-2 font-mono text-[11px] text-[var(--dl-muted)]">
        total commits across all 7 tracked tools. per-tool breakdown: § 2 and § 3.
      </p>
    </div>
  )
}

/* --- fig. 02: market share 100% bar --- */

export function IShareBar() {
  const W = 680
  const H = 64
  const prefix = 'sh'
  const shares = LAYERS.map((l) => {
    const v =
      l.key === 'others'
        ? otherKeys.reduce((s, k) => s + shareOf(tools.find((t) => t.key === k)!), 0)
        : shareOf(tools.find((t) => t.key === l.key)!)
    return { ...l, pct: v }
  })
  const segments = shares.map((s, i) => {
    const x = shares.slice(0, i).reduce((sum, p) => sum + (p.pct / 100) * W, 0)
    return { ...s, x, w: (s.pct / 100) * W }
  })
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Market share bar of AI coding tools by daily commits">
        <PatternDefs prefix={prefix} />
        {segments.map((s) => (
          <g key={s.key}>
            <rect x={s.x} y={0} width={s.w} height={H} fill={`url(#${prefix}-${s.pat})`} stroke="var(--dl-ink)" strokeWidth="1.5" />
            {s.pct > 7 ? (
              <text x={s.x + s.w / 2} y={H / 2 + 4} textAnchor="middle" fontSize={12} fontWeight="bold" fill={s.pat === 'solid' ? 'var(--dl-paper)' : 'var(--dl-ink)'} stroke="var(--dl-paper)" strokeWidth={s.pat === 'solid' ? 0 : 3} paintOrder="stroke" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
                {s.pct.toFixed(0)}%
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-[var(--dl-body)]">
        {shares.map((s) => (
          <span key={s.key}>
            {s.label} <b className="text-[var(--dl-ink)]">{s.pct.toFixed(1)}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/* --- fig. 03: small multiples, genuinely same scale --- */

export function ISmallMultiples() {
  const allBuckets = tools.map((t) =>
    Array.from({ length: 10 }, (_, b) => t.values.slice(b * 3, b * 3 + 3).reduce((s, v) => s + v, 0))
  )
  const globalMax = Math.max(...allBuckets.flat())
  const W = 120
  const H = 52
  const barW = W / 10
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tools.map((t, ti) => {
          const buckets = allBuckets[ti]
          const mom = momentumPct(t)
          return (
            <div key={t.key} className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] p-3">
              <p className="font-mono text-[12px] font-bold text-[var(--dl-ink)]">{t.name}</p>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`${t.name} daily commits trend`}>
                {buckets.map((v, b) => {
                  const h = (v / globalMax) * (H - 6)
                  return (
                    <rect
                      key={b}
                      x={b * barW + 1}
                      y={H - 2 - h}
                      width={barW - 2}
                      height={Math.max(h, 1)}
                      fill="var(--dl-ink)"
                    />
                  )
                })}
                <line x1={0} x2={W} y1={H - 2} y2={H - 2} stroke="var(--dl-ink)" strokeWidth="1.5" />
              </svg>
              <p className="mt-2 font-mono text-[11.5px] text-[var(--dl-body)]">
                <b className="text-[var(--dl-ink)]">{fmtK(latest(t))}</b>/day ·{' '}
                <span className={mom > 100 ? 'font-bold text-[var(--dl-ink)]' : ''}>▲ {mom}%</span>
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 font-mono text-[11px] text-[var(--dl-muted)]">
        all charts share one scale — bar heights are comparable across tools.
      </p>
    </div>
  )
}

/* --- fig. 04: momentum / doubling table --- */

export function IMomentumTable() {
  const ranked = [...tools].sort((a, b) => momentumPct(b) - momentumPct(a))
  return (
    <div className="overflow-x-auto border-2 border-[var(--dl-line)] bg-[var(--dl-paper)]">
      <table className="w-full font-mono text-[12px]">
        <thead>
          <tr className="border-b-2 border-[var(--dl-line)] text-left text-[11px] text-[var(--dl-muted)]">
            <th className="px-3 py-2 font-normal">no.</th>
            <th className="px-3 py-2 font-normal">tool</th>
            <th className="px-3 py-2 text-right font-normal">momentum 30d</th>
            <th className="px-3 py-2 text-right font-normal">commits/day</th>
            <th className="px-3 py-2 text-right font-normal">doubles every</th>
            <th className="hidden px-3 py-2 text-right font-normal sm:table-cell">share</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((t, i) => (
            <tr key={t.key} className="border-b border-dashed border-[var(--dl-line)]/40 last:border-0">
              <td className="px-3 py-2 text-[var(--dl-muted)]">{String(i + 1).padStart(2, '0')}</td>
              <td className="px-3 py-2 font-bold text-[var(--dl-ink)]">
                {t.name}
                {i === 0 ? (
                  <span className="ml-2 border border-[var(--dl-line)] bg-[var(--dl-accent)] px-1 text-[10px] font-bold text-[var(--dl-ink)]">
                    fastest
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right text-[var(--dl-body)]">▲ {momentumPct(t)}%</td>
              <td className="px-3 py-2 text-right text-[var(--dl-body)]">{fmtK(latest(t))}</td>
              <td className="px-3 py-2 text-right text-[var(--dl-body)]">{doublingDays(t)} days</td>
              <td className="hidden px-3 py-2 text-right text-[var(--dl-body)] sm:table-cell">{shareOf(t).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* --- fig. 05: intelligence brief (machine log) --- */

export function IBriefLog() {
  const leader = [...tools].sort((a, b) => latest(b) - latest(a))[0]
  const claude = tools[0]
  const claudeGain = latest(claude) - claude.values[0]
  const lines = [
    '09:41:02 index sync completed — 2,847 repos, 675.6k commits counted',
    `09:41:03 ${leader.name} leads the index at ${shareOf(leader).toFixed(1)}% of ai-written commits`,
    `09:41:03 claude code added ${fmtK(claudeGain)}/day since jun 19 — biggest absolute gain on the index`,
    `09:41:03 codex is the fastest doubler — every ${doublingDays(tools[4])} days at current pace`,
    '09:41:04 copilot growth flat for the third consecutive week',
    '09:41:04 gemini cli added 43k daily commits since jun 19',
    '09:41:05 aider steady. aider is always steady.',
  ]
  return (
    <div className="border-2 border-[var(--dl-line)] bg-[var(--dl-ink)] p-4 font-mono text-[12px] leading-[1.9] text-[var(--dl-paper)]">
      <p className="text-[var(--dl-accent)]">$ tail -f /var/log/gitfind/index.log</p>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
      <p>
        09:41:05 <span className="dl-blink">█</span>
      </p>
    </div>
  )
}

/* --- page header strip --- */

export function IIndexStatsStrip() {
  const total = totalLatest()
  const fastest = [...tools].sort((a, b) => doublingDays(a) - doublingDays(b))[0]
  const leader = [...tools].sort((a, b) => latest(b) - latest(a))[0]
  return (
    <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11.5px]">
      <span className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] px-3 py-1.5 text-[var(--dl-body)]">
        commits today: <b className="text-[var(--dl-ink)]">{fmtK(total)}</b>
      </span>
      <span className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] px-3 py-1.5 text-[var(--dl-body)]">
        tools tracked: <b className="text-[var(--dl-ink)]">7</b>
      </span>
      <span className="border-2 border-[var(--dl-line)] bg-[var(--dl-paper)] px-3 py-1.5 text-[var(--dl-body)]">
        leader: <b className="text-[var(--dl-ink)]">{leader.name} {shareOf(leader).toFixed(0)}%</b>
      </span>
      <span className="border-2 border-[var(--dl-line)] bg-[var(--dl-accent)] px-3 py-1.5 font-bold text-[var(--dl-ink)]">
        fastest doubler: {fastest.name} · {doublingDays(fastest)}d
      </span>
    </div>
  )
}

