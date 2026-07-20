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
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="press border-2 border-[var(--line)] bg-[var(--paper)] p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">form 27-b — subscription</p>
        <h2 className="font-display mt-3 text-xl font-bold text-[var(--ink)] sm:text-2xl">
          THE TUESDAY BRIEFING
        </h2>
        <p className="mt-2 max-w-md font-mono text-[12.5px] leading-[1.8] text-[var(--body)]">
          The repos that moved this week, why they matter, and what to watch next.
          One email. No noise.
        </p>

        {status === 'success' ? (
          <div className="mt-5 border-2 border-[var(--line)] bg-[var(--accent)] px-4 py-3 font-mono text-[12px] font-bold text-[var(--ink)]">
            ✓ Filed. First issue lands Tuesday.
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 flex max-w-md flex-col gap-3 font-mono sm:flex-row">
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
              className="h-10 flex-1 border-2 border-[var(--line)] bg-transparent px-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:bg-white focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="h-10 shrink-0 border-2 border-[var(--line)] bg-[var(--accent)] px-5 text-[13px] font-bold text-[var(--ink)] transition-colors hover:bg-[#ffd05c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'loading' ? 'filing…' : 'file it'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="mt-3 font-mono text-[12px] font-bold text-[var(--negative)]" role="alert">
            ✗ {errorMessage}
          </p>
        )}
      </div>
    </section>
  )
}
