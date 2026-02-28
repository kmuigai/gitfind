'use client'

import { useRef, useState, useEffect } from 'react'

interface StatsRowProps {
  children: React.ReactNode
  tooltipText: string
}

export default function StatsRow({ children }: StatsRowProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [hovered, setHovered] = useState(false)
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

  return (
    <div
      className="relative z-10 mt-auto pt-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={innerRef}
        className="flex items-center gap-3 overflow-hidden"
        style={overflows && !hovered ? {
          maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
        } : undefined}
      >
        <div
          className={`flex items-center gap-3 ${hovered ? 'transition-transform duration-[2000ms] ease-linear' : 'transition-transform duration-300 ease-out'}`}
          style={{ transform: hovered && overflows ? `translateX(-${overflow}px)` : 'translateX(0)' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
