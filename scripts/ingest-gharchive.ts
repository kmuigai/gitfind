// GH Archive Ingestion
// Downloads yesterday's hourly event dumps from data.gharchive.org,
// filters for repos that gained 5+ stars in 24h, inserts new repos into DB.
//
// GitHub API cost: 0 calls (GH Archive is a separate data source)
// Expected yield: 2,000–5,000 new repos/day initially
//
// Run locally: npx tsx scripts/ingest-gharchive.ts
// Run nightly: GitHub Actions (before main pipeline)

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createGunzip } from 'zlib'
import { createInterface } from 'readline'

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

interface GHArchiveEvent {
  type: string
  repo: {
    id: number
    name: string // "owner/repo"
  }
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  // Use yesterday's date (GH Archive dumps are available after the day ends)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]

  log(`=== GH Archive Ingestion for ${dateStr} ===`)

  // Aggregate star counts per repo across all 24 hours
  const starCounts = new Map<number, { name: string; count: number }>()

  for (let hour = 0; hour < 24; hour++) {
    const url = `https://data.gharchive.org/${dateStr}-${hour}.json.gz`
    log(`Downloading ${dateStr}-${hour}.json.gz...`)

    let response: Response
    try {
      response = await fetch(url)
    } catch (err) {
      log(`  Failed to fetch hour ${hour}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }

    if (!response.ok) {
      log(`  HTTP ${response.status} for hour ${hour}, skipping`)
      continue
    }

    const body = response.body
    if (!body) {
      log(`  No body for hour ${hour}, skipping`)
      continue
    }

    // Stream through gunzip + readline (never load full file into memory)
    const gunzip = createGunzip()

    // Convert web ReadableStream to Node stream
    const reader = body.getReader()
    const pushToGunzip = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            gunzip.end()
            break
          }
          if (!gunzip.write(value)) {
            await new Promise<void>((resolve) => gunzip.once('drain', resolve))
          }
        }
      } catch (err) {
        gunzip.destroy(err instanceof Error ? err : new Error(String(err)))
      }
    }

    const pushPromise = pushToGunzip()

    const rl = createInterface({ input: gunzip })

    let linesProcessed = 0
    for await (const line of rl) {
      linesProcessed++
      try {
        const event = JSON.parse(line) as GHArchiveEvent
        if (event.type !== 'WatchEvent') continue

        const repoId = event.repo.id
        const existing = starCounts.get(repoId)
        if (existing) {
          existing.count++
        } else {
          starCounts.set(repoId, { name: event.repo.name, count: 1 })
        }
      } catch {
        // Skip malformed lines
      }
    }

    await pushPromise
    log(`  Hour ${hour}: ${linesProcessed.toLocaleString()} events processed`)
  }

  // Filter: only repos with 5+ stars in 24h
  const qualified = new Map<number, string>()
  for (const [repoId, data] of starCounts) {
    if (data.count >= 5) {
      qualified.set(repoId, data.name)
    }
  }

  log(`\nRepos with 5+ stars yesterday: ${qualified.size.toLocaleString()} (from ${starCounts.size.toLocaleString()} total)`)

  if (qualified.size === 0) {
    log('No qualifying repos found. Done.')
    return
  }

  // Batch-check which repos already exist in DB
  const githubIds = Array.from(qualified.keys())
  const existingIds = new Set<number>()

  // Query in batches of 500 (Supabase IN filter limit)
  for (let i = 0; i < githubIds.length; i += 500) {
    const batch = githubIds.slice(i, i + 500)
    const { data } = await db
      .from('repos')
      .select('github_id')
      .in('github_id', batch)

    if (data) {
      for (const row of data) {
        existingIds.add(row.github_id as number)
      }
    }
  }

  log(`Already in DB: ${existingIds.size.toLocaleString()}`)

  // Insert new repos with minimal data
  const newRepos: Array<{
    github_id: number
    owner: string
    name: string
    url: string
    stars: number
    forks: number
  }> = []

  for (const [githubId, fullName] of qualified) {
    if (existingIds.has(githubId)) continue

    const parts = fullName.split('/')
    if (parts.length !== 2) continue
    const [owner, name] = parts

    newRepos.push({
      github_id: githubId,
      owner,
      name,
      url: `https://github.com/${fullName}`,
      stars: 0,  // Will be filled by snapshot-light.ts
      forks: 0,
    })
  }

  log(`New repos to insert: ${newRepos.length.toLocaleString()}`)

  // Insert in batches of 100
  let inserted = 0
  for (let i = 0; i < newRepos.length; i += 100) {
    const batch = newRepos.slice(i, i + 100)
    const { error } = await db
      .from('repos')
      .upsert(batch, { onConflict: 'github_id', ignoreDuplicates: true })

    if (error) {
      log(`  Insert batch error: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  log(`\n=== GH Archive Ingestion Complete ===`)
  log(`Inserted: ${inserted} new repos`)
  log(`Skipped (already in DB): ${existingIds.size}`)
}

main().catch((err) => {
  console.error('GH Archive ingestion failed:', err)
  process.exit(1)
})
