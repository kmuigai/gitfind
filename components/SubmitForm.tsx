'use client'

import { useState } from 'react'
import Link from 'next/link'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface SubmitResponse {
  success?: boolean
  message?: string
  score?: number
  auto_approved?: boolean
  error?: string
}

export default function SubmitForm() {
  const [repoUrl, setRepoUrl] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [response, setResponse] = useState<SubmitResponse | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    setResponse(null)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl.trim(), email: email.trim(), note: note.trim() }),
      })

      const data = (await res.json()) as SubmitResponse

      if (!res.ok) {
        setStatus('error')
        setResponse(data)
        return
      }

      setStatus('success')
      setResponse(data)
    } catch {
      setStatus('error')
      setResponse({ error: 'Network error. Please try again.' })
    }
  }

  return (
    <>
      {status === 'success' && response ? (
        <div className="rounded-lg border border-[var(--score-high)]/30 bg-[var(--score-high)]/5 p-6">
          <h2 className="text-base font-semibold text-[var(--score-high)]">
            {response.auto_approved ? 'Auto-approved' : 'Submission received'}
          </h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">{response.message}</p>
          {typeof response.score === 'number' && (
            <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
              Early Signal Score: <span className="font-mono font-medium text-[var(--foreground)]">{response.score}</span>/100
            </p>
          )}
          <Link
            href="/"
            className="mt-4 inline-block text-xs text-[var(--accent)] transition-opacity hover:opacity-80"
          >
            ← Back to GitFind
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div>
            <label htmlFor="repo_url" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              GitHub repository URL <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="repo_url"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              required
              disabled={status === 'loading'}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 disabled:opacity-50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Your email <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={status === 'loading'}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 disabled:opacity-50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="note" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Why should builders care? <span className="text-[var(--foreground-muted)] font-normal">(optional)</span>
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell us what makes this project interesting for builders, founders, or investors..."
              rows={3}
              disabled={status === 'loading'}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 disabled:opacity-50 resize-none transition-colors"
            />
          </div>

          {status === 'error' && response?.error && (
            <div className="rounded-lg border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-3">
              <p className="text-sm text-[var(--error)]">{response.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !repoUrl.trim() || !email.trim()}
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? 'Scoring repository...' : 'Submit project'}
          </button>

          <p className="text-center text-xs text-[var(--foreground-subtle)]">
            We&apos;ll score your repo instantly. If it qualifies, it&apos;s added automatically. Otherwise, we&apos;ll reach out about listing options.
          </p>
        </form>
      )}
    </>
  )
}
