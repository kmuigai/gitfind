// Fetch daily package download counts from npm, PyPI, and crates.io
// Run: npx tsx scripts/fetch-downloads.ts
//
// Queries all repos that have package_registry set, fetches download stats,
// and upserts into the package_downloads table.

import { config } from 'dotenv'
config({ path: '.env.local' })

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

interface DownloadCounts {
  downloads_1d: number
  downloads_7d: number
  downloads_30d: number
}

// ── npm ──────────────────────────────────────────────────────────────────

interface NpmPointResponse {
  downloads: number
  package: string
}

async function fetchNpmDownloads(packageName: string): Promise<DownloadCounts> {
  const [res1d, res7d, res30d] = await Promise.all([
    fetch(`https://api.npmjs.org/downloads/point/last-day/${encodeURIComponent(packageName)}`),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`),
    fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`),
  ])

  const data1d = res1d.ok ? ((await res1d.json()) as NpmPointResponse) : null
  const data7d = res7d.ok ? ((await res7d.json()) as NpmPointResponse) : null
  const data30d = res30d.ok ? ((await res30d.json()) as NpmPointResponse) : null

  return {
    downloads_1d: data1d?.downloads ?? 0,
    downloads_7d: data7d?.downloads ?? 0,
    downloads_30d: data30d?.downloads ?? 0,
  }
}

// ── PyPI ─────────────────────────────────────────────────────────────────

interface PyPIRecentResponse {
  data: {
    last_day: number
    last_week: number
    last_month: number
  }
}

async function fetchPyPIDownloads(packageName: string): Promise<DownloadCounts> {
  const res = await fetch(
    `https://pypistats.org/api/packages/${encodeURIComponent(packageName)}/recent`
  )

  if (!res.ok) return { downloads_1d: 0, downloads_7d: 0, downloads_30d: 0 }

  const data = (await res.json()) as PyPIRecentResponse

  return {
    downloads_1d: data.data.last_day,
    downloads_7d: data.data.last_week,
    downloads_30d: data.data.last_month,
  }
}

// ── crates.io ────────────────────────────────────────────────────────────

interface CratesDownloadEntry {
  date: string
  downloads: number
}

interface CratesDownloadsResponse {
  version_downloads: CratesDownloadEntry[]
}

async function fetchCratesDownloads(packageName: string): Promise<DownloadCounts> {
  const res = await fetch(
    `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/downloads`,
    { headers: { 'User-Agent': 'GitFind/1.0 (https://gitfind.ai)' } }
  )

  if (!res.ok) return { downloads_1d: 0, downloads_7d: 0, downloads_30d: 0 }

  const data = (await res.json()) as CratesDownloadsResponse
  const entries = data.version_downloads ?? []

  // Aggregate by date
  const byDate = new Map<string, number>()
  for (const entry of entries) {
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.downloads)
  }

  const now = new Date()
  const oneDay = 24 * 60 * 60 * 1000
  let downloads_1d = 0
  let downloads_7d = 0
  let downloads_30d = 0

  for (const [dateStr, count] of byDate) {
    const daysAgo = Math.floor((now.getTime() - new Date(dateStr).getTime()) / oneDay)
    if (daysAgo <= 1) downloads_1d += count
    if (daysAgo <= 7) downloads_7d += count
    if (daysAgo <= 30) downloads_30d += count
  }

  return { downloads_1d, downloads_7d, downloads_30d }
}

// ── Main ─────────────────────────────────────────────────────────────────

const FETCH_FN: Record<string, (name: string) => Promise<DownloadCounts>> = {
  npm: fetchNpmDownloads,
  pypi: fetchPyPIDownloads,
  crates: fetchCratesDownloads,
}

// Rate limit delays per registry (ms)
const DELAY: Record<string, number> = {
  npm: 200,
  pypi: 500,
  crates: 1000,
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  log('=== Fetch Downloads Starting ===')

  const { data: repos, error } = await db
    .from('repos')
    .select('id, owner, name, package_registry, package_name')
    .not('package_registry', 'is', null)

  if (error || !repos) {
    logError('Failed to query repos with packages', error)
    return
  }

  const typedRepos = repos as unknown as Array<{
    id: string
    owner: string
    name: string
    package_registry: string
    package_name: string
  }>

  log(`Found ${typedRepos.length} repos with package mappings`)

  let success = 0
  let errors = 0
  const todayStr = new Date().toISOString().split('T')[0]

  for (const repo of typedRepos) {
    const fetchFn = FETCH_FN[repo.package_registry]
    if (!fetchFn) {
      log(`  Skipping ${repo.owner}/${repo.name}: unknown registry ${repo.package_registry}`)
      continue
    }

    try {
      const counts = await fetchFn(repo.package_name)
      log(
        `  ${repo.owner}/${repo.name} (${repo.package_registry}/${repo.package_name}): ` +
          `1d=${counts.downloads_1d}, 7d=${counts.downloads_7d}, 30d=${counts.downloads_30d}`
      )

      const { error: upsertError } = await db.from('package_downloads').upsert(
        {
          repo_id: repo.id,
          registry: repo.package_registry,
          package_name: repo.package_name,
          snapshot_date: todayStr,
          downloads_1d: counts.downloads_1d,
          downloads_7d: counts.downloads_7d,
          downloads_30d: counts.downloads_30d,
        },
        { onConflict: 'repo_id,registry,snapshot_date' }
      )

      if (upsertError) {
        logError(`Failed to upsert downloads for ${repo.owner}/${repo.name}`, upsertError)
        errors++
      } else {
        success++
      }
    } catch (err) {
      logError(`Failed to fetch downloads for ${repo.owner}/${repo.name}`, err)
      errors++
    }

    await new Promise((r) => setTimeout(r, DELAY[repo.package_registry] ?? 500))
  }

  log(`\n=== Fetch Downloads Complete ===`)
  log(`Success: ${success}, Errors: ${errors}`)
}

main().catch((err) => {
  console.error('Fetch downloads failed:', err)
  process.exit(1)
})
