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

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md p-1.5 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
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
  )
}
