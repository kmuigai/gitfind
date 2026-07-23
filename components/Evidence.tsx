// Evidence popover — the Wikipedia reference-card pattern in 1-bit.
// CSS-only: opens on hover and on focus/tap (focus-within covers touch).
// No JS, no client component, reduced-motion safe by design.

export default function Evidence({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        aria-label={`Evidence: ${label}`}
        className="cursor-help border-b border-dashed border-[var(--ink)]/60 text-inherit focus:outline-none"
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 translate-y-1 border-2 border-[var(--line)] bg-[var(--paper)] p-3 text-left font-mono text-[11px] leading-relaxed text-[var(--body)] opacity-0 shadow-[4px_4px_0_0_var(--ink)] transition-[transform,opacity] duration-150 ease-linear group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
          evidence
        </span>
        {label}
        {/* caret */}
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-[var(--line)] bg-[var(--paper)]" />
      </span>
    </span>
  )
}
