'use client'

import { useState, useEffect, type ReactNode } from 'react'

const TABS = [
  { key: 'trending', label: 'trending' },
  { key: 'top', label: 'top score' },
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
            {view === 'trending' ? '§ 1 — this week’s movers' : '§ 1 — top ranked'}
          </h2>
          <p className="mt-2 max-w-xl font-mono text-[12px] leading-relaxed text-[var(--muted)]">
            {view === 'trending'
              ? 'the projects gaining the most traction right now, ranked by early signal score.'
              : 'scored by velocity, community growth, and cross-platform buzz.'}
          </p>
        </div>
        <div className="flex font-mono text-[12px]" role="tablist" aria-label="Project ranking view">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => switchView(tab.key)}
              className={`border-2 border-[var(--line)] px-3.5 py-1.5 font-bold first:border-r-0 ${
                view === tab.key
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'bg-[var(--paper)] text-[var(--muted)] invert-hover'
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
