import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Insights — GitFind'
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
          padding: '52px 60px',
          backgroundColor: '#f4f1e6',
          fontFamily: 'Geist Mono',
        }}
      >
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
            weekly rankings — breakout signals
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <span style={{ fontFamily: 'Silkscreen', fontSize: '72px', fontWeight: 700, color: '#171512', lineHeight: 1.05 }}>
            INSIGHTS
          </span>
          <span style={{ fontSize: '24px', lineHeight: 1.5, color: '#33302a', maxWidth: '860px' }}>
            Trend analysis from every public GitHub repo. What moved, why it matters, and what to watch next.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid #171512', paddingTop: '18px' }}>
          <span style={{ fontSize: '18px', letterSpacing: '0.15em', color: '#565249', textTransform: 'uppercase' }}>
            published weekly · data-driven
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
