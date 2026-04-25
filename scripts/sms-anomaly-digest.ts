// SMS Anomaly Digest — daily text to Kayu
// Reads the highest-severity anomalies detected in the last ~24h (with a
// Claude-written narrative) and sends them as a single SMS via Twilio.
//
// Run locally: npx tsx scripts/sms-anomaly-digest.ts
// Dry run:    npx tsx scripts/sms-anomaly-digest.ts --dry-run
// Daily cron: see .github/workflows/anomaly-watcher.yml (runs after detect-anomalies.ts)
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, KAYU_PHONE_NUMBER

import { config } from 'dotenv'
config({ path: '.env.local' })

const TOP_N = 5
const LOOKBACK_HOURS = 26 // small buffer past 24h so a slightly-late detect run is still picked up
const DRY_RUN = process.argv.includes('--dry-run')

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${ts}] ${msg}`)
}

function formatBody(
  date: string,
  items: Array<{ owner: string; name: string; narrative: string }>,
): string {
  const lines = items.map((it, i) => `${i + 1}. ${it.owner}/${it.name}: ${it.narrative}`)
  return `GitFind • ${date}\n\n${lines.join('\n\n')}`
}

async function sendSms(body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const to = process.env.KAYU_PHONE_NUMBER
  if (!sid || !token || !from || !to) {
    throw new Error(
      'Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, KAYU_PHONE_NUMBER',
    )
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Twilio responded ${res.status}: ${detail}`)
  }
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  log('=== SMS Anomaly Digest Starting ===')

  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString()
  const { data: anomalies } = await db
    .from('anomalies')
    .select('id, repo_id, type, severity, narrative')
    .gte('detected_at', since)
    .not('narrative', 'is', null)
    .order('severity', { ascending: false })
    .limit(TOP_N)

  const typed = (anomalies ?? []) as unknown as Array<{
    id: string
    repo_id: string
    type: string
    severity: number
    narrative: string
  }>

  if (typed.length === 0) {
    log('no narrated anomalies in lookback window — nothing to send')
    return
  }

  const repoIds = Array.from(new Set(typed.map((a) => a.repo_id)))
  const { data: repos } = await db
    .from('repos')
    .select('id, owner, name')
    .in('id', repoIds)
  const repoMap = new Map(
    ((repos ?? []) as unknown as Array<{ id: string; owner: string; name: string }>).map((r) => [
      r.id,
      r,
    ]),
  )

  const items: Array<{ owner: string; name: string; narrative: string }> = []
  for (const a of typed) {
    const repo = repoMap.get(a.repo_id)
    if (!repo) continue
    items.push({ owner: repo.owner, name: repo.name, narrative: a.narrative })
  }
  if (items.length === 0) {
    log('no anomalies could be joined to repos — nothing to send')
    return
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
  const body = formatBody(dateLabel, items)
  log(`composed SMS (${body.length} chars):`)
  console.log(body)

  if (DRY_RUN) {
    log('DRY RUN — not sending')
    return
  }

  await sendSms(body)
  log(`SMS sent to Kayu (${items.length} anomalies)`)
}

main().catch((err) => {
  console.error('SMS Anomaly Digest failed:', err)
  process.exit(1)
})
