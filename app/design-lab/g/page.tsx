import Link from 'next/link'
import { repos } from '@/components/design-lab/sample-data'
import { GWindow, GPrompt, GComment, GBoot, GBanner, GTrendingTable, GPlot, GSubscribe } from '@/components/design-lab/g'

export default function DesignLabG() {
  return (
    <div className="dl-g min-h-screen bg-[var(--dl-bg)] px-4 py-8 sm:py-12">
      <style>{'body { background: #050608; }'}</style>

      <GWindow title="gitfind — zsh — 80×24">
        <GBoot />

        <GPrompt cmd="gitfind --banner" />
        <GBanner />

        <GPrompt cmd="gitfind trending --week 29 --limit 6" />
        <GComment>ranked by early signal score · 6 results (0.041s)</GComment>
        <GTrendingTable items={repos} />

        <GPrompt cmd="gitfind plot claude-code --30d" />
        <GComment>daily commits across public github, tracked since 2025</GComment>
        <GPlot />

        <GPrompt cmd="subscribe --weekly" />
        <GSubscribe />

        <GPrompt cmd="exit" />
        <p className="mt-2 text-[var(--dl-muted)]">
          logout — session ended ·{' '}
          <Link href="/design-lab" className="text-[var(--dl-cyan)] underline decoration-[var(--dl-border)] underline-offset-4 hover:text-[var(--dl-text)]">
            back to design lab
          </Link>
        </p>
      </GWindow>

      <p className="mx-auto mt-4 max-w-4xl text-center font-mono text-[10px] tracking-wider text-[var(--dl-muted)]">
        mock g — sample data, no live feeds · utf-8 · 80×24
      </p>
    </div>
  )
}
