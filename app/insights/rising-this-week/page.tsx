import { redirect } from 'next/navigation'

// force-dynamic: skip build-time generation — queries are too slow until Supabase region is aligned with Vercel
// TODO: revert to `export const revalidate = 3600` once region latency is fixed
export const dynamic = 'force-dynamic'

// Compute the Sunday of the current week as YYYY-MM-DD
function getCurrentWeekDate(): string {
  const now = new Date()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - now.getDay())
  const y = sunday.getFullYear()
  const m = String(sunday.getMonth() + 1).padStart(2, '0')
  const d = String(sunday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function RisingThisWeekRedirect() {
  redirect(`/insights/rising-this-week/${getCurrentWeekDate()}`)
}
