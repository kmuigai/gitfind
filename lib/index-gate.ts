// E1 "Concentrate the index" — the single source of truth for which project
// pages Google is invited to index.
//
// Background: the sitemap used to submit every repo in the database
// (~40K templated /project/ pages). Google indexed exactly 2 pages and
// marked 1,060 more "Crawled - currently not indexed". E1 concentrates the
// index on the strongest pages instead:
//
//   - app/sitemap.ts lists only the projects selected here, and
//   - app/project/[owner]/[repo] emits robots noindex for every project
//     NOT selected here.
//
// Both call sites go through the functions in this file (selection +
// membership share one ordering and one spam gate), so the sitemap and the
// per-page metadata can never disagree about the set. Pages that fall out
// of the set stay live for direct visits — they just leave Google's queue.
//
// This module is pure (no I/O) so it is unit-testable; the database fetch
// that feeds it lives in lib/queries.ts (getIndexableProjects).

/** How many project pages stay indexable. Everything else is noindexed. */
export const INDEXABLE_PROJECT_LIMIT = 500

/** Minimal repo shape the gate needs. `score` is enrichments.early_signal_score. */
export interface IndexCandidate {
  owner: string
  name: string
  description: string | null
  score: number | null
  updated_at: string
  scored_at: string | null
}

// --- Spam gate -------------------------------------------------------------
// Piracy/crack-pattern repos never enter the index, regardless of score.
// The list is deliberately conservative: each pattern is a strong piracy
// signal on its own. Token boundaries on bare "crack" spare legitimate
// projects whose names merely contain the substring (firecracker,
// Crackle) or use crack in a security-research sense (password-cracker).
// Pages caught here stay live; they are only excluded from indexation.
export const SPAM_PATTERNS: readonly RegExp[] = [
  /cracked/i, // "…TutorialCracked-2026", "software cracked"
  /(^|[-_/ ])crack($|[-_/ .])/i, // token "crack": "wifi-crack", "crack-2026"
  /keygen/i,
  /warez/i,
  /nulled/i, // nulled themes/plugins piracy
  /premium[-_/ ]?free/i, // "premium-free", "premium free download"
  /free[-_/ ]?premium/i, // "free premium"
]

/** True when a repo's name or description matches the piracy/crack gate. */
export function isSpamRepo(repo: {
  owner: string
  name: string
  description?: string | null
}): boolean {
  // Tested separately so token-boundary patterns anchor at real string ends.
  const haystacks = [`${repo.owner}/${repo.name}`, repo.description ?? '']
  return haystacks.some((haystack) => SPAM_PATTERNS.some((pattern) => pattern.test(haystack)))
}

// --- Canonical ordering ------------------------------------------------------

/** Case-insensitive identity of a project page, used for set membership. */
export function projectKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase()
}

/**
 * The one ordering both call sites share: Early Signal Score descending,
 * then most recently updated first, then project key ascending so the
 * order is fully deterministic (stable cut at the limit).
 */
export function compareIndexCandidates(a: IndexCandidate, b: IndexCandidate): number {
  const scoreDiff = (b.score ?? -1) - (a.score ?? -1)
  if (scoreDiff !== 0) return scoreDiff
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1
  const keyA = projectKey(a.owner, a.name)
  const keyB = projectKey(b.owner, b.name)
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
}

/**
 * Select the indexable set: drop spam-gated repos, rank the rest with the
 * canonical ordering, keep the top `limit`. Input order is irrelevant and
 * the input array is not mutated.
 */
export function selectIndexableProjects<T extends IndexCandidate>(
  candidates: readonly T[],
  limit: number = INDEXABLE_PROJECT_LIMIT
): T[] {
  return candidates
    .filter((candidate) => !isSpamRepo(candidate))
    .sort(compareIndexCandidates)
    .slice(0, limit)
}

/** Membership set for selectIndexableProjects output, keyed by projectKey. */
export function indexableProjectKeys(
  projects: readonly IndexCandidate[]
): Set<string> {
  return new Set(projects.map((p) => projectKey(p.owner, p.name)))
}
