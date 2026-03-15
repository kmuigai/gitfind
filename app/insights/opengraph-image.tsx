import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Insights — GitFind'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          backgroundColor: '#0a0a0f',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <span style={{ color: '#6c6af6', fontSize: '28px', fontWeight: 700 }}>❯</span>
            <span style={{ color: '#e8e8f0', fontSize: '28px', fontWeight: 700, letterSpacing: '0.05em' }}>
              GITFIND.AI
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#6c6af6', fontSize: '24px' }}>{'//'}</span>
              <span style={{ color: '#6c6af6', fontSize: '24px', letterSpacing: '0.15em' }}>
                INSIGHTS
              </span>
            </div>
            <span style={{ color: '#e8e8f0', fontSize: '48px', fontWeight: 700, lineHeight: 1.1 }}>
              Weekly rankings &{'\n'}breakout signals
            </span>
            <span style={{ color: '#7a7a9a', fontSize: '24px', lineHeight: 1.4, maxWidth: '800px' }}>
              Trend analysis from every public GitHub repo. What moved, why it matters, and what to watch next.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '18px', letterSpacing: '0.1em' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6c6af6' }} />
            <span style={{ color: '#6c6af6' }}>SYS_OK</span>
          </div>
          <span style={{ color: '#1e1e2e' }}>·</span>
          <span style={{ color: '#555' }}>PUBLISHED WEEKLY</span>
          <span style={{ color: '#1e1e2e' }}>·</span>
          <span style={{ color: '#555' }}>DATA-DRIVEN</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
