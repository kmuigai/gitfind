'use client'

import { useState } from 'react'
import Link from 'next/link'

interface MobileMenuProps {
  categories: { name: string; slug: string }[]
  features: { name: string; href: string }[]
}

export default function MobileMenu({ categories, features }: MobileMenuProps) {
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
  }

  const logoClasses =
    'flex items-center gap-2 font-mono text-sm font-semibold tracking-[-0.06em] text-[var(--foreground)] transition-opacity hover:opacity-80'

  return (
    <>
      {/* Desktop: logo is a normal link */}
      <Link href="/" className={`hidden sm:flex ${logoClasses}`}>
        <span className="text-[var(--accent)]">❯</span>
        <span>gitfind</span>
        <span className="text-[var(--foreground-muted)]">.ai</span>
      </Link>

      {/* Mobile: logo toggles menu */}
      <div className="sm:hidden">
        <button
          onClick={() => setOpen(!open)}
          className={logoClasses}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <span
            className={`text-[var(--accent)] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          >
            ❯
          </span>
          <span>gitfind</span>
          <span className="text-[var(--foreground-muted)]">.ai</span>
        </button>

        <div
          className={`absolute left-0 right-0 top-[3.5rem] z-40 border-b border-[var(--border)] bg-[var(--background)] transition-all duration-200 ${
            open
              ? 'max-h-96 opacity-100'
              : 'pointer-events-none max-h-0 opacity-0'
          } overflow-hidden`}
        >
          <div className="mx-auto max-w-7xl px-4 py-3">
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  onClick={close}
                  className="rounded-md px-3 py-2 font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
                >
                  {cat.name}
                </Link>
              ))}

              <span className="my-1 h-px bg-[var(--border)]" />

              {features.map((feat) => (
                <Link
                  key={feat.href}
                  href={feat.href}
                  onClick={close}
                  className="rounded-md px-3 py-2 font-mono text-xs text-[var(--accent)] transition-colors hover:bg-[var(--background-elevated)] hover:text-[var(--accent-hover)]"
                >
                  {feat.name}
                </Link>
              ))}

              <Link
                href="/submit"
                onClick={close}
                className="rounded-md px-3 py-2 font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
              >
                Submit a project
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
