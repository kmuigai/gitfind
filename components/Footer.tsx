'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDDEN_ROUTES = ['/ai-code-index']

export default function Footer() {
  const pathname = usePathname()

  if (HIDDEN_ROUTES.includes(pathname)) return null

  return (
    <footer
      className="border-t border-[var(--border)] py-6"
      style={{ overflowX: 'clip', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
    >
      <div className="px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
          <Link href="/" className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors">
            <span className="text-[var(--accent)] font-bold">❯</span>
            <span className="font-bold text-[var(--foreground)]">gitfind.ai</span>
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/ai-code-index" className="hover:text-[var(--foreground)] transition-colors">AI Code Index</Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/insights" className="hover:text-[var(--foreground)] transition-colors">Insights</Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/submit" className="hover:text-[var(--foreground)] transition-colors">Submit</Link>
          <span className="text-[var(--border)]">·</span>
          <a href="https://github.com/kmuigai/gitfind" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">GitHub</a>
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-[var(--foreground-subtle)]">
          Git Signal · Git Context · Git Clarity · <strong className="text-[var(--foreground-muted)]">Git Smarter</strong>
        </p>
      </div>
    </footer>
  )
}
