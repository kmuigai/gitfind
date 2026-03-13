'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

const NAV_LINKS = [
  { label: 'HOME', href: '/' },
  { label: 'AI/ML', href: '/category/ai-ml' },
  { label: 'DEV TOOLS', href: '/category/developer-tools' },
  { label: 'AI CODE INDEX', href: '/ai-code-index' },
  { label: 'INSIGHTS', href: '/insights' },
]

const MOBILE_CATEGORIES = [
  { label: 'AI/ML', href: '/category/ai-ml' },
  { label: 'DEV TOOLS', href: '/category/developer-tools' },
  { label: 'SECURITY', href: '/category/security' },
  { label: 'INFRASTRUCTURE', href: '/category/infrastructure-devops' },
]

const MOBILE_FEATURES = [
  { label: 'AI CODE INDEX', href: '/ai-code-index' },
  { label: 'INSIGHTS', href: '/insights' },
  { label: 'SUBMIT', href: '/submit' },
]

export default function TerminalNav() {
  const pathname = usePathname()
  const [time, setTime] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header style={{ background: 'var(--background)', fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, monospace' }}>
      {/* NAV BAR */}
      <nav
        className="h-10 flex items-center px-4 justify-between text-[11px] uppercase tracking-wider"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1">
          {/* Desktop logo */}
          <Link href="/" className="hidden sm:flex items-center gap-1.5 mr-4 hover:opacity-80 transition-opacity">
            <span className="text-[var(--accent)] font-bold">❯</span>
            <span className="font-bold tracking-tight text-[var(--foreground)]">GITFIND.AI</span>
          </Link>

          {/* Mobile logo + hamburger */}
          <div className="sm:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <span className={`text-[var(--accent)] font-bold transition-transform duration-200 ${mobileOpen ? 'rotate-90' : ''}`}>
                ❯
              </span>
              <span className="font-bold tracking-tight text-[var(--foreground)]">GITFIND.AI</span>
            </button>
          </div>

          {/* Desktop nav links */}
          <div className="hidden sm:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 py-1 transition-colors ${
                    active
                      ? 'text-[var(--accent)] font-bold'
                      : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {active && <span className="mr-1">❯</span>}
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right side: status indicators + submit */}
        <div className="flex items-center gap-4 text-[10px] tracking-widest">
          <div className="hidden md:flex items-center gap-2 text-[var(--accent)]">
            <span className="sys-status-dot" style={{ width: 5, height: 5 }} />
            <span>SYS_OK</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[var(--score-high)]">
            <span className="sys-status-dot" style={{ width: 5, height: 5, background: 'var(--score-high)', animation: 'none' }} />
            <span>LIVE</span>
          </div>
          <ThemeToggle />
          <span className="hidden sm:inline tabular-nums text-[var(--foreground-muted)]">{time}</span>
          <span className="hidden sm:inline h-4" style={{ width: 1, background: 'var(--border)' }} />
          <Link
            href="/submit"
            className="hidden sm:block text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
          >
            [SUBMIT]
          </Link>
        </div>
      </nav>

      {/* Mobile dropdown */}
      <div
        className={`sm:hidden absolute left-0 right-0 z-40 transition-all duration-200 overflow-hidden ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
        style={{ background: 'var(--background)', borderBottom: mobileOpen ? '1px solid var(--border)' : 'none' }}
      >
        <div className="px-4 py-3 flex flex-col gap-1 text-[11px] uppercase tracking-wider">
          {MOBILE_CATEGORIES.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2.5 transition-colors ${
                isActive(link.href)
                  ? 'text-[var(--accent)] font-bold'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {isActive(link.href) && <span className="mr-1">❯</span>}
              {link.label}
            </Link>
          ))}
          <span className="my-1 h-px" style={{ background: 'var(--border)' }} />
          {MOBILE_FEATURES.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2.5 transition-colors ${
                isActive(link.href)
                  ? 'text-[var(--accent)] font-bold'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {isActive(link.href) && <span className="mr-1">❯</span>}
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}
