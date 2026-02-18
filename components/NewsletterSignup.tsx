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
    <section className="border-t border-[var(--border)] bg-[var(--background-elevated)] py-12">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Get the weekly digest
        </h2>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          What just moved on gitfind.ai — delivered every Tuesday. No noise, just signal.
        </p>

        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-[var(--score-high)]/30 bg-[var(--score-high)]/5 px-6 py-4">
            <p className="text-sm font-medium text-[var(--score-high)]">
              You&apos;re in. We&apos;ll email you when the digest launches.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex gap-2">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={status === 'loading'}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="mt-2 text-xs text-red-400">{errorMessage}</p>
        )}
      </div>
    </section>
  )
}
