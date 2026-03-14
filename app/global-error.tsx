'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#e8e8f0', background: '#0a0a0f', minHeight: '100vh' }}>
          <h2 style={{ color: '#6c6af6' }}>{'// ERROR'}</h2>
          <p style={{ color: '#7a7a9a', marginTop: '0.5rem' }}>Something went wrong.</p>
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              border: '1px solid #6c6af6',
              background: 'transparent',
              color: '#6c6af6',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
