'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface AccessResponse {
  success?: boolean
  error?: string
}

const TIER_OPTIONS = ['Free', 'Builder', 'Growth', 'Scale', 'Not sure'] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClass =
  'w-full border-2 border-[var(--line)] bg-transparent px-3 py-2.5 font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:bg-white focus:outline-none disabled:opacity-50'

export default function ApiAccessForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [useCase, setUseCase] = useState('')
  const [tier, setTier] = useState<string>('Not sure')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const emailValid = EMAIL_RE.test(email.trim())
  const canSubmit =
    status !== 'loading' &&
    name.trim().length > 0 &&
    emailValid &&
    company.trim().length > 0 &&
    useCase.trim().length > 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'loading') return

    if (!EMAIL_RE.test(email.trim())) {
      setStatus('error')
      setError('That email doesn’t look right — check it and try again.')
      return
    }

    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/api-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          use_case: useCase.trim(),
          tier,
        }),
      })

      const data = (await res.json()) as AccessResponse

      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">
          status — filed
        </p>
        <h3 className="font-display mt-3 text-lg font-bold text-[var(--ink)]">
          REQUEST RECEIVED
        </h3>
        <p className="mt-3 font-mono text-[13px] leading-[1.75] text-[var(--body)]">
          Thanks — your request is in. We read every one by hand and reply
          within a few days. If there’s a fit, you’ll get an early-access key
          as soon as the first endpoints open.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-2 border-[var(--line)] bg-[var(--paper)]"
    >
      <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
        fig. 05 — request access
      </p>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
              your name <span className="text-[var(--negative)]">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              required
              disabled={status === 'loading'}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
              work email <span className="text-[var(--negative)]">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={status === 'loading'}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="company" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
              company <span className="text-[var(--negative)]">*</span>
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company or project"
              required
              disabled={status === 'loading'}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="tier" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
              tier interest
            </label>
            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              disabled={status === 'loading'}
              className={inputClass}
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="use_case" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
            what would you build with it? <span className="text-[var(--negative)]">*</span>
          </label>
          <textarea
            id="use_case"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            placeholder="e.g. a trending-in-your-stack widget for our devrel site, refreshed nightly…"
            rows={4}
            required
            disabled={status === 'loading'}
            className={`${inputClass} resize-none`}
          />
        </div>

        {status === 'error' && error && (
          <div className="border-2 border-[var(--negative)] px-4 py-3" role="alert">
            <p className="font-mono text-[12px] font-bold text-[var(--negative)]">
              ✗ {error}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full border-2 border-[var(--line)] bg-[var(--accent)] px-5 py-3 font-mono text-[13px] font-bold text-[var(--ink)] transition-colors hover:bg-[#ffd05c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'sending request…' : 'request access'}
        </button>

        <p className="text-center font-mono text-[11.5px] leading-[1.75] text-[var(--muted)]">
          No spam, no list. Your request goes to a human inbox and the reply
          comes from a human too.
        </p>
      </div>
    </form>
  )
}
