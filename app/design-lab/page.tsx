import Link from 'next/link'

const round3 = [
  {
    id: 'g',
    name: 'Scrollback',
    tag: 'One long terminal session',
    description:
      'The page is a terminal window, not a landing page: boot log, prompt commands, aligned-column output, an ASCII plot, and the project page rendered as a man page. DNA: ghostty.org chrome, windows93 boot log, One Dark data colors.',
    gains: 'Most conceptually pure — the medium IS the product. Zero landing-page clichés.',
  },
  {
    id: 'h',
    name: 'GITFIND/95',
    tag: 'Desktop OS parody, exact Win95',
    description:
      'Teal desktop, icons, taskbar with clock, beveled windows with real menus. Repos as an Explorer details view, segmented progress-bar scores, the project page as Notepad README plus a Properties dialog. DNA: poolsuite.net bevels, windows93.',
    gains: 'Instant nostalgia hit; the Properties-dialog scorecard finally gives the score a real home.',
  },
  {
    id: 'i',
    name: '1-Bit Parts Catalog',
    tag: 'Ink on cream, one yellow, dither',
    description:
      'Strict two-tone discipline with a single yellow accent, dither-textured chart, hard offset shadows, pixel display type, and a lowercase machine-log voice. DNA: play.date screen tones, teenage.engineering catalog, xxiivv dither.',
    gains: 'The most “designed by a human with taste” — restraint this strict cannot look templated.',
    extra: { href: '/design-lab/i/ai-index', label: 'AI index page' },
  },
]

const round2 = [
  { id: 'd', name: 'Phosphor CRT', description: 'Green-screen, scanlines, boot sequence, block gauges.' },
  { id: 'e', name: 'Bloomberg Terminal', description: 'Amber on charcoal, F-keys, ticker tape, dense panels.' },
  { id: 'f', name: 'BBS / ANSI', description: 'ASCII wordmark, double-line frames, shareware charm.' },
]

const round1 = [
  { id: 'a', name: 'Refined Terminal', description: 'Dark, mono labels only, editorial hierarchy.' },
  { id: 'b', name: 'Editorial Publication', description: 'Light, serif, tech-magazine reading.' },
  { id: 'c', name: 'Minimal Dashboard', description: 'Linear/Vercel-style compact data UI.' },
]

function Round({
  title,
  subtitle,
  items,
  featured,
}: {
  title: string
  subtitle: string
  items: { id: string; name: string; tag?: string; description: string; gains?: string; extra?: { href: string; label: string } }[]
  featured?: boolean
}) {
  return (
    <section className={featured ? 'mt-12' : 'mt-14'}>
      <h2 className={`font-semibold tracking-tight ${featured ? 'text-2xl' : 'text-lg text-zinc-700'}`}>
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      <div className={featured ? 'mt-6 space-y-4' : 'mt-5 space-y-3'}>
        {items.map((d) =>
          featured ? (
            <div key={d.id} className="rounded-xl border-2 border-zinc-900 bg-white p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold tracking-tight">
                  <span className="mr-2 font-mono text-sm text-zinc-400">{d.id.toUpperCase()}</span>
                  {d.name}
                  <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 align-middle font-mono text-[10px] uppercase tracking-wider text-white">
                    Round 3
                  </span>
                </h3>
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">{d.tag}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{d.description}</p>
              <p className="mt-1 text-sm text-zinc-500">{d.gains}</p>
              <div className="mt-4 flex gap-3 text-sm font-medium">
                <Link href={`/design-lab/${d.id}`} className="rounded-md bg-zinc-900 px-3.5 py-2 text-white hover:bg-zinc-700">
                  Homepage
                </Link>
                <Link href={`/design-lab/${d.id}/project`} className="rounded-md border border-zinc-300 px-3.5 py-2 text-zinc-700 hover:border-zinc-500">
                  Project page
                </Link>
                {d.extra ? (
                  <Link href={d.extra.href} className="rounded-md border border-zinc-300 px-3.5 py-2 text-zinc-700 hover:border-zinc-500">
                    {d.extra.label}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-semibold">
                  <span className="mr-2 font-mono text-xs text-zinc-400">{d.id.toUpperCase()}</span>
                  {d.name}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{d.description}</p>
              </div>
              <div className="flex gap-2 text-xs font-medium">
                <Link href={`/design-lab/${d.id}`} className="rounded border border-zinc-300 px-2.5 py-1.5 hover:border-zinc-500">
                  Home
                </Link>
                <Link href={`/design-lab/${d.id}/project`} className="rounded border border-zinc-300 px-2.5 py-1.5 hover:border-zinc-500">
                  Project
                </Link>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  )
}

export default function DesignLabIndex() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <style>{'body { background: #ffffff; }'}</style>
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          GitFind · Design Lab
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Round 3: after research
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600">
          Built after studying the real thing — charm.sh, ghostty.org, zed.dev, warp.dev,
          windows93, poolsuite.net, play.date, teenage.engineering, nothing.tech,
          analogue.co, xxiivv, lobste.rs, midnight.pub, textfiles.com, cameronsworld.net,
          htmx.org. Same sample data, same accessibility fixes, much stronger opinions.
        </p>

        <Round title="Round 3 — researched" subtitle="Structure-first: a session, an OS, a catalog." items={round3} featured />
        <Round title="Round 2 — terminal & retro" subtitle="First retro pass. Kept for comparison." items={round2} />
        <Round title="Round 1 — cleaner directions" subtitle="The safest set." items={round1} />

        <p className="mt-14 border-t border-zinc-200 pt-6 text-sm text-zinc-500">
          Previewing only — nothing here touches the live site.{' '}
          <Link href="/" className="font-medium text-zinc-900 underline underline-offset-4">
            Back to gitfind.ai
          </Link>
        </p>
      </div>
    </div>
  )
}
