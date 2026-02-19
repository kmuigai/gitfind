// Import BigQuery CSV results into tool_contributions table
// Run: npx tsx scripts/import-bigquery.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'fs'
import { join } from 'path'

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  // Create a placeholder repo for BigQuery aggregate data
  const { data: placeholderRepo, error: repoErr } = await db
    .from('repos')
    .upsert(
      {
        github_id: 0,
        name: '_bigquery_aggregate',
        owner: '_gitfind',
        description: 'Aggregate Claude Code commit data from BigQuery (all public GitHub repos)',
        stars: 0,
        forks: 0,
        contributors: 0,
        url: 'https://github.com',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_id' }
    )
    .select('id')
    .single()

  if (repoErr || !placeholderRepo) {
    console.error('Failed to create placeholder repo:', repoErr)
    process.exit(1)
  }

  const repoId = placeholderRepo.id
  log(`Using placeholder repo_id: ${repoId}`)

  // Read CSV
  const csvPath = join(process.cwd(), 'bq-results-20260219-112438-1771500486858.csv')
  const csv = readFileSync(csvPath, 'utf-8')
  const lines = csv.trim().split('\n').slice(1) // Skip header

  log(`Found ${lines.length} rows in CSV`)

  let imported = 0
  // Batch upserts for speed
  const batch: Array<{
    repo_id: string
    tool_name: string
    commit_count: number
    month: string
  }> = []

  for (const line of lines) {
    const [date, countStr] = line.split(',')
    if (!date || !countStr) continue

    batch.push({
      repo_id: repoId,
      tool_name: 'Claude Code',
      commit_count: parseInt(countStr, 10),
      month: date,
    })

    // Upsert in batches of 50
    if (batch.length >= 50) {
      const { error } = await db
        .from('tool_contributions')
        .upsert(batch, { onConflict: 'repo_id,tool_name,month' })

      if (error) {
        console.error('Upsert error:', error)
      } else {
        imported += batch.length
      }
      batch.length = 0
    }
  }

  // Remaining rows
  if (batch.length > 0) {
    const { error } = await db
      .from('tool_contributions')
      .upsert(batch, { onConflict: 'repo_id,tool_name,month' })

    if (error) {
      console.error('Upsert error:', error)
    } else {
      imported += batch.length
    }
  }

  log(`Imported ${imported} daily entries`)
  log('Done!')
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
