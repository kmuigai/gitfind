'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || status === 'loading') return

    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setStatus('error')
        setErrorMessage(data.error ?? 'Something went wrong. Try again.')
        return
      }

      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
      setErrorMessage('Network error. Please try again.')
    }
  }

  return (
    <section className="border-t border-[var(--border)] py-10">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <div className="term-label mb-3">{'// SUBSCRIBE'}</div>
        <p className="font-mono text-xs text-[var(--foreground-muted)] leading-relaxed">
          The repos that moved this week, why they matter, and what to watch next. One email. No noise.
        </p>

        {status === 'success' ? (
          <div className="mt-4 px-3 py-2 font-mono text-[11px]" style={{ borderLeft: '2px solid var(--score-high)', background: 'rgba(255,255,255,0.02)' }}>
            <span className="font-bold text-[var(--score-high)]">[OK]</span>
            {' '}
            <span className="text-[var(--foreground-muted)]">Subscribed. We&apos;ll email you when the digest launches.</span>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex gap-2">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--accent)]">
                ❯
              </span>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="YOU@COMPANY.COM"
                required
                disabled={status === 'loading'}
                className="term-input w-full disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="shrink-0 border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderRadius: '2px', boxShadow: '0 0 12px rgba(108,106,246,0.2)' }}
            >
              {status === 'loading' ? 'EXEC...' : 'SUBSCRIBE'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <div className="mt-2 font-mono text-[11px]">
            <span className="font-bold text-[var(--error)]">[ERR]</span>
            {' '}
            <span className="text-[var(--foreground-muted)]">{errorMessage}</span>
          </div>
        )}
      </div>
    </section>
  )
}
