'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('gitfind-theme') as Theme | null
  if (saved === 'dark' || saved === 'light') return saved
  return 'dark'
}

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getInitialTheme()) // eslint-disable-line react-hooks/set-state-in-effect -- hydration: must read localStorage in effect
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('gitfind-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isDark = theme === 'dark'

  // Render a placeholder with same dimensions to avoid layout shift
  if (!mounted) {
    return <div className="h-8 w-16" />
  }

  return (
    <div
      className={[
        'flex w-16 h-8 p-1 rounded-md cursor-pointer transition-all duration-300',
        isDark
          ? 'bg-[var(--background)] border border-[var(--border)]'
          : 'bg-[var(--background)] border border-[var(--border)]',
      ].join(' ')}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle() }}
      role="button"
      tabIndex={0}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="flex justify-between items-center w-full">
        <div
          className={[
            'flex justify-center items-center w-6 h-6 rounded transition-transform duration-300',
            isDark
              ? 'translate-x-0 bg-[var(--background-elevated)]'
              : 'translate-x-8 bg-[var(--background-elevated)]',
          ].join(' ')}
        >
          {isDark ? (
            <Moon className="w-4 h-4 text-[var(--foreground)]" strokeWidth={1.5} />
          ) : (
            <Sun className="w-4 h-4 text-[var(--foreground)]" strokeWidth={1.5} />
          )}
        </div>
        <div
          className={[
            'flex justify-center items-center w-6 h-6 rounded transition-transform duration-300',
            isDark
              ? 'bg-transparent'
              : '-translate-x-8',
          ].join(' ')}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-[var(--foreground-subtle)]" strokeWidth={1.5} />
          ) : (
            <Moon className="w-4 h-4 text-[var(--foreground-subtle)]" strokeWidth={1.5} />
          )}
        </div>
      </div>
    </div>
  )
}
