import Link from 'next/link'
import { featured, related, formatCount, pctLabel } from '@/components/design-lab/sample-data'
import { BNav, BFooter, BSectionHeader, BFactBox, BNewsletter, BScoreNote } from '@/components/design-lab/b'

export default function DesignLabBProject() {
  return (
    <div className="dl-b min-h-screen bg-[var(--dl-bg)] text-[var(--dl-text)]">
      <style>{'body { background: #faf9f6; }'}</style>
      <BNav />

      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        {/* Kicker + headline */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dl-accent)]">
          <Link href="/design-lab/b" className="hover:underline">Trending</Link>
          <span className="mx-2 text-[var(--dl-border)]">·</span>
          {featured.category}
        </p>
        <h1 className="dl-serif mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          {featured.owner}/{featured.name}
        </h1>
        <p className="dl-serif mt-5 text-xl leading-relaxed text-[var(--dl-body)]">
          {featured.summary}
        </p>

        {/* Byline */}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--dl-border)] py-3.5 text-xs text-[var(--dl-muted)]">
          <BScoreNote score={featured.score} />
          <span className="font-semibold text-[var(--dl-positive)]">
            ▲ {pctLabel(featured.pct7d)} this week
          </span>
          <span>{featured.language}</span>
          <span>Updated {featured.scoredAt}</span>
          <a
            href={featured.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-semibold text-[var(--dl-accent)] underline decoration-[var(--dl-border)] underline-offset-4 hover:decoration-[var(--dl-accent)]"
          >
            View on GitHub ↗
          </a>
        </div>

        {/* Body + fact box */}
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">
          <div className="space-y-10">
            <section>
              <h2 className="dl-serif text-2xl font-bold tracking-tight">What it does</h2>
              <p className="dl-serif mt-4 text-[17px] leading-[1.75] text-[var(--dl-body)]">
                {featured.summary} Instead of letting an agent loose on a vague prompt,
                Superpowers inserts a planning step: the agent must restate the goal,
                propose an approach, and wait for explicit approval before it touches
                the codebase.
              </p>
            </section>

            <section>
              <h2 className="dl-serif text-2xl font-bold tracking-tight">Why it matters</h2>
              <blockquote className="dl-serif mt-4 border-l-[3px] border-[var(--dl-accent)] pl-5 text-[21px] italic leading-[1.6] text-[var(--dl-text)]">
                Guardrails that make autonomous coding agents reliable enough to trust
                are becoming their own product category.
              </blockquote>
              <p className="dl-serif mt-4 text-[17px] leading-[1.75] text-[var(--dl-body)]">
                {featured.whyItMatters} Nearly 9,000 developers starred the project in a
                single week — a signal that the frustration of AI coding tools going
                rogue and building the wrong thing has reached a tipping point.
              </p>
            </section>

            <section>
              <h2 className="dl-serif text-2xl font-bold tracking-tight">Why it’s trending</h2>
              <div className="dl-serif mt-4 space-y-4 text-[17px] leading-[1.75] text-[var(--dl-body)]">
                {featured.trendNarrative.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
              <p className="mt-6 border-t border-[var(--dl-border)] pt-4 text-sm text-[var(--dl-muted)]">
                +{featured.stars7d.toLocaleString('en-US')} stars this week ({pctLabel(featured.pct7d)} vs last week) ·{' '}
                {featured.commits30d} commits in 30 days · {formatCount(featured.forks)} forks
              </p>
            </section>
          </div>

          <BFactBox />
        </div>
      </article>

      {/* Further reading */}
      <section className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <BSectionHeader kicker="Further reading" title="Related projects" />
        <ol className="divide-y divide-[var(--dl-border)] border-y border-[var(--dl-border)]">
          {related.map((repo, i) => (
            <li key={`${repo.owner}/${repo.name}`}>
              <Link href="/design-lab/b/project" className="group flex gap-5 py-5">
                <span className="dl-serif text-2xl font-bold text-[var(--dl-border)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="dl-serif block text-lg font-bold leading-snug text-[var(--dl-text)] group-hover:text-[var(--dl-accent-strong)]">
                    {repo.owner}/{repo.name}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--dl-muted)] line-clamp-1">
                    {repo.summary}
                  </span>
                  <span className="mt-1.5 block text-xs text-[var(--dl-muted)]">
                    {repo.category} · {pctLabel(repo.pct7d)} this week
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
        <BNewsletter />
      </section>

      <BFooter />
    </div>
  )
}
