// Trend Narrator Agent
// Autonomous agent that generates plain-English narratives explaining WHY repos are trending.
// Runs after the nightly pipeline — correlates snapshot diffs, HN mentions, score breakdowns,
// and commit velocity to produce a story for each top mover.
//
// Run locally: npx tsx scripts/trend-narrator.ts
// Run nightly: GitHub Actions (step in pipeline.yml after pipeline.ts)

import { config } from 'dotenv'
config({ path: '.env.local' })

const MAX_NARRATIVES_PER_RUN = 15
const CONCURRENCY = 5

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []

  function next() {
    if (queue.length > 0 && active < limit) {
      active++
      queue.shift()!()
    }
  }

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve))
    } else {
      active++
    }
    try {
      return await fn()
    } finally {
      active--
      next()
    }
  }
}

interface ScoreBreakdown {
  star_velocity_score: number
  contributor_ratio_score: number
  fork_velocity_score: number
  mention_velocity_score: number
  commit_frequency_score: number
  star_acceleration_score?: number
  fork_acceleration_score?: number
  manipulation_penalty: number
  raw_score: number
  final_score: number
}

interface TopMover {
  repo_id: string
  owner: string
  name: string
  description: string | null
  stars: number
  forks: number
  contributors: number
  language: string | null
  summary: string
  category: string
  score: number
  score_breakdown: ScoreBreakdown | null
  // Computed from snapshots
  stars_7d: number
  stars_7d_prev: number
  forks_current: number
  forks_7d_ago: number
  // HN mentions
  hn_mentions_7d: number
  hn_mentions_30d: number
  // Commit velocity
  commit_count_4w: number
}

function buildNarrativePrompt(mover: TopMover): string {
  const starAcceleration =
    mover.stars_7d_prev > 0
      ? ((mover.stars_7d / mover.stars_7d_prev - 1) * 100).toFixed(0)
      : null

  const forkDelta = mover.forks_current - mover.forks_7d_ago
  const contributorRatio =
    mover.stars > 0 ? (mover.contributors / mover.stars).toFixed(3) : '0'

  const breakdown = mover.score_breakdown
  const topSignals: string[] = []
  if (breakdown) {
    const signals = [
      { name: 'star velocity', score: breakdown.star_velocity_score },
      { name: 'contributor ratio', score: breakdown.contributor_ratio_score },
      { name: 'fork velocity', score: breakdown.fork_velocity_score },
      { name: 'HN mentions', score: breakdown.mention_velocity_score },
      { name: 'commit frequency', score: breakdown.commit_frequency_score },
    ]
    if (breakdown.star_acceleration_score != null) {
      signals.push({ name: 'star acceleration', score: breakdown.star_acceleration_score })
    }
    signals.sort((a, b) => b.score - a.score)
    for (const s of signals.slice(0, 3)) {
      if (s.score > 0) topSignals.push(`${s.name} (${s.score.toFixed(0)}/100)`)
    }
  }

  return `You are writing a trend narrative for GitFind, a directory that helps non-technical product managers understand what's happening on GitHub.

Repository: ${mover.owner}/${mover.name}
Description: ${mover.description ?? 'No description'}
Category: ${mover.category}
What it does: ${mover.summary}
Language: ${mover.language ?? 'Unknown'}

Current stats:
- Early Signal Score: ${mover.score}/100
- Stars: ${mover.stars.toLocaleString()} total, +${mover.stars_7d.toLocaleString()} this week${starAcceleration ? ` (${starAcceleration}% change from last week's +${mover.stars_7d_prev.toLocaleString()})` : ''}
- Forks: ${mover.forks.toLocaleString()} total${forkDelta > 0 ? `, +${forkDelta.toLocaleString()} this week` : ''}
- Contributors: ${mover.contributors.toLocaleString()} (ratio to stars: ${contributorRatio})
- Commits in last 30 days: ${mover.commit_count_4w}
- Hacker News mentions: ${mover.hn_mentions_7d} this week, ${mover.hn_mentions_30d} this month
${topSignals.length > 0 ? `- Strongest signals: ${topSignals.join(', ')}` : ''}
${breakdown && breakdown.manipulation_penalty > 0 ? `- Manipulation penalty applied: -${breakdown.manipulation_penalty} points` : ''}

Write a 2-3 sentence trend narrative explaining WHY this project is gaining attention right now. Rules:
1. Write in plain English for non-technical product managers. No jargon.
2. Connect the data points into a story — don't just list stats.
3. If star acceleration is high, explain what that momentum means.
4. If HN mentions are notable (>0), mention the community buzz.
5. If contributor ratio is strong (>0.05), note the healthy community.
6. If there's a manipulation penalty, mention it as a caution.
7. Be specific with numbers but make them meaningful (e.g., "tripled its weekly star count" not "stars_7d increased 200%").
8. Do NOT start with the repo name — start with the insight.

Respond with only the narrative text, no quotes, no markdown.`
}

async function main(): Promise<void> {
  const [
    { default: Anthropic },
    { createServiceClient },
  ] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('../lib/supabase.js'),
  ])

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const db = createServiceClient()

  log('=== Trend Narrator Agent Starting ===')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const date7dAgo = new Date(today)
  date7dAgo.setDate(today.getDate() - 7)
  const date7dAgoStr = date7dAgo.toISOString().split('T')[0]

  // Step 1: Find the top movers — repos with highest stars_7d in latest snapshots
  log('Finding top movers by 7-day star velocity...')

  const { data: latestSnaps, error: snapErr } = await db
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', todayStr)
    .gt('stars_7d', 0)
    .order('stars_7d', { ascending: false })
    .limit(MAX_NARRATIVES_PER_RUN * 2) // over-fetch to account for missing data

  if (snapErr || !latestSnaps || latestSnaps.length === 0) {
    // Fallback: try yesterday's date
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: fallbackSnaps } = await db
      .from('repo_snapshots')
      .select('repo_id, stars_7d')
      .eq('snapshot_date', yesterdayStr)
      .gt('stars_7d', 0)
      .order('stars_7d', { ascending: false })
      .limit(MAX_NARRATIVES_PER_RUN * 2)

    if (!fallbackSnaps || fallbackSnaps.length === 0) {
      log('No snapshots found for today or yesterday. Exiting.')
      return
    }

    // Use fallback
    return processMovers(db, anthropic, fallbackSnaps as unknown as Array<{ repo_id: string; stars_7d: number }>, date7dAgoStr)
  }

  await processMovers(db, anthropic, latestSnaps as unknown as Array<{ repo_id: string; stars_7d: number }>, date7dAgoStr)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnthropicClient = any

async function processMovers(
  db: DB,
  anthropic: AnthropicClient,
  snaps: Array<{ repo_id: string; stars_7d: number }>,
  date7dAgoStr: string,
): Promise<void> {
  const repoIds = snaps.map((s) => s.repo_id)
  const starsMap = new Map(snaps.map((s) => [s.repo_id, s.stars_7d]))

  // Step 2: Fetch repo data + enrichments for these repos
  const [{ data: repos }, { data: enrichments }] = await Promise.all([
    db.from('repos').select('id, owner, name, description, stars, forks, contributors, language').in('id', repoIds),
    db.from('enrichments').select('repo_id, summary, category, early_signal_score, score_breakdown, trend_narrative').in('repo_id', repoIds),
  ])

  if (!repos || !enrichments) {
    log('Failed to fetch repos or enrichments. Exiting.')
    return
  }

  const typedRepos = repos as unknown as Array<{
    id: string; owner: string; name: string; description: string | null
    stars: number; forks: number; contributors: number; language: string | null
  }>
  const typedEnrichments = enrichments as unknown as Array<{
    repo_id: string; summary: string; category: string
    early_signal_score: number; score_breakdown: ScoreBreakdown | null
    trend_narrative: string | null
  }>

  const repoMap = new Map(typedRepos.map((r) => [r.id, r]))
  const enrichmentMap = new Map(typedEnrichments.map((e) => [e.repo_id, e]))

  // Filter to repos that have enrichments and don't already have a fresh narrative
  const candidates = repoIds.filter((id) => {
    const enrichment = enrichmentMap.get(id)
    if (!enrichment) return false
    // Skip if narrative was generated today (idempotent re-runs)
    if (enrichment.trend_narrative) {
      // We'll still regenerate — narratives should reflect latest data
      // But could add date-based skipping here if needed
    }
    return repoMap.has(id)
  }).slice(0, MAX_NARRATIVES_PER_RUN)

  if (candidates.length === 0) {
    log('No candidates for narrative generation. Exiting.')
    return
  }

  log(`${candidates.length} repos selected for narrative generation`)

  // Step 3: Fetch previous week's snapshots for acceleration context
  const [{ data: snaps7dAgo }, { data: weeklyStats }] = await Promise.all([
    db.from('repo_snapshots')
      .select('repo_id, stars_7d, forks')
      .in('repo_id', candidates)
      .eq('snapshot_date', date7dAgoStr),
    db.from('weekly_stats')
      .select('repo_id, commit_count_4w')
      .in('repo_id', candidates)
      .order('snapshot_date', { ascending: false }),
  ])

  const prev7dMap = new Map(
    ((snaps7dAgo ?? []) as unknown as Array<{ repo_id: string; stars_7d: number; forks: number }>)
      .map((s) => [s.repo_id, s])
  )
  // Deduplicate weekly_stats: first occurrence per repo is latest
  const commitMap = new Map<string, number>()
  for (const row of (weeklyStats ?? []) as unknown as Array<{ repo_id: string; commit_count_4w: number }>) {
    if (!commitMap.has(row.repo_id)) {
      commitMap.set(row.repo_id, row.commit_count_4w)
    }
  }

  // Step 4: Fetch HN mentions for each candidate
  const { getHNMentions } = await import('../lib/hn.js')

  // Step 5: Build TopMover objects and generate narratives
  const limiter = createLimiter(CONCURRENCY)
  let generated = 0

  await Promise.all(
    candidates.map((repoId) =>
      limiter(async () => {
        const repo = repoMap.get(repoId)!
        const enrichment = enrichmentMap.get(repoId)!
        const prev7d = prev7dMap.get(repoId)
        const label = `${repo.owner}/${repo.name}`

        try {
          const hnMentions = await getHNMentions(repo.owner, repo.name)

          const mover: TopMover = {
            repo_id: repoId,
            owner: repo.owner,
            name: repo.name,
            description: repo.description,
            stars: repo.stars,
            forks: repo.forks,
            contributors: repo.contributors,
            language: repo.language,
            summary: enrichment.summary,
            category: enrichment.category,
            score: enrichment.early_signal_score,
            score_breakdown: enrichment.score_breakdown,
            stars_7d: starsMap.get(repoId) ?? 0,
            stars_7d_prev: prev7d?.stars_7d ?? 0,
            forks_current: repo.forks,
            forks_7d_ago: prev7d?.forks ?? repo.forks,
            hn_mentions_7d: hnMentions.mentions_7d,
            hn_mentions_30d: hnMentions.mentions_30d,
            commit_count_4w: commitMap.get(repoId) ?? 0,
          }

          const prompt = buildNarrativePrompt(mover)

          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          })

          const content = message.content[0]
          if (!content || content.type !== 'text') {
            logError(`Unexpected Claude response for ${label}`, new Error('No text content'))
            return
          }

          const narrative = content.text.trim()

          await db
            .from('enrichments')
            .update({ trend_narrative: narrative })
            .eq('repo_id', repoId)

          log(`  ${label} -> narrative generated (${narrative.length} chars)`)
          generated++
        } catch (err) {
          logError(`Failed to generate narrative for ${label}`, err)
        }
      })
    )
  )

  log(`\n=== Trend Narrator Complete ===`)
  log(`Generated: ${generated} narratives`)
}

main().catch((err) => {
  console.error('Trend Narrator failed:', err)
  process.exit(1)
})
