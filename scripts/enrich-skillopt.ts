// One-off targeted enrichment for microsoft/SkillOpt — same scoring
// inputs and enrichment path as the pipeline, once.
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const [
    { getReadme, cleanReadme, getHNMentions },
    { calculateScore },
    { enrichRepo },
    { createServiceClient },
  ] = await Promise.all([
    import('../lib/github.js').then(async (g) => ({ ...g, getHNMentions: (await import('../lib/hn.js')).getHNMentions })),
    import('../lib/score.js'),
    import('../lib/enrichment.js'),
    import('../lib/supabase.js'),
  ])

  const db = createServiceClient()
  const { data: repo, error } = await db
    .from('repos')
    .select('*')
    .eq('owner', 'microsoft')
    .eq('name', 'SkillOpt')
    .maybeSingle()

  if (error || !repo) {
    console.error('repo not found', error)
    process.exit(1)
  }

  const row = repo as unknown as {
    id: string
    github_id: number
    name: string
    owner: string
    description: string | null
    stars: number
    forks: number
    contributors: number
    language: string | null
    url: string
    topics: string[] | null
  }

  const today = new Date()
  const date7dAgo = new Date(today); date7dAgo.setDate(today.getDate() - 7)
  const date14dAgo = new Date(today); date14dAgo.setDate(today.getDate() - 14)
  const date30dAgo = new Date(today); date30dAgo.setDate(today.getDate() - 30)
  const iso = (d: Date) => d.toISOString().split('T')[0]

  const [
    { data: snap7d },
    { data: snap14d },
    { data: snap30d },
    { data: latestSnap },
    { data: weeklyStats },
    hnMentions,
  ] = await Promise.all([
    db.from('repo_snapshots').select('stars, stars_7d, forks').eq('repo_id', row.id).eq('snapshot_date', iso(date7dAgo)).maybeSingle(),
    db.from('repo_snapshots').select('stars_7d, forks').eq('repo_id', row.id).eq('snapshot_date', iso(date14dAgo)).maybeSingle(),
    db.from('repo_snapshots').select('stars').eq('repo_id', row.id).eq('snapshot_date', iso(date30dAgo)).maybeSingle(),
    db.from('repo_snapshots').select('stars_7d').eq('repo_id', row.id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('weekly_stats').select('commit_count_4w').eq('repo_id', row.id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    getHNMentions('microsoft', 'SkillOpt'),
  ])

  const stars_7d = latestSnap?.stars_7d ?? (snap7d ? row.stars - snap7d.stars : 0)
  const stars_30d = snap30d ? row.stars - snap30d.stars : 0
  const commits_30d = weeklyStats?.commit_count_4w ?? 0
  const forks_7d = snap7d ? row.forks - snap7d.forks : undefined
  const forks_7d_prev = snap7d && snap14d ? snap7d.forks - snap14d.forks : undefined
  const stars_7d_prev = snap7d?.stars_7d

  const { score, breakdown } = calculateScore({
    stars: row.stars,
    stars_7d,
    stars_30d,
    contributors: row.contributors ?? 0,
    forks: row.forks,
    hn_mentions_7d: hnMentions.mentions_7d,
    hn_mentions_30d: hnMentions.mentions_30d,
    commits_30d,
    stars_7d_prev: stars_7d_prev ?? undefined,
    forks_7d: forks_7d != null && forks_7d >= 0 ? forks_7d : undefined,
    forks_7d_prev: forks_7d_prev != null && forks_7d_prev >= 0 ? forks_7d_prev : undefined,
  })

  console.log(`enriching microsoft/SkillOpt — score ${score} (stars_7d ${stars_7d}, stars_30d ${stars_30d}, commits_30d ${commits_30d}, penalty ${breakdown.manipulation_penalty})`)

  const rawReadme = await getReadme('microsoft', 'SkillOpt')
  const readmeExcerpt = rawReadme ? cleanReadme(rawReadme) : undefined

  await enrichRepo(row.id, {
    github_id: row.github_id,
    name: row.name,
    owner: row.owner,
    description: row.description,
    stars: row.stars,
    forks: row.forks,
    contributors: row.contributors ?? 0,
    language: row.language,
    topics: row.topics ?? undefined,
    readme_excerpt: readmeExcerpt || undefined,
  }, score, breakdown, true)

  console.log('done ✓')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
