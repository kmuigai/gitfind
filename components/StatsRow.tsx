'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface StatsRowProps {
  children: React.ReactNode
}

export default function StatsRow({ children }: StatsRowProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [active, setActive] = useState(false)
  const [overflow, setOverflow] = useState(0)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const check = () => {
      const diff = el.scrollWidth - el.clientWidth
      setOverflows(diff > 0)
      setOverflow(diff)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const activate = useCallback(() => setActive(true), [])
  const deactivate = useCallback(() => setActive(false), [])

  return (
    <div
      className="relative z-10 mt-auto pt-1"
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onTouchStart={activate}
      onTouchEnd={deactivate}
    >
      <div
        ref={innerRef}
        className="flex items-center gap-3 overflow-hidden"
        style={overflows && !active ? {
          maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
        } : undefined}
      >
        <div
          className={`flex items-center gap-3 ${active ? 'transition-transform duration-[2000ms] ease-linear' : 'transition-transform duration-300 ease-out'}`}
          style={{ transform: active && overflows ? `translateX(-${overflow}px)` : 'translateX(0)' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
