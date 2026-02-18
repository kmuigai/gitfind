import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'GitFind — Rising GitHub Projects for Product People'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
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
          padding: '72px 80px',
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
            top: '-120px',
            right: '-120px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(108,106,246,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#6c6af6', fontSize: '28px', fontFamily: 'monospace' }}>❯</span>
          <span style={{ color: '#e8e8f0', fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>
            gitfind
          </span>
          <span style={{ color: '#7a7a9a', fontSize: '24px', fontWeight: 600 }}>.ai</span>
        </div>

        {/* Centre content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pill — alignSelf flex-start instead of width fit-content */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: '10px',
              background: 'rgba(108,106,246,0.1)',
              border: '1px solid rgba(108,106,246,0.25)',
              borderRadius: '100px',
              padding: '8px 20px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#6c6af6',
              }}
            />
            <span style={{ color: '#6c6af6', fontSize: '15px', fontWeight: 500 }}>
              Open source intelligence for product people
            </span>
          </div>

          <h1
            style={{
              fontSize: '80px',
              fontWeight: 700,
              color: '#e8e8f0',
              letterSpacing: '-3px',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Git Smarter.
          </h1>

          <p
            style={{
              fontSize: '26px',
              color: '#7a7a9a',
              margin: 0,
              lineHeight: 1.4,
              maxWidth: '700px',
            }}
          >
            Rising GitHub projects ranked by Early Signal Score.
            GitHub, translated for product managers.
          </p>
        </div>

        {/* Bottom stats row */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'Early Signal Score', value: 'ESS 94' },
            { label: 'Categories', value: '8 categories' },
            { label: 'Update cadence', value: 'Nightly' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: '#14141c',
                border: '1px solid #1e1e2e',
                borderRadius: '10px',
                padding: '14px 20px',
              }}
            >
              <span style={{ color: '#4a4a6a', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {stat.label}
              </span>
              <span style={{ color: '#e8e8f0', fontSize: '16px', fontWeight: 600, fontFamily: 'monospace' }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
