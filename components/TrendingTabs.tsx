'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const MONO = 'var(--font-geist-mono), ui-monospace, monospace'

const TABS = [
  { key: 'trending', label: 'Trending' },
  { key: 'top', label: 'Top Score' },
] as const

export type ViewTab = (typeof TABS)[number]['key']

export default function TrendingTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = (searchParams.get('view') as ViewTab) || 'trending'

  return (
    <div className="flex gap-1" style={{ fontFamily: MONO }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            if (tab.key === 'trending') {
              params.delete('view')
            } else {
              params.set('view', tab.key)
            }
            const qs = params.toString()
            router.push(qs ? `/?${qs}` : '/', { scroll: false })
          }}
          className="px-3 py-1 text-xs transition-colors"
          style={{
            fontFamily: MONO,
            borderRadius: '2px',
            border: active === tab.key ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: active === tab.key ? 'var(--accent)' : 'transparent',
            color: active === tab.key ? '#fff' : 'var(--foreground-subtle)',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
