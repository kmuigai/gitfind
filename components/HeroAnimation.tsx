'use client'

import { useEffect, useState } from 'react'

const WORDS = ['Git Signal', 'Git Context', 'Git Clarity', 'Git Smarter'] as const

// Slot machine deceleration schedule: [word index, delay before next step (ms)]
// -1 delay = stop here (final state)
const ANIMATION_SCHEDULE: [number, number][] = [
  [0, 80],  [1, 80],  [2, 80],  [3, 80],
  [0, 100], [1, 100], [2, 100], [3, 120],
  [0, 150], [1, 180], [2, 220], [3, 280],
  [0, 350], [1, 440], [2, 560], [3, -1],
]

export default function HeroAnimation() {
  const [scheduleIndex, setScheduleIndex] = useState(0)

  // Derive word and completion from schedule index — no extra state needed
  const entry = ANIMATION_SCHEDULE[scheduleIndex] ?? [3, -1]
  const wordIndex = entry[0]
  const delay = entry[1]
  const isComplete = delay === -1
  const currentWord = WORDS[wordIndex] ?? 'Git Smarter'
  const isFinal = isComplete && wordIndex === 3

  useEffect(() => {
    if (isComplete) return

    const timer = setTimeout(() => {
      setScheduleIndex((i) => i + 1)
    }, delay)

    return () => clearTimeout(timer)
  }, [scheduleIndex, isComplete, delay])

  return (
    <div className="relative inline-block">
      <span
        className={`
          font-mono text-5xl font-bold tracking-tight transition-colors duration-300 sm:text-6xl lg:text-7xl
          ${isFinal ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}
        `}
        aria-label="Git Smarter"
        aria-live="polite"
      >
        {currentWord}
      </span>
      {/* Blinking cursor during animation */}
      {!isComplete && (
        <span
          className="ml-1 inline-block h-[1em] w-[3px] animate-pulse bg-[var(--accent)] align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
