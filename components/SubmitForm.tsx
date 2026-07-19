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
        <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">
            status — filed
          </p>
          <h2 className="font-display mt-3 text-lg font-bold text-[var(--ink)]">
            {response.auto_approved ? 'AUTO-APPROVED' : 'SUBMISSION RECEIVED'}
          </h2>
          <p className="mt-3 font-mono text-[13px] leading-[1.75] text-[var(--body)]">
            {response.message}
          </p>
          {typeof response.score === 'number' && (
            <p className="mt-3 font-mono text-[12px] text-[var(--muted)]">
              early signal score: <span className="font-bold text-[var(--ink)]">{response.score}/100</span>
            </p>
          )}
          <Link
            href="/"
            className="invert-hover mt-5 inline-block border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--body)]"
          >
            ← back to the index
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="border-2 border-[var(--line)] bg-[var(--paper)]"
        >
          <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
            fig. 02 — submission form
          </p>

          <div className="space-y-5 p-4 sm:p-6">
            <div>
              <label htmlFor="repo_url" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
                github repository url <span className="text-[var(--negative)]">*</span>
              </label>
              <input
                id="repo_url"
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                required
                disabled={status === 'loading'}
                className="w-full border-2 border-[var(--line)] bg-transparent px-3 py-2.5 font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:bg-white focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
                your email <span className="text-[var(--negative)]">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={status === 'loading'}
                className="w-full border-2 border-[var(--line)] bg-transparent px-3 py-2.5 font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:bg-white focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="note" className="mb-1.5 block font-mono text-[12px] font-bold text-[var(--ink)]">
                why should builders care? <span className="font-normal text-[var(--muted)]">(optional)</span>
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell us what makes this project interesting for builders, founders, or investors..."
                rows={3}
                disabled={status === 'loading'}
                className="w-full resize-none border-2 border-[var(--line)] bg-transparent px-3 py-2.5 font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:bg-white focus:outline-none disabled:opacity-50"
              />
            </div>

            {status === 'error' && response?.error && (
              <div className="border-2 border-[var(--negative)] px-4 py-3" role="alert">
                <p className="font-mono text-[12px] font-bold text-[var(--negative)]">
                  ✗ {response.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !repoUrl.trim() || !email.trim()}
              className="w-full border-2 border-[var(--line)] bg-[var(--accent)] px-5 py-3 font-mono text-[13px] font-bold text-[var(--ink)] transition-colors hover:bg-[#ffd05c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'loading' ? 'scoring repository…' : 'submit project'}
            </button>

            <p className="text-center font-mono text-[11.5px] leading-[1.75] text-[var(--muted)]">
              We’ll score your repo instantly. If it qualifies, it’s added automatically. Otherwise, we’ll reach out about listing options.
            </p>
          </div>
        </form>
      )}
    </>
  )
}
