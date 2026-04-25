// Email Anomaly Digest — daily email to Kayu
// Reads the highest-severity anomalies detected in the last ~24h (with a
// Claude-written narrative) and sends them as a single email via Resend.
//
// Run locally: npx tsx scripts/email-anomaly-digest.ts
// Dry run:    npx tsx scripts/email-anomaly-digest.ts --dry-run
// Daily cron: see .github/workflows/anomaly-watcher.yml (runs after detect-anomalies.ts)
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   RESEND_API_KEY, KAYU_EMAIL

import { config } from 'dotenv'
config({ path: '.env.local' })

import type { AnomalyType } from '../lib/database.types.js'

const TOP_N = 5
const LOOKBACK_HOURS = 26
const DRY_RUN = process.argv.includes('--dry-run')

const TYPE_LABEL: Record<AnomalyType, string> = {
  stars_breakout: 'stars surge',
  downloads_accel: 'downloads jump',
  maintainer_silent: 'maintainer quiet',
  release_cadence_shift: 'release pause',
}

interface DigestItem {
  owner: string
  name: string
  type: AnomalyType
  narrative: string
}

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${ts}] ${msg}`)
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSubject(date: string, count: number): string {
  return `GitFind • ${count} anomal${count === 1 ? 'y' : 'ies'} today (${date})`
}

function buildHtml(date: string, items: DigestItem[]): string {
  const rows = items
    .map((it, i) => {
      const url = `https://gitfind.ai/project/${encodeURIComponent(it.owner)}/${encodeURIComponent(it.name)}`
      const label = TYPE_LABEL[it.type]
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
  <tr>
    <td style="background:#14141c;border:1px solid #1e1e2e;border-radius:10px;padding:16px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
        <tr>
          <td>
            <span style="font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:11px;color:#4a4a6a;">${i + 1}.</span>
            <a href="${url}" style="font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;color:#6c6af6;text-decoration:none;margin-left:6px;">${esc(it.owner)}/${esc(it.name)}</a>
          </td>
          <td style="text-align:right;">
            <span style="display:inline-block;background:#1a1a3a;color:#6c6af6;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.55;color:#bbbbcc;">
        ${esc(it.narrative)}
      </p>
    </td>
  </tr>
</table>`
    })
    .join('\n')

  return `<div style="max-width:600px;margin:0 auto;background:#0a0a14;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
    <tr>
      <td style="padding:0 0 16px 0;border-bottom:1px solid #1e1e2e;">
        <span style="font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:16px;font-weight:600;color:#e8e8f0;letter-spacing:-0.3px;">gitfind.ai</span>
        <span style="font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#4a4a6a;margin-left:10px;">Anomaly Watcher · ${date}</span>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 18px 0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#7a7a9a;">
    ${items.length} thing${items.length === 1 ? '' : 's'} worth a look — what your scoring didn't already surface.
  </p>
  ${rows}
</div>`
}

async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.KAYU_EMAIL
  if (!apiKey) throw new Error('Missing RESEND_API_KEY')
  if (!to) throw new Error('Missing KAYU_EMAIL')
  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: 'GitFind <briefing@gitfind.ai>',
    to,
    subject,
    html,
  })
  if (error) throw new Error(`Resend rejected the send: ${JSON.stringify(error)}`)
}

async function main(): Promise<void> {
  const { createServiceClient } = await import('../lib/supabase.js')
  const db = createServiceClient()

  log('=== Email Anomaly Digest Starting ===')

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
    type: AnomalyType
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

  const items: DigestItem[] = []
  for (const a of typed) {
    const repo = repoMap.get(a.repo_id)
    if (!repo) continue
    items.push({ owner: repo.owner, name: repo.name, type: a.type, narrative: a.narrative })
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
  const subject = buildSubject(dateLabel, items.length)
  const html = buildHtml(dateLabel, items)
  log(`composed email — subject: "${subject}", body: ${html.length} chars`)

  if (DRY_RUN) {
    log('DRY RUN — not sending')
    console.log(html)
    return
  }

  await sendEmail(subject, html)
  log(`email sent (${items.length} anomalies)`)
}

main().catch((err) => {
  console.error('Email Anomaly Digest failed:', err)
  process.exit(1)
})
