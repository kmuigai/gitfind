import type { Metadata } from 'next'
import Link from 'next/link'
import SubmitForm from '@/components/SubmitForm'

export const metadata: Metadata = {
  title: 'Submit a GitHub Project',
  description: 'Submit a GitHub project to GitFind. Projects with an Early Signal Score of 60+ are auto-approved to the directory.',
  openGraph: {
    title: 'Submit a GitHub Project — GitFind',
    description: 'Submit a GitHub project to GitFind. Projects with an Early Signal Score of 60+ are auto-approved.',
    url: 'https://gitfind.ai/submit',
  },
}

export default function SubmitPage() {
  return (
    <div className="min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
          <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
            GitFind
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground-muted)]">Submit a project</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-[var(--foreground)] sm:text-3xl">Submit a project</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Know a GitHub project that deserves more attention?
          </p>
        </div>

        {/* Criteria box */}
        <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--background-card)] p-5">
          <h2 className="mb-3 font-mono text-sm font-semibold text-[var(--foreground)]">How submissions work</h2>
          <ul className="space-y-2 text-sm text-[var(--foreground-muted)]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--score-high)]">✓</span>
              <span>
                <strong className="text-[var(--foreground)]">Free auto-approval</strong> — if the project&apos;s Early Signal Score is 60 or above, it&apos;s automatically added to the directory.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--foreground-subtle)]">→</span>
              <span>
                <strong className="text-[var(--foreground)]">Manual review</strong> — if the score is below 60, we&apos;ll review it and be in touch about listing options.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--foreground-subtle)]">ℹ</span>
              <span>
                The Early Signal Score measures star velocity, contributor growth, fork activity, and cross-platform mentions — not raw star count.
              </span>
            </li>
          </ul>
        </div>

        {/* Form */}
        <SubmitForm />
      </div>
    </div>
  )
}
