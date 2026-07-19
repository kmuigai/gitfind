import type { Metadata } from 'next'
import Link from 'next/link'
import SubmitForm from '@/components/SubmitForm'
import Reveal from '@/components/Reveal'

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
    <div>
      {/* Spec header */}
      <section className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-12">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">submit a project</span>
          </nav>

          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            SUBMIT A PROJECT
          </h1>
          <p className="mt-4 max-w-xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Know a GitHub project that deserves more attention?
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Criteria */}
        <Reveal>
          <figure className="border-2 border-[var(--line)] bg-[var(--paper)]">
            <p className="border-b-2 border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--muted)]">
              fig. 01 — how submissions work
            </p>
            <ul className="space-y-3 p-4 font-mono text-[13px] leading-[1.75] text-[var(--body)] sm:p-5">
              <li className="flex items-start gap-3">
                <span className="font-bold text-[var(--positive)]">✓</span>
                <span>
                  <strong className="text-[var(--ink)]">Free auto-approval</strong> — if the project’s Early Signal Score is 60 or above, it’s automatically added to the directory.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold text-[var(--muted)]">→</span>
                <span>
                  <strong className="text-[var(--ink)]">Manual review</strong> — if the score is below 60, we’ll review it and be in touch about listing options.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold text-[var(--muted)]">ℹ</span>
                <span>
                  The Early Signal Score measures star velocity, contributor growth, fork activity, and cross-platform mentions — not raw star count.
                </span>
              </li>
            </ul>
          </figure>
        </Reveal>

        {/* Form */}
        <Reveal className="mt-8">
          <SubmitForm />
        </Reveal>
      </div>
    </div>
  )
}
