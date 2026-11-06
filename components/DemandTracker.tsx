'use client'

// Demand Graph capture points (Board Directive 3, Nov 6, 2026).
//
// Two modes in one component:
// - Page-event mode (no children): renders nothing; fires one event on
//   mount — used for category_view on category pages and the executed
//   search on the search results page.
// - Capture mode (children + captureProjectClicks): wraps results in a
//   display:contents shell (no layout impact) and turns clicks on
//   /project/... links into project_click events, keyed to the search
//   query that produced the results.
//
// All sending goes through lib/track.ts (fire-and-forget, Do Not Track
// respected). Privacy model: docs/demand-graph.md.

import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react'
import { trackDemandEvent } from '@/lib/track'
import type { DemandEventType } from '@/lib/demand'

interface DemandTrackerProps {
  /** Page-level event to fire once on mount. Omit for capture-only. */
  event?: DemandEventType
  /** The executed search string (search page). */
  query?: string
  /** Category slug (category pages). */
  target?: string
  /** Also record clicks on /project/ links inside children as project_click. */
  captureProjectClicks?: boolean
  children?: ReactNode
}

export default function DemandTracker({
  event,
  query,
  target,
  captureProjectClicks = false,
  children,
}: DemandTrackerProps) {
  const firedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!event) return
    const signature = `${event}|${query ?? ''}|${target ?? ''}`
    if (firedFor.current === signature) return
    firedFor.current = signature
    trackDemandEvent(event, { query, target })
  }, [event, query, target])

  function handleClickCapture(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest?.('a')
    const href = anchor?.getAttribute('href')
    if (!href || !href.startsWith('/project/')) return
    const projectKey = href.slice('/project/'.length).split(/[?#]/)[0]
    if (!projectKey) return
    trackDemandEvent('project_click', { target: projectKey, query })
  }

  if (!children) return null

  return (
    <div className="contents" onClickCapture={captureProjectClicks ? handleClickCapture : undefined}>
      {children}
    </div>
  )
}
