import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateDemandEvent } from '@/lib/demand'

// Demand events are stored, never displayed back — the Demand Graph
// (docs/demand-graph.md) is a write-only asset from the public side.
// Submissions land in the demand_events table
// (scripts/migrations/006-demand-events.sql) and are read as aggregates in
// the Supabase dashboard. Written via the service role, the same pattern
// as /api/newsletter, /api/submit, and /api/api-access. Validation lives in
// lib/demand.ts and is strict: unknown fields are rejected, so the table
// only ever holds the documented shape (no PII can be smuggled in).

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const result = validateDemandEvent(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const db = createServiceClient()

  const { error } = await db.from('demand_events').insert(result.event)

  if (error) {
    console.error('Demand event error:', error)
    return NextResponse.json(
      { error: 'Failed to save the event. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
