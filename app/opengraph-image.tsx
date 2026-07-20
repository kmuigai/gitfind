import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'GitFind — GitHub, Translated'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const silkscreen = fetch(
  'https://fonts.gstatic.com/s/silkscreen/v6/m8JUjfVPf62XiF7kO-i9aAhATms.ttf'
).then((res) => res.arrayBuffer())

const geistMono = fetch(
  'https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeE9KJ5T.ttf'
).then((res) => res.arrayBuffer())

export default async function Image() {
  const [silkscreenData, monoData] = await Promise.all([silkscreen, geistMono])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#f4f1e6',
          fontFamily: 'Geist Mono',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* F3 drawer-pull mark */}
          <div
            style={{
              width: '96px',
              height: '106px',
              border: '5px solid #171512',
              backgroundColor: '#f4f1e6',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '14px',
              boxShadow: '8px 8px 0 0 #171512',
            }}
          >
            <span style={{ fontFamily: 'Silkscreen', fontSize: '48px', fontWeight: 700, color: '#171512', lineHeight: 1 }}>
              G
            </span>
            <div style={{ width: '52px', height: '14px', backgroundColor: '#ffc833', border: '3px solid #171512', marginTop: '10px' }} />
          </div>
          <span style={{ fontFamily: 'Silkscreen', fontSize: '34px', fontWeight: 700, color: '#171512' }}>
            GITFIND
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '-20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Silkscreen', fontSize: '68px', fontWeight: 700, color: '#171512', lineHeight: 1.05 }}>
              GITHUB, TRANSLATED
            </span>
            <span style={{ fontFamily: 'Geist Mono', fontSize: '68px', color: '#ffc833', lineHeight: 1.05 }}>█</span>
          </div>
          <span style={{ fontSize: '27px', lineHeight: 1.5, color: '#33302a', maxWidth: '860px' }}>
            The rising projects that matter, explained in plain English for builders — before everyone else sees them.
          </span>
        </div>

        {/* Footer strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid #171512', paddingTop: '24px' }}>
          <span style={{ fontSize: '18px', letterSpacing: '0.15em', color: '#565249', textTransform: 'uppercase' }}>
            github intelligence — updated daily
          </span>
          <span style={{ fontSize: '18px', letterSpacing: '0.15em', color: '#171512', textTransform: 'uppercase', fontWeight: 700 }}>
            every score, explained
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Silkscreen', data: silkscreenData, weight: 700, style: 'normal' },
        { name: 'Geist Mono', data: monoData, weight: 400, style: 'normal' },
      ],
    }
  )
}
