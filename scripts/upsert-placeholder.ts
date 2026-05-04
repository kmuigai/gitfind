// Shared helper for the `_bigquery_aggregate` placeholder repo upsert used by
// the chart-data scripts. Wrapping the upsert in a small retry handles the
// transient Supabase statement timeouts (Postgres `57014`) we've seen in the
// chart-data workflow at ~07:31 UTC.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types.js'

const PLACEHOLDER_REPO = {
  github_id: 0,
  name: '_bigquery_aggregate',
  owner: '_gitfind',
  description: 'Aggregate AI coding tool commit data (all public GitHub repos)',
  stars: 0,
  forks: 0,
  contributors: 0,
  url: 'https://github.com',
} as const

interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  label?: string
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3
  const baseDelayMs = opts.baseDelayMs ?? 2000
  const label = opts.label ?? 'operation'

  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i === attempts) break
      const delay = baseDelayMs * Math.pow(2, i - 1)
      console.warn(
        `[retry] ${label} failed (attempt ${i}/${attempts}); waiting ${delay}ms before retry`,
        err
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

/**
 * Upsert the `_bigquery_aggregate` placeholder repo and return its UUID.
 * Retries on transient errors (e.g. Postgres statement timeouts).
 */
export async function upsertPlaceholderRepo(
  db: SupabaseClient<Database>
): Promise<string> {
  return withRetry(
    async () => {
      const { data, error } = await db
        .from('repos')
        .upsert(
          { ...PLACEHOLDER_REPO, updated_at: new Date().toISOString() },
          { onConflict: 'github_id' }
        )
        .select('id')
        .single()

      if (error) throw error
      if (!data) throw new Error('Placeholder upsert returned no row')
      return data.id
    },
    { label: 'upsert placeholder repo', attempts: 3, baseDelayMs: 2000 }
  )
}
