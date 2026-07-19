import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">
        error — catalog lookup failed
      </p>
      <h1 className="font-display mt-5 text-6xl font-bold text-[var(--ink)] sm:text-8xl">
        404
      </h1>
      <p className="mt-4 font-mono text-[14px] leading-[1.8] text-[var(--body)]">
        file not found in the catalog.
      </p>

      <div className="mt-8 inline-block border-2 border-[var(--line)] bg-[var(--ink)] px-4 py-3 font-mono text-[12.5px] text-[var(--paper)]">
        <p>$ gitfind find &lt;page&gt;</p>
        <p className="mt-1">
          <span className="text-[var(--accent)]">... not found</span>
          <span className="blink"> ▌</span>
        </p>
      </div>

      <div className="mt-10">
        <Link
          href="/"
          className="press inline-block border-2 border-[var(--line)] bg-[var(--paper)] px-4 py-2 font-mono text-[12px] font-bold text-[var(--ink)]"
        >
          ← back to the index
        </Link>
      </div>
    </div>
  )
}
