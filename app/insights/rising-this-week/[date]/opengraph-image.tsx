import { ImageResponse } from 'next/og'
import { getRisingRepos } from '@/lib/queries'

export const runtime = 'edge'
export const alt = 'Rising This Week — GitFind Insights'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWeekLabel(date: string): string {
  const [y, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const repos = await getRisingRepos(5)
  const weekLabel = formatWeekLabel(date)

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0f',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(108,106,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,106,246,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(108,106,246,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Top row: logo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#6c6af6', fontSize: '24px', fontFamily: 'monospace' }}>❯</span>
            <span style={{ color: '#e8e8f0', fontSize: '20px', fontWeight: 600 }}>gitfind</span>
            <span style={{ color: '#7a7a9a', fontSize: '20px', fontWeight: 600 }}>.ai</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '100px',
              padding: '6px 16px',
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 500 }}>WEEKLY</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 700,
              color: '#e8e8f0',
              letterSpacing: '-2px',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Rising This Week
          </h1>
          <p style={{ fontSize: '22px', color: '#7a7a9a', margin: 0 }}>
            Week of {weekLabel}
          </p>
        </div>

        {/* Top repos preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {repos.slice(0, 5).map((repo, i) => (
            <div
              key={repo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: '#14141c',
                border: '1px solid #1e1e2e',
                borderRadius: '10px',
                padding: '12px 20px',
              }}
            >
              <span
                style={{
                  color: '#4a4a6a',
                  fontSize: '18px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  width: '28px',
                  textAlign: 'right',
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  color: '#e8e8f0',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  flex: 1,
                }}
              >
                <span style={{ color: '#7a7a9a' }}>{repo.owner}/</span>
                {repo.name}
              </span>
              <span
                style={{
                  color: '#22c55e',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                +{formatStars(repo.stars_7d)} ★
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
