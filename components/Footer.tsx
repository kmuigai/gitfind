import Link from 'next/link'

const BADGES = ['no gradients', 'works in lynx', 'made with html', '1-bit certified']

export default function Footer() {
  return (
    <footer className="border-t-2 border-[var(--line)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
        <div>
          <p className="font-display text-sm font-bold text-[var(--ink)]">GITFIND</p>
          <p className="mt-1 max-w-xs font-mono text-[11px] leading-relaxed text-[var(--muted)]">
            github, translated. rising open source, explained in plain english.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] text-[var(--muted)]" aria-label="Footer">
          <Link href="/ai-code-index" className="invert-hover px-1">ai code index</Link>
          <Link href="/insights" className="invert-hover px-1">insights</Link>
          <Link href="/submit" className="invert-hover px-1">submit</Link>
          <a
            href="https://github.com/kmuigai/gitfind"
            target="_blank"
            rel="noopener noreferrer"
            className="invert-hover px-1"
          >
            github
          </a>
        </nav>
        <div className="flex flex-wrap gap-2">
          {BADGES.map((b) => (
            <span
              key={b}
              className="border-2 border-[var(--line)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--line-soft)]">
        <p className="mx-auto max-w-5xl px-4 py-3 font-mono text-[10px] text-[var(--muted)] sm:px-6">
          © 2026 gitfind · the tuesday briefing
        </p>
      </div>
    </footer>
  )
}
