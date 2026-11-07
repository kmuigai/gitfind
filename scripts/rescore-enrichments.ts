// Standalone Early Signal Score recompute sweep.
// Recomputes scores for existing enrichments (stalest scored_at first) from
// current snapshots / weekly stats / HN mentions — no Claude calls.
//
// Usage:
//   npx tsx scripts/rescore-enrichments.ts [--limit N] [--dry-run]
//
// The nightly pipeline also runs this continuously (Phase 2d); this script is
// the one-off catch-up / manual entry point.
import { config } from 'dotenv'
config({ path: '.env.local' })

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  const limit =
    limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] ?? '', 10) : undefined
  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    console.error('--limit must be a positive integer')
    process.exit(1)
  }

  const [{ createServiceClient }, { rescoreEnrichments }] = await Promise.all([
    import('../lib/supabase.js'),
    import('../lib/rescore.js'),
  ])

  const db = createServiceClient()

  log('=== Rescore Enrichments ===')
  log(`Mode: ${dryRun ? 'dry-run (no writes)' : 'write'} | Limit: ${limit ?? 'all'}`)

  const result = await rescoreEnrichments(db, { limit, dryRun, log })

  log('=== Rescore Complete ===')
  log(`Processed: ${result.processed}`)
  log(`Updated: ${result.updated}`)
  log(`Big movers (>10 pts, summaries refresh on next enrichment pass): ${result.bigMovers}`)
  for (const label of result.bigMoverLabels) {
    log(`  ${label}`)
  }
  log(`Errors: ${result.errors}`)
}

main().catch((err) => {
  console.error('Rescore failed with unexpected error:', err)
  process.exit(1)
})
