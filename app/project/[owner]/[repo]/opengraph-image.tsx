import { ImageResponse } from 'next/og'
import { getRepo } from '@/lib/queries'
import { tierFor, formatCount } from '@/lib/design'

export const runtime = 'edge'
export const alt = 'Project — GitFind'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const silkscreen = fetch(
  'https://fonts.gstatic.com/s/silkscreen/v6/m8JUjfVPf62XiF7kO-i9aAhATms.ttf'
).then((res) => res.arrayBuffer())

const geistMono = fetch(
  'https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeE9KJ5T.ttf'
).then((res) => res.arrayBuffer())

const TIER_COLORS: Record<string, string> = {
  Breakout: '#8f2d1e',
  Hot: '#7a5200',
  Active: '#2f5d6e',
}

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params
  const [silkscreenData, monoData] = await Promise.all([silkscreen, geistMono])

  let project = null
  try {
    project = await getRepo(owner, repo)
  } catch {
    project = null
  }

  const fonts = [
    { name: 'Silkscreen', data: silkscreenData, weight: 700 as const, style: 'normal' as const },
    { name: 'Geist Mono', data: monoData, weight: 400 as const, style: 'normal' as const },
  ]

  // Brand fallback when the repo isn't tracked
  if (!project) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            backgroundColor: '#f4f1e6',
            fontFamily: 'Silkscreen',
          }}
        >
          <span style={{ fontSize: '64px', fontWeight: 700, color: '#171512' }}>GITFIND</span>
          <span style={{ fontFamily: 'Geist Mono', fontSize: '26px', color: '#33302a' }}>
            {owner}/{repo} — GitHub, translated.
          </span>
        </div>
      ),
      { ...size, fonts }
    )
  }

  const score = project.enrichment?.early_signal_score ?? null
  const tier = score != null ? tierFor(score) : null
  const summary = project.enrichment?.summary ?? project.description ?? ''
  const nameFontSize = repo.length > 24 ? 48 : repo.length > 14 ? 60 : 72

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
        {/* Header row */}
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
            spec sheet — project entry
          </span>
        </div>

        {/* Body: name+summary left, score panel right */}
        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Silkscreen', fontWeight: 700, lineHeight: 1.1 }}>
              <span style={{ fontSize: nameFontSize, color: '#565249' }}>{owner}/</span>
              <span style={{ fontSize: nameFontSize, color: '#171512' }}>{repo}</span>
            </div>
            <span style={{ fontSize: '22px', lineHeight: 1.5, color: '#33302a', maxHeight: '150px', overflow: 'hidden' }}>
              {summary}
            </span>
          </div>

          {score != null && tier ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: '240px',
                border: '4px solid #171512',
                backgroundColor: '#f4f1e6',
                padding: '18px',
                boxShadow: '8px 8px 0 0 #171512',
              }}
            >
              <span style={{ fontSize: '13px', letterSpacing: '0.12em', color: '#565249', textTransform: 'uppercase' }}>
                early signal score
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <span style={{ fontFamily: 'Silkscreen', fontSize: '64px', fontWeight: 700, color: '#171512', lineHeight: 1 }}>
                  {score}
                </span>
                <span style={{ fontSize: '22px', color: '#565249' }}>/100</span>
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#f4f1e6',
                  backgroundColor: TIER_COLORS[tier],
                  padding: '4px 10px',
                  alignSelf: 'flex-start',
                }}
              >
                {tier}
              </span>
              <div style={{ width: '100%', height: '12px', border: '2px solid #171512', marginTop: '6px', display: 'flex' }}>
                <div style={{ width: `${score}%`, height: '100%', backgroundColor: '#171512' }} />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid #171512', paddingTop: '18px' }}>
          <span style={{ fontSize: '18px', color: '#33302a' }}>
            {formatCount(project.stars)} stars · {formatCount(project.forks)} forks ·{' '}
            {project.contributors === 0 ? 'Solo' : `${formatCount(project.contributors)} contributors`}
            {project.language ? ` · ${project.language}` : ''}
            {project.license ? ` · ${project.license}` : ''}
          </span>
          <span style={{ fontSize: '16px', letterSpacing: '0.15em', color: '#171512', textTransform: 'uppercase', fontWeight: 700 }}>
            every score, explained
          </span>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
