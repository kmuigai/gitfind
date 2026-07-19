// Shared 1-bit SVG patterns — print-style series encoding (no color).

export type PatternName = 'solid' | 'checker' | 'hatch' | 'dots' | 'cross'

export const PATTERN_ORDER: PatternName[] = ['solid', 'checker', 'hatch', 'dots', 'cross']

/** Pattern for a series at rank i (0 = leader). Cycles after the order runs out. */
export function patternForRank(i: number): PatternName {
  return PATTERN_ORDER[i % PATTERN_ORDER.length]
}

export function ChartPatterns({ prefix }: { prefix: string }) {
  return (
    <defs>
      <pattern id={`${prefix}-solid`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="var(--ink)" />
      </pattern>
      <pattern id={`${prefix}-checker`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="var(--paper)" />
        <rect width="2" height="2" fill="var(--ink)" />
        <rect x="2" y="2" width="2" height="2" fill="var(--ink)" />
      </pattern>
      <pattern id={`${prefix}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--paper)" />
        <path d="M-1,7 L7,-1" stroke="var(--ink)" strokeWidth="1.4" />
      </pattern>
      <pattern id={`${prefix}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--paper)" />
        <circle cx="3" cy="3" r="1.1" fill="var(--ink)" />
      </pattern>
      <pattern id={`${prefix}-cross`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--paper)" />
        <path d="M-1,7 L7,-1 M-1,-1 L7,7" stroke="var(--ink)" strokeWidth="1" />
      </pattern>
    </defs>
  )
}

export function patternUrl(prefix: string, name: PatternName): string {
  return `url(#${prefix}-${name})`
}
