import Image from 'next/image'
import Link from 'next/link'
import { getTickerRepos } from '@/lib/queries'

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

export default async function Ticker() {
  const repos = await getTickerRepos(15)
  if (repos.length === 0) return null

  // Duplicate items for seamless loop
  const items = [...repos, ...repos]

  return (
    <div
      data-global-ticker
      className="h-7 flex items-center overflow-hidden"
      style={{
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
      }}
    >
      <div
        className="px-3 h-full flex items-center shrink-0 text-[9px] font-bold tracking-widest text-[var(--accent)]"
        style={{ background: 'var(--background-card)', borderRight: '1px solid var(--border)' }}
      >
        GIT_FEED
      </div>
      <div className="flex-1 overflow-hidden h-full relative">
        <div
          className="flex items-center whitespace-nowrap h-full"
          style={{
            animation: `ticker ${repos.length * 5}s linear infinite`,
            width: 'max-content',
            gap: '2.5rem',
            paddingLeft: '1rem',
          }}
        >
          {items.map((repo, i) => (
            <Link
              key={`${repo.owner}/${repo.name}-${i}`}
              href={`/project/${repo.owner}/${repo.name}`}
              className="inline-flex items-center gap-2 text-[10px] hover:opacity-80 transition-opacity"
            >
              <Image
                src={`https://github.com/${repo.owner}.png?size=40`}
                alt=""
                width={14}
                height={14}
                className="rounded-full"
                unoptimized
              />
              <span className="text-[var(--foreground-muted)]">{repo.owner}/{repo.name}</span>
              <span style={{ color: 'var(--score-high)' }}>+{formatNum(repo.stars_7d)} ★</span>
              <span className="hidden md:inline" style={{ color: 'var(--score-high)' }}>
                +{repo.pct_increase > 999 ? 'NEW' : `${repo.pct_increase}%`}
              </span>
              {repo.pct_increase >= 200 && (
                <span className="hidden md:inline font-bold" style={{ color: 'var(--badge-hot)' }}>HOT</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
