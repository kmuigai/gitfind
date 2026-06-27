// Fetch daily AI coding tool commit counts using GitHub Search API
// Tracks 10 tools: Claude Code, Cursor, GitHub Copilot, Aider, Gemini CLI, Devin, Codex, Junie, Amazon Q, Cody
//
// Run: npx tsx scripts/search-commits.ts
//
// Note: GitHub Search API has a 30 requests/min rate limit.
// Each tool × day = 1 request. 10 tools × 1 day = 10 requests for nightly runs.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { upsertPlaceholderRepo } from './upsert-placeholder.js'

const TOOLS = [
  {
    name: 'Claude Code',
    query: (date: string) => `"Co-Authored-By: Claude" committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'Cursor',
    query: (date: string) => `"Co-authored-by: Cursor" committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'GitHub Copilot',
    query: (date: string) => `author:copilot-swe-agent committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'Aider',
    query: (date: string) => `"Co-authored-by: aider" committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'Gemini CLI',
    query: (date: string) => `"gemini-code-assist" committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'Devin',
    query: (date: string) => `author-email:bot@devin.ai committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'Codex',
    query: (date: string) => `"Co-authored-by: Codex" committer-date:${date}`,
    startDate: '2025-10-08',
  },
  {
    name: 'Junie',
    query: (date: string) => `"Co-authored-by: Junie" committer-date:${date}`,
    startDate: '2026-03-05',
  },
  {
    name: 'Amazon Q',
    query: (date: string) => `"amazon-q-developer" committer-date:${date}`,
    startDate: '2026-03-05',
  },
  {
    name: 'Cody',
    query: (date: string) => `"Co-authored-by: Cody" committer-date:${date}`,
    startDate: '2026-03-05',
  },
] as const

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN not set')
    process.exit(1)
  }

  const repoId = await upsertPlaceholderRepo(db)

  // Stop at 2 days ago — GitHub's search index can lag ~24h,
  // so T-2 ensures we get fully settled, accurate counts
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 2)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const cutoffDate = new Date(cutoffStr + 'T00:00:00Z')

  // Re-query window: re-fetch last 5 days to catch late-indexed results
  const REQUERY_DAYS = 5

  // Fetch commit count for a tool+date and upsert into DB
  async function fetchAndUpsert(
    tool: (typeof TOOLS)[number],
    dateStr: string,
    prefix: string,
  ): Promise<boolean> {
    const url = `https://api.github.com/search/commits?q=${encodeURIComponent(tool.query(dateStr))}&per_page=1`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.cloak-preview+json',
        'User-Agent': 'GitFind/1.0',
      },
    })

    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining')
      if (remaining === '0') {
        // Primary rate limit — wait until reset
        const reset = response.headers.get('X-RateLimit-Reset')
        const waitMs = reset ? (parseInt(reset) * 1000 - Date.now()) : 60000
        log(`Rate limited (primary). Waiting ${Math.ceil(waitMs / 1000)}s...`)
        await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)))
        return false // Signal retry
      }
      // Secondary rate limit — GitHub throttles heavy search queries; wait and retry
      log(`${prefix}Secondary rate limit for ${tool.name} ${dateStr} — waiting 90s...`)
      await new Promise((r) => setTimeout(r, 90000))
      return false // Signal retry
    }

    if (!response.ok) {
      log(`${prefix}Error for ${tool.name} ${dateStr}: ${response.status}`)
      return true // Skip this date
    }

    const data = await response.json() as { total_count: number }
    const count = data.total_count

    await db.from('tool_contributions').upsert(
      {
        repo_id: repoId,
        tool_name: tool.name,
        commit_count: count,
        month: dateStr,
      },
      { onConflict: 'repo_id,tool_name,month' }
    )

    log(`${prefix}${tool.name} ${dateStr}: ${count.toLocaleString()} commits`)

    // Respect rate limit: 30 requests/min = 2s between requests
    await new Promise((r) => setTimeout(r, 2200))
    return true
  }

  let totalImported = 0

  // ── Pass 1: Fill forward — new dates we haven't seen yet ──
  log('── Pass 1: Fill forward ──')

  for (const tool of TOOLS) {
    const { data: latest } = await db
      .from('tool_contributions')
      .select('month')
      .eq('repo_id', repoId)
      .eq('tool_name', tool.name)
      .order('month', { ascending: false })
      .limit(1)

    const lastDate = latest && latest.length > 0
      ? (latest[0] as unknown as { month: string }).month
      : tool.startDate

    const startDate = new Date(lastDate + 'T00:00:00Z')
    startDate.setUTCDate(startDate.getUTCDate() + 1)

    if (startDate >= cutoffDate) {
      log(`${tool.name}: already up to date`)
      continue
    }

    log(`${tool.name}: filling from ${startDate.toISOString().slice(0, 10)} to ${cutoffStr}`)
    let imported = 0
    const current = new Date(startDate)

    while (current < cutoffDate) {
      const dateStr = current.toISOString().slice(0, 10)
      const ok = await fetchAndUpsert(tool, dateStr, '  ')
      if (ok) {
        imported++
        current.setUTCDate(current.getUTCDate() + 1)
      }
      // If !ok, it was a rate limit — retry same date
    }

    log(`${tool.name}: imported ${imported} days`)
    totalImported += imported
  }

  // ── Pass 2: Re-query window — re-fetch last N days to catch late-indexed commits ──
  log(`\n── Pass 2: Re-query last ${REQUERY_DAYS} days ──`)

  let totalRequeried = 0

  for (const tool of TOOLS) {
    let requeried = 0

    for (let d = REQUERY_DAYS + 2; d >= 2; d--) {
      const reqDate = new Date()
      reqDate.setUTCDate(reqDate.getUTCDate() - d)
      const dateStr = reqDate.toISOString().slice(0, 10)

      let ok = false
      while (!ok) {
        ok = await fetchAndUpsert(tool, dateStr, '  [requery] ')
      }
      requeried++
    }

    log(`${tool.name}: re-queried ${requeried} days`)
    totalRequeried += requeried
  }

  // ── Pass 3: Zero-backfill — re-fetch days stored as 0 within lookback window ──
  // Rows stored as 0 happen when GitHub API errors during initial fill and then
  // fall outside the Pass 2 re-query window. BACKFILL_DAYS controls lookback depth;
  // default 30 for daily runs, set higher (e.g. 90) for a manual historical fix.
  const ZERO_BACKFILL_DAYS = parseInt(process.env.BACKFILL_DAYS ?? '30', 10)
  log(`\n── Pass 3: Zero-backfill (last ${ZERO_BACKFILL_DAYS} days) ──`)

  let totalZeroFixed = 0

  for (const tool of TOOLS) {
    const lookbackDate = new Date()
    lookbackDate.setUTCDate(lookbackDate.getUTCDate() - ZERO_BACKFILL_DAYS)
    const lookbackStr = lookbackDate.toISOString().slice(0, 10)

    const { data: zeroDays } = await db
      .from('tool_contributions')
      .select('month')
      .eq('repo_id', repoId)
      .eq('tool_name', tool.name)
      .eq('commit_count', 0)
      .gte('month', lookbackStr)
      .lte('month', cutoffStr)
      .order('month', { ascending: true })

    if (!zeroDays || zeroDays.length === 0) {
      log(`${tool.name}: no zero days in window`)
      continue
    }

    const zeroDates = (zeroDays as unknown as Array<{ month: string }>).map((r) => r.month)
    log(`${tool.name}: found ${zeroDates.length} zero day(s) — re-querying`)

    let fixed = 0
    for (const dateStr of zeroDates) {
      let ok = false
      while (!ok) {
        ok = await fetchAndUpsert(tool, dateStr, '  [zero-fix] ')
      }
      fixed++
    }

    log(`${tool.name}: fixed ${fixed} zero day(s)`)
    totalZeroFixed += fixed
  }

  // ── Pass 4: Gap-fill — create rows for dates with NO entry at all ──
  // Unlike Pass 3 (which finds rows with count=0), this finds completely missing
  // dates within the lookback window and fetches them. Runs when BACKFILL_DAYS is set
  // (i.e. a manual dispatch) to avoid slowing down normal nightly runs.
  const GAP_FILL_DAYS = parseInt(process.env.BACKFILL_DAYS ?? '0', 10)

  if (GAP_FILL_DAYS > 0) {
    log(`\n── Pass 4: Gap-fill (last ${GAP_FILL_DAYS} days) ──`)
    let totalGapFilled = 0

    for (const tool of TOOLS) {
      const lookbackDate = new Date()
      lookbackDate.setUTCDate(lookbackDate.getUTCDate() - GAP_FILL_DAYS)
      const lookbackStr = lookbackDate.toISOString().slice(0, 10)

      // Determine effective start: later of tool.startDate or lookback window
      const effectiveStart = lookbackStr > tool.startDate ? lookbackStr : tool.startDate

      const { data: existingRows } = await db
        .from('tool_contributions')
        .select('month')
        .eq('repo_id', repoId)
        .eq('tool_name', tool.name)
        .gte('month', effectiveStart)
        .lte('month', cutoffStr)

      const present = new Set(
        (existingRows as unknown as Array<{ month: string }>).map((r) => r.month)
      )

      // Build list of missing dates
      const missingDates: string[] = []
      const cur = new Date(effectiveStart + 'T00:00:00Z')
      const end = new Date(cutoffStr + 'T00:00:00Z')
      while (cur <= end) {
        const d = cur.toISOString().slice(0, 10)
        if (!present.has(d)) missingDates.push(d)
        cur.setUTCDate(cur.getUTCDate() + 1)
      }

      if (missingDates.length === 0) {
        log(`${tool.name}: no gaps in window`)
        continue
      }

      log(`${tool.name}: ${missingDates.length} missing date(s) — fetching`)
      let gapFilled = 0
      for (const dateStr of missingDates) {
        let ok = false
        while (!ok) {
          ok = await fetchAndUpsert(tool, dateStr, '  [gap-fill] ')
        }
        gapFilled++
      }

      log(`${tool.name}: gap-filled ${gapFilled} date(s)`)
      totalGapFilled += gapFilled
    }

    log(`Gap-fill total: ${totalGapFilled} dates inserted`)
  }

  log(`\nDone! Imported ${totalImported} new + re-queried ${totalRequeried} + zero-fixed ${totalZeroFixed} days across ${TOOLS.length} tools.`)
}

main().catch((err) => {
  console.error('Search commits failed:', err)
  process.exit(1)
})
