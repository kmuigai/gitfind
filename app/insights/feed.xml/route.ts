import { getRisingRepos, getSnapshotDates } from '@/lib/queries'

export const revalidate = 3600

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWeekLabel(date: string): string {
  const [y, m, d] = date.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function toSunday(date: string): string {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const [repos, snapshotDates] = await Promise.all([
    getRisingRepos(10),
    getSnapshotDates(),
  ])

  // Current week
  const currentWeek = toSunday(new Date().toISOString().slice(0, 10))
  const weekLabel = formatWeekLabel(currentWeek)

  // Build description from top repos
  const repoLines = repos
    .map((r, i) => `${i + 1}. ${r.owner}/${r.name} — +${formatStars(r.stars_7d)} stars`)
    .join('\n')

  const description = repos.length > 0
    ? `Top 10 fastest-accelerating repos for the week of ${weekLabel}:\n\n${repoLines}`
    : `Rising This Week rankings for ${weekLabel}.`

  // Get unique weeks for past items
  const weeks = new Set<string>()
  for (const d of snapshotDates.slice(0, 30)) {
    weeks.add(toSunday(d))
  }
  const sortedWeeks = Array.from(weeks).sort().reverse().slice(0, 12)

  const items = sortedWeeks.map((week) => {
    const label = formatWeekLabel(week)
    const url = `https://gitfind.ai/insights/rising-this-week/${week}`
    const pubDate = new Date(week).toUTCString()

    return `    <item>
      <title>Rising This Week — ${escapeXml(label)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(week === currentWeek ? description : `Fastest-accelerating GitHub repos for the week of ${label}.`)}</description>
    </item>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GitFind Insights</title>
    <link>https://gitfind.ai/insights</link>
    <description>Weekly rankings, trend analysis, and breakout signals from every public GitHub repo.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://gitfind.ai/insights/feed.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
