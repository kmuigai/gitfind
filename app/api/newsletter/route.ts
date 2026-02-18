import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email =
    typeof body === 'object' && body !== null && 'email' in body
      ? String((body as Record<string, unknown>).email).trim().toLowerCase()
      : ''

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check for existing subscriber
  const { data: existing } = await db
    .from('subscribers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Already subscribed — return success (don't reveal that they're already on the list)
    return NextResponse.json({ success: true })
  }

  const { error } = await db.from('subscribers').insert({ email })

  if (error) {
    console.error('Newsletter signup error:', error)
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

// SQL to run in Supabase SQL editor to create the subscribers table:
//
// CREATE TABLE IF NOT EXISTS subscribers (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   email TEXT UNIQUE NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
