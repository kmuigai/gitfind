'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { RepoWithEnrichment } from '@/lib/database.types'

type SearchResult = RepoWithEnrichment

function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = (await res.json()) as SearchResult[]
        setResults(data)
        setIsOpen(data.length > 0)
      }
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void search(debouncedQuery)
  }, [debouncedQuery, search])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Input */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="What's trending in AI, Rust, DevOps..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] py-2.5 pl-9 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
          aria-label="Search repositories"
          aria-autocomplete="list"
        />
        {isLoading && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-xl">
          <ul role="listbox" className="max-h-80 overflow-y-auto">
            {results.map((repo) => (
              <li key={repo.id} role="option" aria-selected={false}>
                <Link
                  href={`/project/${repo.owner}/${repo.name}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--background-elevated)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.enrichment && (
                        <span className="shrink-0 font-mono text-xs text-[var(--accent)]">
                          {repo.enrichment.early_signal_score}
                        </span>
                      )}
                    </div>
                    {repo.enrichment?.summary && (
                      <p className="mt-0.5 truncate text-xs text-[var(--foreground-muted)]">
                        {repo.enrichment.summary}
                      </p>
                    )}
                  </div>
                  {repo.language && (
                    <span className="shrink-0 text-xs text-[var(--foreground-subtle)]">
                      {repo.language}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--border)] px-4 py-2">
            <p className="text-xs text-[var(--foreground-subtle)]">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
