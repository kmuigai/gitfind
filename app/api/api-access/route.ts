import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// API access requests are stored, not emailed — Phase 0 validates demand
// before any API exists. Submissions land in the api_access_requests table
// (scripts/migrations/004-api-access-requests.sql) and are read in the
// Supabase dashboard. Written via the service role, the same pattern as
// /api/newsletter and /api/submit.

const TIERS = ['Free', 'Builder', 'Growth', 'Data License', 'Not sure'] as const
type Tier = (typeof TIERS)[number]

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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

  const db = createServiceClient()

  const { error } = await db.from('api_access_requests').insert({
    name,
    email,
    company,
    use_case: useCase,
    tier_interest: tier,
  })

  if (error) {
    console.error('API access request error:', error)
    return NextResponse.json(
      { error: 'Failed to save your request. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
