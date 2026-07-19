import Link from 'next/link'
import { featured } from '@/components/design-lab/sample-data'
import { GWindow, GPrompt, GManSection, GManHeader, GManFooter, GManScore, GManStats, GSeeAlso } from '@/components/design-lab/g'

export default function DesignLabGProject() {
  return (
    <div className="dl-g min-h-screen bg-[var(--dl-bg)] px-4 py-8 sm:py-12">
      <style>{'body { background: #050608; }'}</style>

      <GWindow title="man superpowers — 80×24">
        <GPrompt cmd="man superpowers" />

        <div className="mt-4">
          <GManHeader />

          <GManSection title="NAME">
            <p className="text-[var(--dl-body)]">
              {featured.owner}/{featured.name} — behavioral guardrails for AI coding agents
            </p>
          </GManSection>

          <GManSection title="SYNOPSIS">
            <p className="text-[var(--dl-body)]">
              <span className="font-bold text-[var(--dl-text)]">claude</span> --with{' '}
              <span className="text-[var(--dl-cyan)]">superpowers</span>{' '}
              <a href={featured.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--dl-cyan)] underline decoration-[var(--dl-border)] underline-offset-4 hover:text-[var(--dl-text)]">
                [source ↗]
              </a>
            </p>
          </GManSection>

          <GManSection title="DESCRIPTION">
            <p className="text-[var(--dl-body)]">
              {featured.summary} Instead of letting an agent loose on a vague prompt,
              Superpowers inserts a planning step: the agent must restate the goal,
              propose an approach, and wait for explicit approval before it touches
              the codebase.
            </p>
          </GManSection>

          <GManSection title="WHY IT MATTERS">
            <p className="text-[var(--dl-body)]">
              {featured.whyItMatters} For product leaders, this points directly at an
              emerging market category: AI workflow guardrails that make autonomous
              coding agents reliable enough to actually trust.
            </p>
          </GManSection>

          <GManSection title="TREND NOTES">
            <div className="space-y-2 text-[var(--dl-body)]">
              {featured.trendNarrative.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </GManSection>

          <GManSection title="SCORE">
            <GManScore />
          </GManSection>

          <GManSection title="STATS">
            <GManStats />
          </GManSection>

          <GManSection title="SEE ALSO">
            <GSeeAlso />
          </GManSection>

          <GManFooter />
        </div>

        <GPrompt cmd="q" />
        <p className="mt-2 text-[var(--dl-muted)]">
          (manual page closed) ·{' '}
          <Link href="/design-lab/g" className="text-[var(--dl-cyan)] underline decoration-[var(--dl-border)] underline-offset-4 hover:text-[var(--dl-text)]">
            gitfind trending
          </Link>
        </p>
      </GWindow>

      <p className="mx-auto mt-4 max-w-4xl text-center font-mono text-[10px] tracking-wider text-[var(--dl-muted)]">
        mock g — sample data, no live feeds · utf-8 · 80×24
      </p>
    </div>
  )
}
