'use client'

// The Universe Hero — the homepage's vortex, in the house print style.
// Every blob is a repo that won one of the last sixteen weeks, spiraling out
// from the biggest at dead center (phyllotaxis). Category is texture, not
// position — each category gets a 1-bit ink fill pattern over halftone paper
// grain. The cursor has gravity; clicking a blob pins its scouting card.
// The analytical version (the race, the dial) lives at /insights/race.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { type BubbleFrame, type BubbleProfile } from '@/lib/bubble'
import { vortexLayout, hashKey, type UniversePlanet } from '@/lib/universe'
import ScoutingCard from '@/components/ScoutingCard'
import Reveal from '@/components/Reveal'

// Category textures — the 1-bit print vocabulary, in ink on paper.
const TEXTURES = ['solid', 'checker', 'hatch', 'dots', 'cross', 'backhatch', 'grid'] as const

function PaperPatterns() {
  return (
    <defs>
      <pattern id="pv-solid" width="1" height="1" patternUnits="userSpaceOnUse">
        <rect width="1" height="1" fill="var(--ink)" />
      </pattern>
      <pattern id="pv-checker" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
        <rect width="0.6" height="0.6" fill="var(--ink)" />
        <rect x="0.6" y="0.6" width="0.6" height="0.6" fill="var(--ink)" />
      </pattern>
      <pattern id="pv-hatch" width="1.4" height="1.4" patternUnits="userSpaceOnUse">
        <path d="M-0.2,1.6 L1.6,-0.2" stroke="var(--ink)" strokeWidth="0.16" />
      </pattern>
      <pattern id="pv-dots" width="1.3" height="1.3" patternUnits="userSpaceOnUse">
        <circle cx="0.65" cy="0.65" r="0.14" fill="var(--ink)" />
      </pattern>
      <pattern id="pv-cross" width="1.4" height="1.4" patternUnits="userSpaceOnUse">
        <path d="M-0.2,1.6 L1.6,-0.2 M-0.2,-0.2 L1.6,1.6" stroke="var(--ink)" strokeWidth="0.12" />
      </pattern>
      <pattern id="pv-backhatch" width="1.4" height="1.4" patternUnits="userSpaceOnUse">
        <path d="M-0.2,-0.2 L1.6,1.6" stroke="var(--ink)" strokeWidth="0.16" />
      </pattern>
      <pattern id="pv-grid" width="1.4" height="1.4" patternUnits="userSpaceOnUse">
        <path d="M0,0.7 L1.4,0.7 M0.7,0 L0.7,1.4" stroke="var(--ink)" strokeWidth="0.12" />
      </pattern>
    </defs>
  )
}

const motionQuery = '(prefers-reduced-motion: no-preference)'

function useMotionOk(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(motionQuery)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(motionQuery).matches,
    () => false,
  )
}

interface UniverseHeroProps {
  frames: BubbleFrame[]
  profiles: Record<string, BubbleProfile>
}

export default function UniverseHero({ frames, profiles }: UniverseHeroProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const motionOk = useMotionOk()

  // Escape closes the card
  useEffect(() => {
    if (!selectedKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKey(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedKey])

  const frame = frames[frames.length - 1] // the latest week — what we land in

  // The planets: every repo that made any weekly top 10, at its latest stats
  const planets = useMemo(() => {
    const byKey = new Map<string, UniversePlanet & { label: string; forks: number; stars7d: number }>()
    for (const f of frames) {
      for (const e of f.entries) {
        byKey.set(e.key, {
          key: e.key,
          label: e.label,
          stars: e.stars,
          forks: e.forks,
          stars7d: e.stars7d,
          category: profiles[e.key]?.category ?? 'other',
        })
      }
    }
    return [...byKey.values()]
  }, [frames, profiles])

  const maxStars = useMemo(() => Math.max(1, ...planets.map((p) => p.stars)), [planets])
  const layout = useMemo(() => vortexLayout(planets), [planets])

  // Category → texture, stable by sorted category name
  const textureFor = useMemo(() => {
    const categories = [...new Set(planets.map((p) => p.category))].sort()
    return new Map(categories.map((c, i) => [c, TEXTURES[i % TEXTURES.length]]))
  }, [planets])

  // Spiral order (big → small) is stable per data load; it drives both the
  // pop-in stagger and the base paint order.
  const spiralOrder = useMemo(() => planets.slice().sort((a, b) => b.stars - a.stars), [planets])
  const spiralIndex = useMemo(() => new Map(spiralOrder.map((p, i) => [p.key, i])), [spiralOrder])

  if (frames.length === 0) return null

  const leaderKey = frame?.entries[0]?.key
  const selectedProfile = selectedKey ? profiles[selectedKey] : null
  const selectedWeekEntry = selectedKey ? frame?.entries.find((e) => e.key === selectedKey) : undefined
  const selectedRank = selectedWeekEntry && frame ? frame.entries.indexOf(selectedWeekEntry) + 1 : null
  const legendCategories = [...textureFor.entries()]
  const focusKey = selectedKey ?? hoverKey
  // Category spotlight: hovering (or selecting) a blob dims every OTHER
  // category — the hover tells you something true about the data.
  const spotCat = focusKey ? planets.find((p) => p.key === focusKey)?.category : null

  // SVG has no z-index, but do NOT raise the focused blob by reordering the
  // DOM — insertBefore restarts running CSS animations (the pop replays on
  // every hover). Paint order stays frozen; emphasis comes from a ring drawn
  // on top as a separate element.
  const renderOrder = spiralOrder

  function renderBlob(planet: (typeof planets)[number]) {
    const pos = layout.get(planet.key)
    if (!pos) return null
    const r = 0.9 + 2.6 * Math.sqrt(planet.stars / maxStars) // 100-space radius — hero-scale blobs
    const isHovered = planet.key === hoverKey
    const isSelected = planet.key === selectedKey
    const isLeader = planet.key === leaderKey
    const emphasized = isHovered || isSelected || isLeader
    const dimmed = spotCat != null && planet.category !== spotCat

    // Seeded ambient drift — the Obsidian wobble without a physics engine.
    // Deterministic per repo key, tiny amplitude, slow, mid-cycle start.
    const h = hashKey(planet.key)
    const driftVars = {
      '--dx': `${1.5 + ((h % 100) / 100) * 1.5}px`,
      '--dy': `${1.5 + (((h >>> 8) % 100) / 100) * 1.5}px`,
      '--dur': `${4.5 + (((h >>> 16) % 100) / 100) * 2.5}s`,
      '--drift-delay': `${-(((h >>> 24) % 100) / 100) * (4.5 + (((h >>> 16) % 100) / 100) * 2.5)}s`,
    } as React.CSSProperties

    return (
      <g key={planet.key} className="vortex-drift" style={driftVars}>
        <circle
          cx={pos.x}
          cy={pos.y}
          r={r}
        role="button"
        tabIndex={0}
        aria-label={`${planet.label}: open scouting card`}
        aria-pressed={isSelected}
        fill={emphasized ? 'var(--accent)' : `url(#pv-${textureFor.get(planet.category) ?? 'solid'})`}
        stroke={isSelected ? 'var(--accent)' : 'var(--ink)'}
        strokeWidth={isSelected ? 3 : 2}
        vectorEffect="non-scaling-stroke"
        strokeDasharray={(isSelected && !isLeader) || isHovered ? '4 3' : undefined}
        className="cursor-pointer outline-none vortex-pop"
        style={{
          transform: isHovered && !isSelected ? 'scale(1.4)' : 'none',
          transformBox: 'fill-box',
          transformOrigin: 'center',
          opacity: dimmed ? 0.25 : 1,
          transition: motionOk ? 'transform 200ms linear, opacity 200ms linear' : 'none',
          animationDelay: `${(spiralIndex.get(planet.key) ?? 0) * 25}ms`,
        }}
        onClick={(e) => {
          e.stopPropagation()
          setSelectedKey((cur) => (cur === planet.key ? null : planet.key))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setSelectedKey((cur) => (cur === planet.key ? null : planet.key))
          }
        }}
        onPointerEnter={() => setHoverKey(planet.key)}
        onPointerLeave={() => setHoverKey(null)}
        />
      </g>
    )
  }

  return (
    <section aria-label="The vortex — an interactive map of rising GitHub projects">
      {/* the vortex — full-bleed hero, no frame, no caption: the artifact speaks.
          On first view it assembles itself — biggest blob first, spiral outward. */}
      <Reveal chart>
        <div
          className="halftone relative h-[80vh] min-h-[520px] overflow-hidden border-y-2 border-[var(--line)]"
          onClick={() => setSelectedKey(null)}
        >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <PaperPatterns />
          {renderOrder.map((p) => renderBlob(p))}
          {/* focus ring — the top layer of emphasis, without touching paint order */}
          {focusKey &&
            (() => {
              const p = planets.find((pl) => pl.key === focusKey)
              const pos = p ? layout.get(p.key) : undefined
              if (!p || !pos) return null
              const r = 0.9 + 2.6 * Math.sqrt(p.stars / maxStars) + 0.5
              return (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill="none"
                  stroke={selectedKey ? 'var(--accent)' : 'var(--ink)'}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              )
            })()}
        </svg>

        {/* labels */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {planets.map((p) => {
            if (p.key !== hoverKey && p.key !== selectedKey && p.key !== leaderKey) return null
            const pos = layout.get(p.key)
            if (!pos) return null
            const r = 0.9 + 2.6 * Math.sqrt(p.stars / maxStars)
            return (
              <text
                key={p.key}
                x={pos.x + r + 0.6}
                y={pos.y + 0.5}
                fontSize={1.8}
                fontWeight="bold"
                fill="var(--ink)"
                fontFamily="var(--font-geist-mono), ui-monospace, monospace"
              >
                {p.label.split('/')[1]}
              </text>
            )
          })}
        </svg>

        {/* texture legend */}
        <div className="absolute right-4 top-4 z-30 flex flex-wrap items-center justify-end gap-2.5 font-mono text-[10px] text-[var(--muted)]">
          {legendCategories.map(([cat, tex]) => (
            <span key={cat} className="flex items-center gap-1.5">
              <svg width="13" height="13" aria-hidden="true">
                <rect width="13" height="13" fill={`url(#pv-${tex})`} stroke="var(--ink)" strokeWidth="1" />
              </svg>
              {cat.toLowerCase()}
            </span>
          ))}
        </div>

        {/* the sports card */}
        {selectedKey && selectedProfile && (
          <div className="absolute right-4 top-16 z-40 max-h-[calc(100%-96px)] w-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <ScoutingCard
              repoKey={selectedKey}
              profile={selectedProfile}
              weekEntry={selectedWeekEntry}
              rank={selectedRank}
              frames={frames}
              currentIdx={frames.length - 1}
              onClose={() => setSelectedKey(null)}
            />
          </div>
        )}
        </div>
      </Reveal>

      <p className="mx-auto mt-3 max-w-5xl px-4 font-mono text-[10.5px] text-[var(--muted)] sm:px-6">
        source: gitfind daily snapshots · every repo that won one of the last {frames.length} weeks · center = biggest · texture = category · hover a blob for its name, click for its card
      </p>
    </section>
  )
}
