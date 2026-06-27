// One-shot: fetch Claude Code for June 5–10, 2026 only.
// Runs with 10s base delay + exponential backoff on 403s so the
// token isn't shared with any other tool queries.
import { config } from 'dotenv'
config({ path: '.env.local' })

import { upsertPlaceholderRepo } from './upsert-placeholder.js'

const MISSING_DATES = [
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
  '2026-06-08',
  '2026-06-09',
  '2026-06-10',
]

const QUERY = (date: string) => `"Co-Authored-By: Claude" committer-date:${date}`

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] ${msg}`)
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const token = process.env.GITHUB_TOKEN
  if (!token) { console.error('GITHUB_TOKEN not set'); process.exit(1) }

  const repoId = await upsertPlaceholderRepo(db)

  log(`Fetching ${MISSING_DATES.length} missing Claude Code dates with backoff...`)

  for (const dateStr of MISSING_DATES) {
    let attempt = 0
    let success = false

    while (!success) {
      attempt++
      log(`${dateStr} — attempt ${attempt}`)

      const url = `https://api.github.com/search/commits?q=${encodeURIComponent(QUERY(dateStr))}&per_page=1`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.cloak-preview+json',
          'User-Agent': 'GitFind/1.0',
        },
      })

      if (res.status === 403) {
        const remaining = res.headers.get('X-RateLimit-Remaining')

        if (remaining === '0') {
          // Primary rate limit — wait until reset
          const reset = res.headers.get('X-RateLimit-Reset')
          const waitMs = reset ? (parseInt(reset) * 1000 - Date.now()) : 60000
          log(`  Primary rate limit — waiting ${Math.ceil(waitMs / 1000)}s`)
          await sleep(Math.max(waitMs, 1000))
        } else {
          // Secondary rate limit — exponential backoff: 2min, 4min, 8min...
          const waitMs = Math.min(120000 * Math.pow(2, attempt - 1), 600000)
          log(`  Secondary rate limit — backoff ${Math.ceil(waitMs / 1000)}s (attempt ${attempt})`)
          await sleep(waitMs)
        }
        continue
      }

      if (!res.ok) {
        log(`  HTTP ${res.status} — skipping`)
        success = true
        continue
      }

      const json = await res.json() as { total_count: number }
      const count = json.total_count

      const { error } = await db.from('tool_contributions').upsert(
        { repo_id: repoId, tool_name: 'Claude Code', commit_count: count, month: dateStr },
        { onConflict: 'repo_id,tool_name,month' }
      )

      if (error) {
        log(`  DB error: ${error.message}`)
      } else {
        log(`  ✓ ${dateStr}: ${count.toLocaleString()} commits`)
      }
      success = true
    }

    // 10s between dates to stay well under secondary limit threshold
    if (MISSING_DATES.indexOf(dateStr) < MISSING_DATES.length - 1) {
      log(`  Waiting 10s before next date...`)
      await sleep(10000)
    }
  }

  log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
