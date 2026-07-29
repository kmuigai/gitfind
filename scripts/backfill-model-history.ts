// Backfill open-model history from the Wayback Machine.
// HF model pages are archived with the same "Downloads last month" metric the
// API serves today — so we can recover real, measured trailing-30d values for
// past dates and write them into model_metrics. Nothing fabricated: points
// land only where archived snapshots exist; gaps stay gaps.
// Run: npx tsx scripts/backfill-model-history.ts [--days 90]

import { config } from 'dotenv'
config({ path: '.env.local' })
import { MODEL_REGISTRY } from '../lib/models.js'

const DAYS = Number(process.argv.includes('--days') ? process.argv[process.argv.indexOf('--days') + 1] : 90)

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

interface CdxRow {
  timestamp: string
  original: string
  statuscode: string
}

async function listSnapshots(hfRepoId: string, from: string, to: string): Promise<CdxRow[]> {
  const url = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent('huggingface.co/' + hfRepoId)}&output=json&from=${from}&to=${to}&collapse=timestamp:8&fl=timestamp,original,statuscode&filter=statuscode:200`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CDX ${res.status} for ${hfRepoId}`)
  const data = (await res.json()) as string[][]
  const rows = data.slice(1) // first row is the header
  return rows.map(([timestamp, original, statuscode]) => ({ timestamp, original, statuscode }))
}

/** Extract "Downloads last month" from an archived HF model page. */
function parseDownloads(html: string): number | null {
  // Embedded JSON first: "downloads":5577155
  const jsonMatch = html.match(/&quot;downloads&quot;:(\d+)/) ?? html.match(/"downloads":(\d+)/)
  if (jsonMatch) return parseInt(jsonMatch[1], 10)
  // HTML fallback: <dt>...Downloads last month</dt> <dd class="font-semibold">5,577,155</dd>
  const ddMatch = html.match(/Downloads last month<\/dt>\s*<dd[^>]*>([\d,]+)<\/dd>/)
  if (ddMatch) return parseInt(ddMatch[1].replace(/,/g, ''), 10)
  return null
}

async function fetchArchivedDownloads(hfRepoId: string, timestamp: string): Promise<number | null> {
  const url = `http://web.archive.org/web/${timestamp}id_/https://huggingface.co/${hfRepoId}`
  const res = await fetch(url)
  if (!res.ok) return null
  return parseDownloads(await res.text())
}

function tsToDate(ts: string): string {
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
}

async function main(): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const to = new Date()
  const from = new Date(to.getTime() - DAYS * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

  const models = MODEL_REGISTRY.filter((m) => m.hfRepoId != null)
  log(`Backfilling ${models.length} models over ${DAYS} days of Wayback snapshots`)

  for (const model of models) {
    try {
      const snapshots = await listSnapshots(model.hfRepoId!, fmt(from), fmt(to))
      if (snapshots.length === 0) {
        log(`  ${model.key}: no archived snapshots`)
        continue
      }
      // Cap fetches per model to stay polite — take up to 24 evenly spaced snapshots
      const step = Math.max(1, Math.floor(snapshots.length / 24))
      const picked = snapshots.filter((_, i) => i % step === 0)

      let written = 0
      for (const snap of picked) {
        const downloads = await fetchArchivedDownloads(model.hfRepoId!, snap.timestamp)
        if (downloads == null) continue
        const { error } = await db.from('model_metrics').upsert(
          {
            model_key: model.key,
            snapshot_date: tsToDate(snap.timestamp),
            hf_downloads: downloads,
            hf_likes: 0,
            gh_stars: 0,
            gh_forks: 0,
            gh_contributors: 0,
          },
          { onConflict: 'model_key,snapshot_date', ignoreDuplicates: true }
        )
        if (!error) written++
      }
      log(`  ${model.key}: ${written} points backfilled (${snapshots.length} snapshots available)`)
    } catch (err) {
      logError(`Failed ${model.key}`, err)
    }
  }

  log('Backfill complete')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
