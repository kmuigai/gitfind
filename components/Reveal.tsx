'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Scroll-triggered reveal — adds .is-visible once when the element enters
 * the viewport. Also adds .chart-anim so paused bar-grow animations inside
 * start at that moment. No-JS / reduced-motion: CSS shows final state.
 */
export default function Reveal({
  children,
  className = '',
  chart = false,
}: {
  children: ReactNode
  className?: string
  chart?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px 40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal ${chart ? 'chart-anim' : ''} ${className}`}>
      {children}
    </div>
  )
}
