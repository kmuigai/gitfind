import { ImageResponse } from 'next/og'
import { getRisingRepos } from '@/lib/queries'
import { formatCount } from '@/lib/design'

export const runtime = 'edge'
export const alt = 'Rising This Week — GitFind Insights'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const silkscreen = fetch(
  'https://fonts.gstatic.com/s/silkscreen/v6/m8JUjfVPf62XiF7kO-i9aAhATms.ttf'
).then((res) => res.arrayBuffer())

const geistMono = fetch(
  'https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeE9KJ5T.ttf'
).then((res) => res.arrayBuffer())

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function formatWeekLabel(date: string): string {
  const [y, m, d] = date.split('-')
  return `week of ${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const [silkscreenData, monoData, repos] = await Promise.all([silkscreen, geistMono, getRisingRepos(5)])
  const weekLabel = formatWeekLabel(date)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 60px',
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
            {weekLabel}
          </span>
        </div>

        {/* Title */}
        <span style={{ fontFamily: 'Silkscreen', fontSize: '56px', fontWeight: 700, color: '#171512', lineHeight: 1.05 }}>
          RISING THIS WEEK
        </span>

        {/* Top repos */}
        <div style={{ display: 'flex', flexDirection: 'column', border: '3px solid #171512', backgroundColor: '#f4f1e6' }}>
          {repos.slice(0, 5).map((repo, i) => (
            <div
              key={repo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '11px 18px',
                borderBottom: i < 4 ? '2px dashed rgba(23,21,18,0.28)' : 'none',
              }}
            >
              <span style={{ fontSize: '15px', color: '#565249', width: '28px' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#171512', flex: 1 }}>
                <span style={{ color: '#565249', fontWeight: 400 }}>{repo.owner}/</span>
                {repo.name}
              </span>
              <span style={{ fontSize: '15px', color: '#171512', backgroundColor: '#ffc833', border: '2px solid #171512', padding: '2px 8px' }}>
                +{formatCount(repo.stars_7d)} stars this week
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid #171512', paddingTop: '16px' }}>
          <span style={{ fontSize: '17px', letterSpacing: '0.15em', color: '#565249', textTransform: 'uppercase' }}>
            ranked by 7-day star velocity
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
