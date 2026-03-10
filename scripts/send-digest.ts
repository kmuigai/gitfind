// Weekly Digest Agent — "The Tuesday Briefing"
// Autonomous agent that generates and sends a curated weekly email digest.
// Runs every Tuesday at 9AM UTC. Claude analyzes the week's top movers,
// new entrants, and notable trends, then Resend delivers to all subscribers.
//
// Run locally: npx tsx scripts/send-digest.ts
// Dry run:    npx tsx scripts/send-digest.ts --dry-run
// Run weekly: GitHub Actions cron (see .github/workflows/digest.yml)
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY

import { config } from 'dotenv'
config({ path: '.env.local' })

const MAX_FEATURED_REPOS = 5
const MAX_NEW_ENTRANTS = 3
const DRY_RUN = process.argv.includes('--dry-run')

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

interface DigestRepo {
  owner: string
  name: string
  summary: string
  why_it_matters: string
  category: string
  score: number
  stars: number
  stars_7d: number
  trend_narrative: string | null
}

interface AgentPRStat {
  tool: string
  prs: number
}

interface HNBuzzStat {
  tool: string
  mentions: number
  points: number
}

interface DigestData {
  topMovers: DigestRepo[]
  newEntrants: DigestRepo[]
  weekDate: string
  agentPRs: AgentPRStat[]
  hnBuzz: HNBuzzStat[]
  totalAICommits: number | null
}

function buildDigestPrompt(data: DigestData): string {
  const moversSection = data.topMovers
    .map((r, i) => `${i + 1}. ${r.owner}/${r.name} (Score: ${r.score}, +${r.stars_7d.toLocaleString()} stars this week, ${r.category})
   What it does: ${r.summary}
   Why it matters: ${r.why_it_matters}${r.trend_narrative ? `\n   Trend context: ${r.trend_narrative}` : ''}`)
    .join('\n\n')

  const entrantsSection = data.newEntrants.length > 0
    ? data.newEntrants
        .map((r) => `- ${r.owner}/${r.name} (Score: ${r.score}, ${r.stars.toLocaleString()} stars, ${r.category})
   ${r.summary}`)
        .join('\n\n')
    : 'No notable new entrants this week.'

  const agentSection = data.agentPRs.length > 0
    ? `\nAI AGENT ACTIVITY (PRs created autonomously yesterday):\n${data.agentPRs.map((a) => `- ${a.tool}: ${a.prs.toLocaleString()} PRs`).join('\n')}`
    : ''

  const hnSection = data.hnBuzz.filter((h) => h.mentions > 0).length > 0
    ? `\nHACKER NEWS BUZZ (last 7 days):\n${data.hnBuzz.filter((h) => h.mentions > 0).map((h) => `- ${h.tool}: ${h.mentions} stories, ${h.points.toLocaleString()} points`).join('\n')}`
    : ''

  const commitNote = data.totalAICommits !== null
    ? `\nTotal AI-authored commits yesterday: ${data.totalAICommits.toLocaleString()}`
    : ''

  return `You are writing "The Tuesday Briefing" for GitFind — a weekly email digest for builders who want to know what's happening in open source and AI coding tools.

Week of: ${data.weekDate}

TOP MOVERS THIS WEEK:
${moversSection}

NEW ON THE RADAR:
${entrantsSection}
${agentSection}
${hnSection}
${commitNote}

Write the email body as a JSON object with these fields:
- "intro": Your 2-3 sentence theme summary that weaves together the top movers AND the AI coding tool landscape (plain text, no HTML)
- "projects": An array of objects, one per top mover, each with:
    - "owner": repo owner (string)
    - "name": repo name (string)
    - "story": 2-3 sentence narrative about why it's moving and why a PM should care (plain text). Use the trend context if available.
- "new_entrants": An array of objects, one per new entrant, each with:
    - "owner": repo owner (string)
    - "name": repo name (string)
    - "blurb": 1 sentence description (plain text)
- "ai_pulse": A 1-2 sentence observation about what the AI agent PR data and HN buzz tell us about the AI coding tools landscape this week (plain text). If no data, set to null.

Rules:
1. Write for builders — founders, PMs, and technical decision-makers. No developer jargon.
2. The intro should identify a pattern across the top movers — what theme connects them this week? Reference the AI coding landscape if relevant.
3. Each story should tell WHY it's moving and why a builder should care. Don't just repeat stats.
4. Be specific with numbers but make them meaningful (e.g., "tripled" not "+200%").
5. Do NOT include HTML in any field — plain text only.

Respond with only valid JSON, no markdown fences, no extra text.`
}

function buildSubjectLine(data: DigestData): string {
  const topMover = data.topMovers[0]
  if (topMover) {
    return `GitFind Briefing: ${topMover.owner}/${topMover.name} (+${topMover.stars_7d.toLocaleString()} stars) and ${data.topMovers.length - 1} more`
  }
  return `GitFind Tuesday Briefing — ${data.weekDate}`
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildEmailHtml(
  digest: {
    intro: string
    projects: Array<{ owner: string; name: string; story: string }>
    new_entrants: Array<{ owner: string; name: string; blurb: string }>
    ai_pulse: string | null
  },
  data: DigestData,
): string {
  const moverLookup = new Map(data.topMovers.map((m) => [`${m.owner}/${m.name}`, m]))
  const entrantLookup = new Map(data.newEntrants.map((e) => [`${e.owner}/${e.name}`, e]))

  const projectCards = digest.projects.map((p) => {
    const repo = moverLookup.get(`${p.owner}/${p.name}`)
    const score = repo?.score ?? 0
    const stars7d = repo?.stars_7d ?? 0
    const category = repo?.category ?? ''

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td style="background:#14141c;border:1px solid #1e1e2e;border-radius:10px;padding:20px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
          <tr>
            <td>
              <a href="https://gitfind.ai/project/${p.owner}/${p.name}" style="font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:16px;font-weight:600;color:#6c6af6;text-decoration:none;letter-spacing:-0.3px;">${esc(p.owner)}/${esc(p.name)}</a>
            </td>
            <td style="text-align:right;white-space:nowrap;">
              <span style="display:inline-block;background:#1a1a3a;color:#6c6af6;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">${score}</span>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px 0;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:11px;color:#4a4a6a;">
          +${stars7d.toLocaleString()} stars &middot; ${esc(category)}
        </p>
        <p style="margin:0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#7a7a9a;">
          ${esc(p.story)}
        </p>
      </td>
    </tr>
  </table>`
  }).join('\n\n  ')

  const entrantCards = digest.new_entrants.map((e) => {
    const repo = entrantLookup.get(`${e.owner}/${e.name}`)
    const score = repo?.score ?? 0

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
    <tr>
      <td style="background:#14141c;border:1px solid #1e1e2e;border-radius:10px;padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
          <tr>
            <td>
              <a href="https://gitfind.ai/project/${e.owner}/${e.name}" style="font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;color:#6c6af6;text-decoration:none;">${esc(e.owner)}/${esc(e.name)}</a>
            </td>
            <td style="text-align:right;white-space:nowrap;">
              <span style="display:inline-block;background:#1a1a3a;color:#6c6af6;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;">${score}</span>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;color:#7a7a9a;">
          ${esc(e.blurb)}
        </p>
      </td>
    </tr>
  </table>`
  }).join('\n\n  ')

  return `<div style="max-width:600px;margin:0 auto;">

  <!-- Header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
    <tr>
      <td style="padding:24px 0;border-bottom:1px solid #1e1e2e;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:36px;height:36px;background:#14141c;border-radius:8px;text-align:center;vertical-align:middle;font-family:monospace;font-size:22px;font-weight:bold;color:#c4b5fd;border:1px solid #1e1e2e;">&#10095;</td>
            <td style="padding-left:12px;">
              <span style="font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:16px;font-weight:600;color:#e8e8f0;letter-spacing:-0.3px;">gitfind.ai</span><br>
              <span style="font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#4a4a6a;">The Tuesday Briefing</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Intro -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:0 0 28px 0;">
        <p style="margin:0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.65;color:#e8e8f0;">
          ${esc(digest.intro)}
        </p>
      </td>
    </tr>
  </table>

  <!-- Section: Top Movers -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:20px 0 16px 0;border-top:1px solid #1e1e2e;">
        <p style="margin:0;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#4a4a6a;font-weight:500;">Top movers this week</p>
      </td>
    </tr>
  </table>

  ${projectCards}

  <!-- Section: New on the Radar -->
  ${digest.new_entrants.length > 0 ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:20px 0 16px 0;border-top:1px solid #1e1e2e;">
        <p style="margin:0;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#4a4a6a;font-weight:500;">New on the radar</p>
      </td>
    </tr>
  </table>

  ${entrantCards}` : ''}

  <!-- Section: AI Pulse -->
  ${digest.ai_pulse ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:20px 0 16px 0;border-top:1px solid #1e1e2e;">
        <p style="margin:0;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#4a4a6a;font-weight:500;">AI Code Pulse</p>
      </td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
    <tr>
      <td style="background:#14141c;border:1px solid #1e1e2e;border-left:3px solid #6c6af6;border-radius:10px;padding:16px 20px;">
        <p style="margin:0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#7a7a9a;">
          ${esc(digest.ai_pulse)}
        </p>
      </td>
    </tr>
  </table>` : ''}

  <!-- Footer -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:28px 0 0 0;border-top:1px solid #1e1e2e;text-align:center;">
        <p style="margin:0 0 6px 0;font-family:'Geist Mono',SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#4a4a6a;">
          Git Signal &middot; Git Context &middot; Git Clarity &middot; <span style="color:#7a7a9a;font-weight:600;">Git Smarter</span>
        </p>
        <p style="margin:0;font-family:'Geist',system-ui,-apple-system,sans-serif;font-size:13px;color:#4a4a6a;">
          <a href="https://gitfind.ai" style="color:#6c6af6;text-decoration:none;">gitfind.ai</a>
        </p>
      </td>
    </tr>
  </table>

</div>`
}

async function main(): Promise<void> {
  const [
    { default: Anthropic },
    { createServiceClient },
  ] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('../lib/supabase.js'),
  ])

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const db = createServiceClient()

  log('=== Tuesday Briefing Agent Starting ===')

  // Step 1: Get the latest snapshot date
  const { data: latestRow } = await db
    .from('repo_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (!latestRow || latestRow.length === 0) {
    log('No snapshots found. Exiting.')
    return
  }

  const latestDate = (latestRow[0] as unknown as { snapshot_date: string }).snapshot_date

  // Step 2: Get top movers by stars_7d
  const { data: topSnaps } = await db
    .from('repo_snapshots')
    .select('repo_id, stars_7d')
    .eq('snapshot_date', latestDate)
    .gt('stars_7d', 0)
    .order('stars_7d', { ascending: false })
    .limit(MAX_FEATURED_REPOS * 2)

  if (!topSnaps || topSnaps.length === 0) {
    log('No trending repos found. Exiting.')
    return
  }

  const typedSnaps = topSnaps as unknown as Array<{ repo_id: string; stars_7d: number }>
  const topRepoIds = typedSnaps.map((s) => s.repo_id)


  // Step 3: Fetch repo + enrichment data for top movers
  const [{ data: repos }, { data: enrichments }] = await Promise.all([
    db.from('repos').select('id, owner, name, stars').in('id', topRepoIds),
    db.from('enrichments').select('repo_id, summary, why_it_matters, category, early_signal_score, trend_narrative').in('repo_id', topRepoIds),
  ])

  if (!repos || !enrichments) {
    log('Failed to fetch repo data. Exiting.')
    return
  }

  const typedRepos = repos as unknown as Array<{ id: string; owner: string; name: string; stars: number }>
  const typedEnrichments = enrichments as unknown as Array<{
    repo_id: string; summary: string; why_it_matters: string; category: string
    early_signal_score: number; trend_narrative: string | null
  }>

  const repoMap = new Map(typedRepos.map((r) => [r.id, r]))
  const enrichmentMap = new Map(typedEnrichments.map((e) => [e.repo_id, e]))

  // Build top movers list
  const topMovers: DigestRepo[] = []
  for (const snap of typedSnaps) {
    if (topMovers.length >= MAX_FEATURED_REPOS) break
    const repo = repoMap.get(snap.repo_id)
    const enrichment = enrichmentMap.get(snap.repo_id)
    if (!repo || !enrichment) continue
    topMovers.push({
      owner: repo.owner,
      name: repo.name,
      summary: enrichment.summary,
      why_it_matters: enrichment.why_it_matters,
      category: enrichment.category,
      score: enrichment.early_signal_score,
      stars: repo.stars,
      stars_7d: snap.stars_7d,
      trend_narrative: enrichment.trend_narrative,
    })
  }

  if (topMovers.length === 0) {
    log('No enriched top movers found. Exiting.')
    return
  }

  log(`Found ${topMovers.length} top movers`)

  // Step 4: Find new entrants (recently enriched repos with decent scores)
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const { data: newEnrichments } = await db
    .from('enrichments')
    .select('repo_id, summary, why_it_matters, category, early_signal_score, scored_at, trend_narrative')
    .gte('scored_at', oneWeekAgo.toISOString())
    .order('early_signal_score', { ascending: false })
    .limit(MAX_NEW_ENTRANTS * 3)

  const newEntrants: DigestRepo[] = []
  if (newEnrichments) {
    const newTyped = newEnrichments as unknown as Array<{
      repo_id: string; summary: string; why_it_matters: string; category: string
      early_signal_score: number; trend_narrative: string | null
    }>

    // Exclude repos already in top movers
    const topMoverIds = new Set(topRepoIds)
    const newRepoIds = newTyped
      .filter((e) => !topMoverIds.has(e.repo_id))
      .slice(0, MAX_NEW_ENTRANTS)
      .map((e) => e.repo_id)

    if (newRepoIds.length > 0) {
      const { data: newRepos } = await db
        .from('repos')
        .select('id, owner, name, stars')
        .in('id', newRepoIds)

      if (newRepos) {
        const newRepoMap = new Map(
          (newRepos as unknown as Array<{ id: string; owner: string; name: string; stars: number }>)
            .map((r) => [r.id, r])
        )

        for (const e of newTyped) {
          if (newEntrants.length >= MAX_NEW_ENTRANTS) break
          if (topMoverIds.has(e.repo_id)) continue
          const repo = newRepoMap.get(e.repo_id)
          if (!repo) continue
          newEntrants.push({
            owner: repo.owner,
            name: repo.name,
            summary: e.summary,
            why_it_matters: e.why_it_matters,
            category: e.category,
            score: e.early_signal_score,
            stars: repo.stars,
            stars_7d: 0,
            trend_narrative: e.trend_narrative,
          })
        }
      }
    }
  }

  log(`Found ${newEntrants.length} new entrants`)

  // Step 4b: Fetch AI Code Index signals (agent PRs, HN buzz, aggregate commits)
  const placeholderRepo = await db
    .from('repos')
    .select('id')
    .eq('owner', '_gitfind')
    .eq('name', '_bigquery_aggregate')
    .maybeSingle()

  const agentPRs: AgentPRStat[] = []
  const hnBuzz: HNBuzzStat[] = []
  let totalAICommits: number | null = null

  if (placeholderRepo.data) {
    const phId = (placeholderRepo.data as unknown as { id: string }).id

    // Agent PRs
    const { data: prRows } = await db
      .from('tool_contributions')
      .select('tool_name, commit_count')
      .eq('repo_id', phId)
      .like('tool_name', '%[pr]')
      .order('month', { ascending: false })
      .limit(20)

    if (prRows) {
      const seen = new Set<string>()
      for (const row of prRows as unknown as Array<{ tool_name: string; commit_count: number }>) {
        const tool = row.tool_name.replace(' [pr]', '')
        if (!seen.has(tool)) {
          seen.add(tool)
          agentPRs.push({ tool, prs: row.commit_count })
        }
      }
    }

    // HN Buzz
    const { data: hnRows } = await db
      .from('tool_contributions')
      .select('tool_name, commit_count')
      .eq('repo_id', phId)
      .or('tool_name.like.%[hn-buzz],tool_name.like.%[hn-points]')
      .order('month', { ascending: false })
      .limit(40)

    if (hnRows) {
      const buzzMap = new Map<string, number>()
      const pointsMap = new Map<string, number>()
      for (const row of hnRows as unknown as Array<{ tool_name: string; commit_count: number }>) {
        if (row.tool_name.endsWith('[hn-buzz]')) {
          const tool = row.tool_name.replace(' [hn-buzz]', '')
          if (!buzzMap.has(tool)) buzzMap.set(tool, row.commit_count)
        } else if (row.tool_name.endsWith('[hn-points]')) {
          const tool = row.tool_name.replace(' [hn-points]', '')
          if (!pointsMap.has(tool)) pointsMap.set(tool, row.commit_count)
        }
      }
      for (const tool of new Set([...buzzMap.keys(), ...pointsMap.keys()])) {
        hnBuzz.push({ tool, mentions: buzzMap.get(tool) ?? 0, points: pointsMap.get(tool) ?? 0 })
      }
    }

    // Aggregate commits
    const { data: aggRow } = await db
      .from('tool_contributions')
      .select('commit_count')
      .eq('repo_id', phId)
      .eq('tool_name', 'All Tools [commit-aggregate]')
      .order('month', { ascending: false })
      .limit(1)

    if (aggRow && aggRow.length > 0) {
      totalAICommits = (aggRow[0] as unknown as { commit_count: number }).commit_count
    }
  }

  log(`AI signals: ${agentPRs.length} agent bots, ${hnBuzz.filter((h) => h.mentions > 0).length} tools with HN buzz`)

  // Step 5: Generate digest with Claude
  const weekDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const digestData: DigestData = { topMovers, newEntrants, weekDate, agentPRs, hnBuzz, totalAICommits }

  log('Generating digest with Claude...')
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildDigestPrompt(digestData) }],
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    log('Claude returned unexpected response. Exiting.')
    return
  }

  const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const digest = JSON.parse(cleaned) as {
    intro: string
    projects: Array<{ owner: string; name: string; story: string }>
    new_entrants: Array<{ owner: string; name: string; blurb: string }>
    ai_pulse: string | null
  }

  const htmlBody = buildEmailHtml(digest, digestData)
  const subject = buildSubjectLine(digestData)
  log(`Subject: ${subject}`)
  log(`HTML body: ${htmlBody.length} chars`)

  if (DRY_RUN) {
    log('\n--- DRY RUN — email preview below ---\n')
    console.log(`Subject: ${subject}\n`)
    console.log(htmlBody)
    log('\n--- DRY RUN complete — no emails sent ---')
    return
  }

  // Step 6: Fetch all subscribers
  const allSubscribers: string[] = []
  let offset = 0
  const PAGE_SIZE = 1000

  while (true) {
    const { data: batch } = await db
      .from('subscribers')
      .select('email')
      .range(offset, offset + PAGE_SIZE - 1)

    if (!batch || batch.length === 0) break
    const typedBatch = batch as unknown as Array<{ email: string }>
    allSubscribers.push(...typedBatch.map((r) => r.email))
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  if (allSubscribers.length === 0) {
    log('No subscribers found. Exiting.')
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  log(`Sending to ${allSubscribers.length} subscribers...`)

  // Step 7: Send via Resend (batch, max 100 per call)
  const BATCH_SIZE = 100
  let sent = 0
  let failed = 0

  for (let i = 0; i < allSubscribers.length; i += BATCH_SIZE) {
    const batch = allSubscribers.slice(i, i + BATCH_SIZE)

    try {
      await resend.batch.send(
        batch.map((email) => ({
          from: 'GitFind <briefing@gitfind.ai>',
          to: email,
          subject,
          html: htmlBody,
        }))
      )
      sent += batch.length
      log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} sent`)
    } catch (err) {
      failed += batch.length
      logError(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed`, err)
    }
  }

  log(`\n=== Tuesday Briefing Complete ===`)
  log(`Sent: ${sent} | Failed: ${failed} | Total subscribers: ${allSubscribers.length}`)
}

main().catch((err) => {
  console.error('Tuesday Briefing failed:', err)
  process.exit(1)
})
