import { redirect } from 'next/navigation'

export const revalidate = 3600

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
