import Link from 'next/link'
import { repos } from '@/components/design-lab/sample-data'
import { DChrome, DNav, DStatusBar, DSectionHead, DRepoCard, DChart, DNewsletter } from '@/components/design-lab/d'

export default function DesignLabD() {
  return (
    <DChrome>
      <DNav />

      {/* Boot hero */}
      <section className="border-b border-[var(--dl-border)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="space-y-1.5 text-[11px] tracking-wider text-[var(--dl-muted)]">
            <p className="dl-boot-1">GITFIND BIOS v2.6.1 — CHECKING SIGNAL FEEDS ......... <span className="text-[var(--dl-accent)]">OK</span></p>
            <p className="dl-boot-2">LOADING 2,847 REPOSITORIES ........................ <span className="text-[var(--dl-accent)]">OK</span></p>
            <p className="dl-boot-3">TRANSLATION ENGINE READY.<span className="dl-blink text-[var(--dl-accent)]">_</span></p>
          </div>

          <h1 className="dl-glow-green mt-10 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            GITHUB,<br />TRANSLATED.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-[1.8] text-[var(--dl-body)] sm:text-[15px]">
            &gt; The rising open-source projects that matter — explained in plain
            English, before everyone else sees them._
          </p>

          <div className="mt-10 flex max-w-lg items-center gap-2 border border-[var(--dl-border)] bg-[var(--dl-surface)] px-4 py-3 focus-within:border-[var(--dl-accent)]">
            <span className="text-sm text-[var(--dl-accent)]">❯</span>
            <input
              type="search"
              aria-label="Search repositories"
              placeholder="SEARCH REPOS, TOPICS, OWNERS…"
              className="w-full bg-transparent text-[13px] tracking-wide text-[var(--dl-text)] placeholder:text-[var(--dl-muted)] focus:outline-none"
            />
            <span className="dl-blink hidden text-sm text-[var(--dl-accent)] sm:block">█</span>
          </div>
        </div>
      </section>

      {/* Trending grid */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <DSectionHead
          index="01"
          title="THIS WEEK’S MOVERS"
          note="Ranked by Early Signal Score — a 0–100 blend of star growth, active builders, community buzz, and commit pace. Hover any gauge for the full readout."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <DRepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </div>
      </section>

      {/* Chart */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <DSectionHead
          index="02"
          title="AI COMMIT TRACKING"
          note="How much code AI tools are actually shipping — tracked daily across public GitHub."
        />
        <DChart />
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <DNewsletter />
      </section>

      <footer className="mx-auto max-w-5xl px-4 pb-6 text-[10px] tracking-wider text-[var(--dl-muted)] sm:px-6">
        <p>❯ GITFIND.SYS — GITHUB, TRANSLATED · <Link href="/design-lab" className="hover:text-[var(--dl-accent)]">[ESC] EXIT TO DESIGN LAB</Link></p>
      </footer>

      <DStatusBar />
    </DChrome>
  )
}
