import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AI Code Index — GitFind'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  // Colors must match lib/colors.ts TOOL_COLORS
  const tools = [
    { name: 'Claude Code', color: '#6c6af6' },
    { name: 'Cursor', color: '#67e8f9' },
    { name: 'Copilot', color: '#3b82f6' },
    { name: 'Aider', color: '#86efac' },
    { name: 'Gemini CLI', color: '#fde68a' },
    { name: 'Devin', color: '#a78bfa' },
    { name: 'Codex', color: '#f9a8d4' },
  ]

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
                AI CODE INDEX
              </span>
            </div>
            <span style={{ color: '#e8e8f0', fontSize: '48px', fontWeight: 700, lineHeight: 1.1 }}>
              Which AI coding tool{'\n'}is winning?
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '32px' }}>
            {tools.map((tool) => (
              <div
                key={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  border: `1px solid ${tool.color}40`,
                  borderRadius: '4px',
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tool.color }} />
                <span style={{ color: tool.color, fontSize: '16px', letterSpacing: '0.05em' }}>{tool.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '18px', letterSpacing: '0.1em' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span style={{ color: '#22c55e' }}>LIVE</span>
          </div>
          <span style={{ color: '#1e1e2e' }}>·</span>
          <span style={{ color: '#555' }}>7 TOOLS</span>
          <span style={{ color: '#1e1e2e' }}>·</span>
          <span style={{ color: '#555' }}>ALL PUBLIC GITHUB REPOS</span>
          <span style={{ color: '#1e1e2e' }}>·</span>
          <span style={{ color: '#555' }}>UPDATED DAILY</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
