'use client'

import { useState, useEffect, type ReactNode } from 'react'

const TABS = [
  { key: 'trending', label: 'Trending' },
  { key: 'top', label: 'Top Score' },
] as const

export type ViewTab = (typeof TABS)[number]['key']

interface ViewToggleProps {
  trendingPanel: ReactNode
  topPanel: ReactNode
}

export default function ViewToggle({ trendingPanel, topPanel }: ViewToggleProps) {
  const [view, setView] = useState<ViewTab>('trending')

  useEffect(() => {
    const sync = () => {
      const v = new URLSearchParams(window.location.search).get('view')
      setView(v === 'top' ? 'top' : 'trending')
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const switchView = (next: ViewTab) => {
    setView(next)
    const url = new URL(window.location.href)
    if (next === 'trending') url.searchParams.delete('view')
    else url.searchParams.set('view', next)
    window.history.pushState(null, '', url.toString())
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="term-label">
            {view === 'trending' ? '// THIS_WEEKS_MOVERS' : '// TOP_RANKED'}
          </h2>
          <p className="mt-1 font-mono text-sm text-[var(--foreground-muted)]">
            {view === 'trending'
              ? 'The projects gaining the most traction right now'
              : 'Scored by velocity, community growth, and cross-platform buzz'}
          </p>
        </div>
        <div className="flex gap-1 font-mono">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchView(tab.key)}
              className={`rounded-sm border px-3 py-1 text-xs transition-colors ${
                view === tab.key
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'border-[var(--border)] text-[var(--foreground-subtle)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div hidden={view !== 'trending'}>{trendingPanel}</div>
      <div hidden={view !== 'top'}>{topPanel}</div>
    </>
  )
}
