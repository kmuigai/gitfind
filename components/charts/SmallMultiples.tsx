// Small multiples — one mini bar chart per series, ALL sharing a single
// global scale so bar heights are honestly comparable across series.

interface MultipleSeries {
  name: string
  values: number[]
  caption: string
}

interface SmallMultiplesProps {
  series: MultipleSeries[]
  note?: string
}

export default function SmallMultiples({ series, note }: SmallMultiplesProps) {
  const globalMax = Math.max(...series.flatMap((s) => s.values), 1)
  const W = 120
  const H = 52
  const barW = W / Math.max(...series.map((s) => s.values.length), 1)

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {series.map((s) => (
          <div key={s.name} className="border-2 border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="font-mono text-[12px] font-bold text-[var(--ink)]">{s.name}</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`${s.name} trend`}>
              {s.values.map((v, i) => {
                const h = (v / globalMax) * (H - 6)
                return (
                  <rect
                    key={i}
                    x={i * barW + 1}
                    y={H - 2 - h}
                    width={Math.max(barW - 2, 1)}
                    height={Math.max(h, 1)}
                    fill="var(--ink)"
                  />
                )
              })}
              <line x1={0} x2={W} y1={H - 2} y2={H - 2} stroke="var(--ink)" strokeWidth="1.5" />
            </svg>
            <p className="mt-2 font-mono text-[11.5px] text-[var(--body)]">{s.caption}</p>
          </div>
        ))}
      </div>
      {note ? <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">{note}</p> : null}
    </div>
  )
}
