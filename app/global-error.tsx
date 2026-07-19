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
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#171512', background: '#f4f1e6', minHeight: '100vh' }}>
          <h2 style={{ color: '#171512' }}>500 — machine error</h2>
          <p style={{ color: '#565249', marginTop: '0.5rem' }}>Something went wrong on our end.</p>
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              border: '2px solid #171512',
              background: '#ffc833',
              color: '#171512',
              fontFamily: 'monospace',
              fontWeight: 'bold',
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
