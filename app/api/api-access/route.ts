import { type NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// API access requests are emailed, not stored — Phase 0 validates demand
// before any API (or schema) exists. Recipient defaults to Kayu; KAYU_EMAIL
// (already used by the digest scripts) can override it.
const NOTIFY_EMAIL = process.env.KAYU_EMAIL ?? 'k.muigai@gmail.com'
const FROM = 'GitFind <briefing@gitfind.ai>'

const TIERS = ['Free', 'Builder', 'Growth', 'Scale', 'Not sure'] as const
type Tier = (typeof TIERS)[number]

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function field(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const record = body as Record<string, unknown>
  const name = field(record, 'name')
  const email = field(record, 'email').toLowerCase()
  const company = field(record, 'company')
  const useCase = field(record, 'use_case')
  const tierRaw = field(record, 'tier')

  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid work email is required' }, { status: 400 })
  }
  if (!company || company.length > 160) {
    return NextResponse.json({ error: 'Your company is required' }, { status: 400 })
  }
  if (!useCase || useCase.length > 4000) {
    return NextResponse.json(
      { error: 'Tell us what you would build with the API' },
      { status: 400 },
    )
  }
  const tier: Tier = (TIERS as readonly string[]).includes(tierRaw)
    ? (tierRaw as Tier)
    : 'Not sure'

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('API access request error: RESEND_API_KEY is not configured')
    return NextResponse.json(
      { error: 'Failed to send your request. Please try again.' },
      { status: 500 },
    )
  }

  const resend = new Resend(apiKey)

  const rows: Array<[string, string]> = [
    ['Name', name],
    ['Work email', email],
    ['Company', company],
    ['Tier interest', tier],
    ['What they would build', useCase],
  ]
  const html = `
<div style="font-family:'Geist',system-ui,-apple-system,sans-serif;color:#1a1a2e;max-width:640px;">
  <h1 style="font-size:18px;margin:0 0 16px 0;">New GitFind API access request</h1>
  <table style="border-collapse:collapse;font-size:14px;line-height:1.6;">
    ${rows
      .map(
        ([label, value]) => `
    <tr>
      <td style="padding:4px 16px 4px 0;font-weight:700;vertical-align:top;white-space:nowrap;">${label}</td>
      <td style="padding:4px 0;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
    </tr>`,
      )
      .join('')}
  </table>
  <p style="margin:16px 0 0 0;font-size:12px;color:#7a7a9a;">Sent from the /developers request-access form. Reply to this email to answer the requester.</p>
</div>`

  // batch.send matches the working digest path — emails.send returned a 403
  // "domain not verified" against this same sender (see
  // scripts/email-anomaly-digest.ts).
  const { error } = await resend.batch.send([
    {
      from: FROM,
      to: NOTIFY_EMAIL,
      replyTo: email,
      subject: `GitFind API access request — ${company} (${tier})`,
      html,
    },
  ])

  if (error) {
    console.error('API access request error:', error)
    return NextResponse.json(
      { error: 'Failed to send your request. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
