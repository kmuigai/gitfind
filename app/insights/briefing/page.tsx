import type { Metadata } from 'next'
import Link from 'next/link'
import { getDigests } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import Reveal from '@/components/Reveal'

export const metadata: Metadata = {
  title: 'The Tuesday Briefing — Archive | GitFind',
  description:
    'Every issue of the GitFind Tuesday Briefing: the repos that moved, why they matter, and what to watch next. One email a week, archived here.',
  openGraph: {
    title: 'The Tuesday Briefing — Archive | GitFind',
    description: 'Every issue of the GitFind Tuesday Briefing, archived.',
    url: 'https://gitfind.ai/insights/briefing',
    type: 'article',
  },
}

export const revalidate = 3600

function formatWeek(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function BriefingArchivePage() {
  const issues = await getDigests(20)

  return (
    <div>
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <Link href="/insights" className="invert-hover px-1">insights</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">the tuesday briefing</span>
          </nav>
          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            THE TUESDAY BRIEFING
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Every issue, archived: the repos that moved, why they mattered, and
            what to watch next. One email a week, no noise — readable in the open.
          </p>
          <p className="mt-4 inline-block border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--body)]">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'} on file
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {issues.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--line-soft)] py-16 text-center">
            <p className="font-mono text-sm text-[var(--muted)]">no issues on file yet — the archive starts next tuesday.</p>
          </div>
        ) : (
          <ol className="space-y-4">
            {issues.map((issue, i) => (
              <Reveal key={issue.id}>
                <li>
                  <Link
                    href={`/insights/briefing/${issue.week_date}`}
                    className="press block border-2 border-[var(--line)] bg-[var(--paper)]"
                  >
                    <div className="flex items-baseline justify-between gap-3 border-b-2 border-[var(--line)] px-4 py-2">
                      <p className="font-mono text-[11px] tracking-wider text-[var(--muted)]">
                        issue no. {String(issues.length - i).padStart(3, '0')}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--muted)]">{formatWeek(issue.week_date)}</p>
                    </div>
                    <div className="p-4 sm:p-5">
                      <h2 className="font-mono text-[15px] font-bold leading-snug text-[var(--ink)]">
                        {issue.subject}
                      </h2>
                      <p className="mt-2 font-mono text-[12.5px] leading-[1.75] text-[var(--muted)] line-clamp-2">
                        {issue.intro}
                      </p>
                      <p className="mt-3 font-mono text-[11px] text-[var(--body)]">
                        {issue.projects.length} movers · {issue.new_entrants.length} on the radar
                        <span className="ml-3 font-bold text-[var(--ink)]">read the issue →</span>
                      </p>
                    </div>
                  </Link>
                </li>
              </Reveal>
            ))}
          </ol>
        )}

        <div className="mt-12">
          <NewsletterSignup />
        </div>
      </main>
    </div>
  )
}
