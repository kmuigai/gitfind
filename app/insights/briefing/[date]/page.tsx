import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDigest, getDigests } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import Reveal from '@/components/Reveal'
import { formatCount, tierFor } from '@/lib/design'

export const revalidate = 3600

interface Props {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const issue = await getDigest(date)
  if (!issue) return { title: 'Issue Not Found' }
  return {
    title: `${issue.subject} — The Tuesday Briefing`,
    description: issue.intro.slice(0, 155),
    openGraph: {
      title: `${issue.subject} — GitFind`,
      description: issue.intro.slice(0, 155),
      url: `https://gitfind.ai/insights/briefing/${date}`,
      type: 'article',
    },
  }
}

export async function generateStaticParams() {
  const issues = await getDigests(20)
  return issues.map((i) => ({ date: i.week_date }))
}

function formatWeek(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function tierChipClass(tier: string): string {
  if (tier === 'Breakout') return 'bg-[var(--tier-breakout)]'
  if (tier === 'Hot') return 'bg-[var(--tier-hot)]'
  return 'bg-[var(--tier-active)]'
}

export default async function BriefingIssuePage({ params }: Props) {
  const { date } = await params
  const issue = await getDigest(date)
  if (!issue) notFound()

  return (
    <div>
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-8 sm:px-6">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/insights/briefing" className="invert-hover px-1">the tuesday briefing</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">{formatWeek(issue.week_date)}</span>
          </nav>
          <h1 className="font-display mt-5 text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl">
            {issue.subject}
          </h1>
          <p className="mt-4 font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            {issue.intro}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Top movers */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 1 — top movers this week</p>
          <p>{issue.projects.length} entries</p>
        </div>
        <div className="mt-5 space-y-5">
          {issue.projects.map((p, i) => {
            const tier = tierFor(p.score)
            return (
              <Reveal key={`${p.owner}/${p.name}`}>
                <article className="press border-2 border-[var(--line)] bg-[var(--paper)]">
                  <div className="flex items-baseline justify-between gap-3 border-b-2 border-[var(--line)] px-4 py-2">
                    <p className="font-mono text-[11px] tracking-wider text-[var(--muted)]">
                      no. {String(i + 1).padStart(3, '0')}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--muted)]">{p.category.toLowerCase()}</p>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/project/${p.owner}/${p.name}`} className="min-w-0">
                        <h2 className="break-words font-mono text-lg font-bold leading-snug text-[var(--ink)]">
                          <span className="font-normal text-[var(--muted)]">{p.owner}/</span>
                          {p.name}
                        </h2>
                      </Link>
                      <div className="shrink-0 text-right font-mono" title={`Early Signal Score: ${p.score}/100 — ${tier}`}>
                        <p className="text-[15px] font-bold text-[var(--ink)]">
                          {p.score}<span className="font-normal text-[var(--muted)]">/100</span>
                        </p>
                        <p className={`mt-1 inline-block px-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--paper)] ${tierChipClass(tier)}`}>
                          {tier}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 font-mono text-[13px] leading-[1.85] text-[var(--body)]">
                      {p.story}
                    </p>
                    <p className="mt-3 font-mono text-[11.5px] font-bold text-[var(--positive)]">
                      ▲ +{formatCount(p.stars_7d)} stars this week
                    </p>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </div>

        {/* New on the radar */}
        {issue.new_entrants.length > 0 && (
          <>
            <div className="mt-12 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
              <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 2 — new on the radar</p>
              <p>{issue.new_entrants.length} entries</p>
            </div>
            <div className="mt-5 space-y-4">
              {issue.new_entrants.map((e) => (
                <Reveal key={`${e.owner}/${e.name}`}>
                  <div className="border-2 border-[var(--line)] bg-[var(--paper)] px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/project/${e.owner}/${e.name}`} className="font-mono text-[13px] font-bold text-[var(--ink)]">
                        {e.owner}/{e.name}
                      </Link>
                      <span className="font-mono text-[11px] font-bold text-[var(--ink)]">
                        {e.score}<span className="font-normal text-[var(--muted)]">/100</span>
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-[12.5px] leading-[1.75] text-[var(--muted)]">{e.blurb}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </>
        )}

        {/* AI pulse */}
        {issue.ai_pulse ? (
          <div className="mt-12">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
              <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 3 — ai pulse</p>
            </div>
            <div className="mt-4 border-2 border-[var(--line)] bg-[var(--ink)] p-4 font-mono text-[12.5px] leading-[1.8] text-[var(--paper)]">
              <p className="text-[var(--accent)]">$ ai-pulse --week {issue.week_date}</p>
              <p className="mt-1">{issue.ai_pulse}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-12">
          <NewsletterSignup />
        </div>
      </main>
    </div>
  )
}
