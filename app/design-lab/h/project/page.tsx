import { featured, related, pctLabel } from '@/components/design-lab/sample-data'
import { HDesktop, HWindow, HExplorerRows, HProperties, HSubscribeDialog } from '@/components/design-lab/h'

export default function DesignLabHProject() {
  return (
    <HDesktop>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        {/* Notepad README */}
        <HWindow title="README.TXT — Notepad" menu={['File', 'Edit', 'Search', 'Help']}>
          <div className="dl-bevel-sunken m-[2px] h-full p-4 text-[12.5px] leading-[1.75] text-black sm:p-5">
            <p className="font-bold">
              {featured.owner}/{featured.name}
            </p>
            <p className="mt-1 text-[var(--dl-body)]">
              category: {featured.category} · {featured.language} ·{' '}
              {pctLabel(featured.pct7d)} this week (+{featured.stars7d.toLocaleString('en-US')} stars) ·{' '}
              <a href={featured.url} target="_blank" rel="noopener noreferrer" className="text-[#0000a8] underline">
                view on github
              </a>
            </p>
            <p className="mt-3">{'='.repeat(56)}</p>

            <p className="mt-3 font-bold">WHAT IT DOES</p>
            <p className="mt-1">
              {featured.summary} Instead of letting an agent loose on a vague prompt,
              Superpowers inserts a planning step: the agent must restate the goal,
              propose an approach, and wait for explicit approval before it touches
              the codebase.
            </p>

            <p className="mt-4 font-bold">WHY IT MATTERS</p>
            <p className="mt-1">
              {featured.whyItMatters} For product leaders, this points directly at an
              emerging market category: AI workflow guardrails that make autonomous
              coding agents reliable enough to actually trust.
            </p>

            <p className="mt-4 font-bold">WHY IT’S TRENDING</p>
            {featured.trendNarrative.map((p) => (
              <p key={p.slice(0, 24)} className="mt-1">{p}</p>
            ))}

            <p className="mt-4">{'='.repeat(56)}</p>
            <p className="mt-2 text-[var(--dl-body)]">
              file last saved {featured.scoredAt}, 9:41 AM · see also: PROPERTIES for
              score and stats
            </p>
          </div>
        </HWindow>

        {/* Properties dialog */}
        <div className="flex items-start xl:justify-end">
          <HProperties />
        </div>
      </div>

      {/* Related */}
      <div className="mt-4">
        <HWindow title="MORE_FILES.EXE" status="4 object(s)">
          <HExplorerRows items={related} />
        </HWindow>
      </div>

      <div className="mt-4 flex justify-center lg:justify-start">
        <HSubscribeDialog />
      </div>
    </HDesktop>
  )
}
