import Image from 'next/image'
import Link from 'next/link'
import { getTickerRepos } from '@/lib/queries'

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

function getBadge(pct: number, stars_7d: number): { label: string; color: string } | null {
  if (pct >= 200) return { label: 'BREAKOUT', color: 'var(--badge-breakout)' }
  if (pct >= 50) return { label: 'HOT', color: 'var(--badge-hot)' }
  if (stars_7d >= 500) return { label: 'HOT', color: 'var(--badge-hot)' }
  return null
}

export default async function Ticker() {
  const repos = await getTickerRepos(15)
  if (repos.length === 0) return null

  // Duplicate items for seamless loop
  const items = [...repos, ...repos]

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 overflow-hidden"
      style={{
        backgroundColor: 'var(--background)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        className="flex items-center whitespace-nowrap py-1.5"
        style={{
          animation: `ticker ${repos.length * 6}s linear infinite`,
          width: 'max-content',
        }}
      >
        {items.map((repo, i) => {
          const badge = getBadge(repo.pct_increase, repo.stars_7d)
          return (
            <Link
              key={`${repo.owner}/${repo.name}-${i}`}
              href={`/project/${repo.owner}/${repo.name}`}
              className="group inline-flex items-center gap-2 px-4 transition-opacity hover:opacity-80"
              style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
            >
              {/* Owner avatar */}
              <Image
                src={`https://github.com/${repo.owner}.png?size=40`}
                alt=""
                width={20}
                height={20}
                className="rounded-full"
                unoptimized
              />

              {/* Repo name */}
              <span className="text-[11px] text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
                {repo.owner}/{repo.name}
              </span>

              {/* Stars gained */}
              <span className="text-[11px] font-semibold" style={{ color: 'var(--score-high)' }}>
                +{formatNum(repo.stars_7d)}
              </span>

              {/* % increase */}
              <span className="text-[10px] text-[var(--foreground-subtle)]">
                {repo.pct_increase > 999 ? 'NEW' : `+${repo.pct_increase}%`}
              </span>

              {/* Badge */}
              {badge && (
                <span
                  className="rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: badge.color, color: '#fff' }}
                >
                  {badge.label}
                </span>
              )}

              {/* Separator */}
              <span className="ml-2 text-[var(--border)]">|</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
