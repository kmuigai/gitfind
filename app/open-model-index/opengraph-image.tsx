import { ImageResponse } from 'next/og'
import { getModelMetrics } from '@/lib/queries'
import { formatCount } from '@/lib/design'
import { MODEL_REGISTRY } from '@/lib/models'
import type { ModelMetricRow } from '@/lib/queries'

export const runtime = 'edge'
export const alt = 'The Open Model Index — GitFind'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const silkscreen = fetch(
  'https://fonts.gstatic.com/s/silkscreen/v6/m8JUjfVPf62XiF7kO-i9aAhATms.ttf'
).then((res) => res.arrayBuffer())

const geistMono = fetch(
  'https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeE9KJ5T.ttf'
).then((res) => res.arrayBuffer())

function total30d(rows: ModelMetricRow[]): number {
  const latest = new Map<string, number>()
  for (const r of rows) {
    if ((latest.get(r.model_key) ?? -1) < r.hf_downloads) latest.set(r.model_key, r.hf_downloads)
  }
  let total = 0
  for (const key of MODEL_REGISTRY.map((m) => m.key)) total += latest.get(key) ?? 0
  return total
}

export default async function Image() {
  const [silkscreenData, monoData, rows] = await Promise.all([silkscreen, geistMono, getModelMetrics()])
  const total = total30d(rows)
  const modelCount = MODEL_REGISTRY.filter((m) => m.family !== 'runtime').length

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
            open-weight adoption — daily
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <span style={{ fontFamily: 'Silkscreen', fontSize: '60px', fontWeight: 700, color: '#171512', lineHeight: 1.05 }}>
            THE OPEN MODEL INDEX
          </span>
          <span style={{ fontSize: '24px', lineHeight: 1.5, color: '#33302a', maxWidth: '900px' }}>
            Which open-weight models are developers actually building with? Weight downloads and GitHub velocity for DeepSeek, Llama, Qwen, Kimi, Mistral, and GLM.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid #171512', paddingTop: '18px' }}>
          <span style={{ fontSize: '18px', color: '#33302a' }}>
            <b style={{ color: '#171512', marginRight: '6px' }}>{total > 0 ? formatCount(total) : '—'}</b>30-day weight pulls · {modelCount} models tracked
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
