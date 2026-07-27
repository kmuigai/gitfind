import type { Metadata } from 'next'
import Link from 'next/link'
import { searchRepos } from '@/lib/queries'
import RepoCard from '@/components/RepoCard'
import SearchBar from '@/components/SearchBar'

export const metadata: Metadata = {
  title: 'Search — GitFind',
  robots: { index: false, follow: true },
}

export const revalidate = 3600

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const results = query.length >= 2 ? await searchRepos(query, 24) : []

  return (
    <div>
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <h1 className="font-display mt-2 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            SEARCH
          </h1>
          <div className="mt-6">
            <SearchBar />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {query.length < 2 ? (
          <p className="font-mono text-[13px] text-[var(--muted)]">
            type at least 2 characters to search the catalog — repo names, owners, topics, languages.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
              <p className="font-bold tracking-[0.2em] text-[var(--ink)]">
                § 1 — results for “{query}”
              </p>
              <p>{results.length} {results.length === 1 ? 'entry' : 'entries'}</p>
            </div>
            {results.length === 0 ? (
              <div className="mt-6 border-2 border-dashed border-[var(--line-soft)] py-16 text-center">
                <p className="font-mono text-sm text-[var(--muted)]">
                  nothing in the catalog matches “{query}” — yet. the pipeline discovers new repos nightly.
                </p>
                <p className="mt-3 font-mono text-xs text-[var(--muted)]">
                  know it?{' '}
                  <Link href="/submit" className="invert-hover px-1 font-bold text-[var(--ink)]">
                    submit it →
                  </Link>
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((project, i) => (
                  <RepoCard key={project.id} project={project} index={i} digest />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
