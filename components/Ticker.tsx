import Image from 'next/image'
import Link from 'next/link'
import { getTickerRepos } from '@/lib/queries'
import { formatCount } from '@/lib/design'

export default async function Ticker() {
  const repos = await getTickerRepos(15)
  if (repos.length === 0) return null

  // Duplicate items for a seamless loop
  const items = [...repos, ...repos]

  return (
    <div className="overflow-hidden border-b-2 border-[var(--line)] bg-[var(--ink)]" aria-hidden="true">
      <div
        className="marquee flex w-max items-center gap-10 whitespace-nowrap py-2 pl-4 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--paper)]"
        style={{ ['--marquee-duration' as string]: `${repos.length * 5}s` }}
      >
        {items.map((repo, i) => (
          <Link
            key={`${repo.owner}/${repo.name}-${i}`}
            href={`/project/${repo.owner}/${repo.name}`}
            className="inline-flex items-center gap-2 hover:text-[var(--accent)]"
            tabIndex={-1}
          >
            <Image
              src={`https://github.com/${repo.owner}.png?size=40`}
              alt=""
              width={14}
              height={14}
              className="rounded-full grayscale"
              style={{ imageRendering: 'pixelated' }}
              unoptimized
            />
            <span>{repo.owner}/{repo.name}</span>
            <span className="text-[var(--accent)]">
              {repo.pct_increase > 0 ? '▲' : '▼'} +{formatCount(repo.stars_7d)}★ this week
            </span>
            {repo.pct_increase >= 200 && (
              <span className="hidden border border-[var(--accent)] px-1 text-[var(--accent)] md:inline">
                hot
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
