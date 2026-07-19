'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCount } from '@/lib/design'

/**
 * Count-up on first scroll into view (400ms, linear — mechanical, on-brand).
 * Server-renders the final value, so no-JS and reduced-motion users always
 * see the correct number immediately.
 */
export default function CountUp({
  value,
  format = formatCount,
  duration = 400,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const [display, setDisplay] = useState(value)
  const ref = useRef<HTMLSpanElement>(null)
  const played = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || played.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || played.current) return
        played.current = true
        io.disconnect()

        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1)
          setDisplay(Math.round(value * t))
          if (t < 1) requestAnimationFrame(tick)
        }
        setDisplay(0)
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {format(display)}
    </span>
  )
}
