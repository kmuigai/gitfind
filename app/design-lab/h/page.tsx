import { repos, chartStats } from '@/components/design-lab/sample-data'
import { HDesktop, HWindow, HExplorerRows, HPlot, HSubscribeDialog } from '@/components/design-lab/h'

export default function DesignLabH() {
  return (
    <HDesktop>
      {/* Main window */}
      <HWindow title="TRENDING.EXE" status="6 object(s) — sorted by Early Signal Score">
        {/* Banner strip */}
        <div className="dl-bevel-sunken m-[2px] mb-2 p-5 sm:p-7">
          <p className="dl-pixel text-2xl font-bold leading-none text-black sm:text-4xl">
            GITFIND<span className="text-[#0000a8]">.</span>
          </p>
          <h1 className="mt-3 text-xl font-bold text-black sm:text-2xl">
            GitHub, translated.
          </h1>
          <p className="mt-1.5 max-w-lg text-[12px] leading-relaxed text-[var(--dl-body)]">
            The rising open-source projects that matter — explained in plain English,
            before everyone else sees them.
          </p>
          <p className="mt-3 text-[11px] text-[var(--dl-muted)]">
            C:\GITFIND\TRENDING — week 29 · 2,847 repos indexed · updated 9:41 AM
          </p>
        </div>
        <HExplorerRows items={repos} />
      </HWindow>

      {/* Second row: chart + dialog */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HWindow title="PLOT.EXE" menu={['File', 'View', 'Help']} status="CLAUDE_CODE.DAT — 30 days">
          <div className="m-[2px] mb-1 px-2 pt-1 text-[11px] text-black">
            <b>AI commit tracking</b> — {chartStats.totalLabel} · latest {chartStats.latest.toLocaleString('en-US')}/day ·{' '}
            <span className="font-bold text-[var(--dl-positive)]">{chartStats.deltaLabel}</span>
          </div>
          <HPlot />
        </HWindow>

        <div className="flex items-start justify-center lg:justify-start">
          <HSubscribeDialog />
        </div>
      </div>
    </HDesktop>
  )
}
