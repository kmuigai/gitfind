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
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--accent)] animate-pulse">
          ❯
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="SEARCH REPOS, TOOLS, CATEGORIES..."
          className="term-input w-full"
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden border border-[var(--border-subtle)] bg-[var(--background-card)]" style={{ boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)' }}>
          <div className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground-subtle)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {'>'} {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          <ul role="listbox" className="max-h-80 overflow-y-auto">
            {results.map((repo, i) => (
              <li key={repo.id} role="option" aria-selected={false}>
                <Link
                  href={`/project/${repo.owner}/${repo.name}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 px-3 py-2 font-mono transition-colors hover:bg-[var(--accent)]/5"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <span className="term-idx shrink-0">[{String(i).padStart(2, '0')}]</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[11px] text-[var(--foreground)]">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.enrichment && (
                        <span className="shrink-0 text-[11px] font-bold text-[var(--accent)]">
                          {repo.enrichment.early_signal_score}
                        </span>
                      )}
                    </div>
                    {repo.enrichment?.summary && (
                      <p className="mt-0.5 truncate text-[10px] text-[var(--foreground-muted)]">
                        {repo.enrichment.summary}
                      </p>
                    )}
                  </div>
                  {repo.language && (
                    <span className="shrink-0 text-[10px] text-[var(--foreground-subtle)]">
                      {repo.language}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
