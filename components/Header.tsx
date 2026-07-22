'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { label: 'home', href: '/' },
  { label: 'ai/ml', href: '/category/ai-ml' },
  { label: 'dev tools', href: '/category/developer-tools' },
  { label: 'ai code index', href: '/ai-code-index' },
  { label: 'insights', href: '/insights' },
]

const MOBILE_EXTRA = [
  { label: 'security', href: '/category/security' },
  { label: 'infrastructure', href: '/category/infrastructure-devops' },
  { label: 'submit', href: '/submit' },
]

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="8" y="6" width="48" height="52" fill="var(--paper)" stroke="var(--ink)" strokeWidth="4" />
      <text x="18" y="39" fontFamily="var(--font-silkscreen), monospace" fontSize="28" fontWeight="700" fill="var(--ink)">
        G
      </text>
      <rect className="blink-3" x="19" y="44" width="26" height="8" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2.5" />
    </svg>
  )
}

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="border-b-2 border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="GitFind home">
            <LogoMark className="h-7 w-7" />
            <span className="font-display text-sm font-bold text-[var(--ink)]">GITFIND</span>
          </Link>
          <nav className="hidden items-center gap-4 font-mono text-[12px] md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-1.5 py-0.5 ${
                  isActive(link.href)
                    ? 'bg-[var(--ink)] font-bold text-[var(--paper)]'
                    : 'invert-hover text-[var(--muted)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="hidden border-2 border-[var(--line)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--ink)] invert-hover sm:block"
          >
            submit
          </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center border-2 border-[var(--line)] font-mono text-sm font-bold text-[var(--ink)] md:hidden"
          >
            {open ? '×' : '≡'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t-2 border-[var(--line)] bg-[var(--paper)] px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col font-mono text-[13px]">
            {[...NAV_LINKS, ...MOBILE_EXTRA].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-2 py-3 ${
                  isActive(link.href)
                    ? 'bg-[var(--ink)] font-bold text-[var(--paper)]'
                    : 'text-[var(--body)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
