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
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

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
        setActiveIndex(-1)
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

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && results[activeIndex]) {
          const repo = results[activeIndex]
          window.location.href = `/project/${repo.owner}/${repo.name}`
          setIsOpen(false)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  const activeId = activeIndex >= 0 ? `search-result-${activeIndex}` : undefined

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Input */}
      <div className="flex items-center gap-2 border-2 border-[var(--line)] bg-[var(--paper)] px-3 focus-within:bg-white">
        <span className="pointer-events-none font-mono text-sm font-bold text-[var(--ink)]">❯</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="search repos, tools, categories…"
          className="h-11 w-full bg-transparent font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          role="combobox"
          aria-label="Search repositories"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? 'search-results' : undefined}
          aria-activedescendant={activeId}
        />
        {isLoading && (
          <span className="pointer-events-none">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 border-2 border-[var(--line)] bg-[var(--paper)] shadow-[5px_5px_0_0_var(--ink)]">
          <div className="border-b-2 border-[var(--line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          <ul ref={listRef} id="search-results" role="listbox" className="max-h-80 overflow-y-auto">
            {results.map((repo, i) => (
              <li
                key={repo.id}
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <Link
                  href={`/project/${repo.owner}/${repo.name}`}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-start gap-3 border-b border-[var(--line-soft)] px-3 py-2.5 font-mono last:border-0 ${
                    i === activeIndex ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-[var(--ink)] hover:text-[var(--paper)]'
                  }`}
                  tabIndex={-1}
                >
                  <span className="shrink-0 text-[10px] text-[var(--muted)]">[{String(i).padStart(2, '0')}]</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-bold">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.enrichment && (
                        <span className="shrink-0 text-[11px] font-bold">
                          {repo.enrichment.early_signal_score}
                          <span className="font-normal opacity-60">/100</span>
                        </span>
                      )}
                    </div>
                    {repo.enrichment?.summary && (
                      <p className="mt-0.5 truncate text-[11px] opacity-70">
                        {repo.enrichment.summary}
                      </p>
                    )}
                  </div>
                  {repo.language && (
                    <span className="shrink-0 text-[10px] opacity-60">
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
