import { ImageResponse } from 'next/og'
import { getAICodeIndexData, type AICodeIndexRow } from '@/lib/queries'
import { formatCount } from '@/lib/design'

export const runtime = 'edge'
export const alt = 'AI Code Index — GitFind'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const silkscreen = fetch(
  'https://fonts.gstatic.com/s/silkscreen/v6/m8JUjfVPf62XiF7kO-i9aAhATms.ttf'
).then((res) => res.arrayBuffer())

const geistMono = fetch(
  'https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeE9KJ5T.ttf'
).then((res) => res.arrayBuffer())

function val(row: AICodeIndexRow, tool: string): number {
  const v = row[tool]
  return typeof v === 'number' ? v : 0
}

export default async function Image() {
  const [silkscreenData, monoData, rows] = await Promise.all([silkscreen, geistMono, getAICodeIndexData()])

  const lastRow = rows[rows.length - 1]
  const tools = lastRow ? Object.keys(lastRow).filter((k) => k !== 'date') : []
  const total = lastRow ? tools.reduce((s, t) => s + val(lastRow, t), 0) : 0
  const shares = tools
    .map((t) => ({ name: t.toLowerCase(), pct: total > 0 ? (val(lastRow, t) / total) * 100 : 0 }))
    .filter((t) => t.pct > 0.1)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '52px 60px',
          backgroundColor: '#f4f1e6',
          fontFamily: 'Geist Mono',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '56px',
                height: '62px',
                border: '4px solid #171512',
                backgroundColor: '#f4f1e6',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '6px',
                boxShadow: '5px 5px 0 0 #171512',
              }}
            >
              <span style={{ fontFamily: 'Silkscreen', fontSize: '28px', fontWeight: 700, color: '#171512', lineHeight: 1 }}>G</span>
              <div style={{ width: '30px', height: '8px', backgroundColor: '#ffc833', border: '2px solid #171512', marginTop: '5px' }} />
            </div>
            <span style={{ fontFamily: 'Silkscreen', fontSize: '26px', fontWeight: 700, color: '#171512' }}>GITFIND</span>
          </div>
          <span style={{ fontSize: '16px', letterSpacing: '0.15em', color: '#565249', textTransform: 'uppercase' }}>
            ai-written commits — tracked daily
          </span>
        </div>

        {/* Headline + sub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <span style={{ fontFamily: 'Silkscreen', fontSize: '64px', fontWeight: 700, color: '#171512', lineHeight: 1.05 }}>
            THE AI CODE INDEX
          </span>
          <span style={{ fontSize: '24px', lineHeight: 1.5, color: '#33302a', maxWidth: '900px' }}>
            Which AI coding tool is actually winning? Daily commit volume, market share, and doubling time across {tools.length} tools on all public GitHub repos.
          </span>
        </div>

        {/* Share bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', width: '100%', height: '44px', border: '3px solid #171512' }}>
            {shares.map((s, i) => (
              <div
                key={s.name}
                style={{
                  width: `${s.pct}%`,
                  height: '100%',
                  backgroundColor: i === 0 ? '#171512' : `rgba(23, 21, 18, ${0.75 - i * 0.16})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.pct > 7 ? (
                  <span style={{ fontSize: '18px', fontWeight: 700, color: i === 0 ? '#f4f1e6' : '#171512' }}>
                    {s.pct.toFixed(0)}%
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {shares.map((s) => (
              <span key={s.name} style={{ fontSize: '16px', color: '#33302a' }}>
                {s.name}
                <b style={{ color: '#171512', marginLeft: '6px' }}>{s.pct.toFixed(1)}%</b>
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid #171512', paddingTop: '18px' }}>
          <span style={{ fontSize: '18px', color: '#33302a' }}>
            <b style={{ color: '#171512', marginRight: '6px' }}>{formatCount(total)}</b>commits yesterday · {tools.length} tools tracked
          </span>
          <span style={{ fontSize: '16px', letterSpacing: '0.15em', color: '#171512', textTransform: 'uppercase', fontWeight: 700 }}>
            every score, explained
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Silkscreen', data: silkscreenData, weight: 700 as const, style: 'normal' as const },
        { name: 'Geist Mono', data: monoData, weight: 400 as const, style: 'normal' as const },
      ],
    }
  )
}
