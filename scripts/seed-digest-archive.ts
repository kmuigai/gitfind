// One-off: seed the digest archive with the July 15, 2026 issue
// (content recovered from digest-preview.html, the first Tuesday Briefing).
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await db.from('digests').upsert(
    {
      week_date: '2026-07-15',
      subject: 'GitFind Briefing: obra/superpowers (+8,772 stars) and 4 more',
      intro:
        "This week's biggest movers share a common thread: the AI coding wave is maturing fast, and the market is now rewarding tools that solve the second-order problems — not just generating code, but making AI agents reliable, compatible, and trustworthy enough to use in real product work.",
      projects: [
        {
          owner: 'obra', name: 'superpowers', score: 36, stars_7d: 8772, category: 'Developer Tools',
          story:
            'Nearly 9,000 developers starred this project in a single week — a signal that the frustration of AI coding tools going rogue and building the wrong thing has reached a tipping point. Superpowers acts as a behavioral layer on top of tools like Claude and Cursor, forcing them to clarify requirements and get sign-off on a plan before writing a single line of code. For product leaders, this points directly to an emerging market category: AI workflow guardrails that make autonomous coding agents reliable enough to actually trust.',
        },
        {
          owner: 'hesamsheikh', name: 'awesome-openclaw-usecases', score: 37, stars_7d: 8509, category: 'AI / Machine Learning',
          story:
            "This community-built collection of real-world examples for the AI tool OpenClaw racked up over 8,500 new stars — but a notable red flag: it did so two weeks in a row at almost exactly the same number, a pattern that virtually never happens with genuine organic growth. The underlying project activity is modest and there's no meaningful developer discussion on Hacker News, so treat these numbers with healthy skepticism. The real PM takeaway: when evaluating open-source momentum, star counts alone are not the story — engagement, commits, and community conversation are far more telling.",
        },
        {
          owner: 'D4Vinci', name: 'Scrapling', score: 37, stars_7d: 5482, category: 'Developer Tools',
          story:
            "Web data collection has become a quiet competitive advantage across industries — pricing intelligence, market research, lead generation — and Scrapling is emerging as the tool of choice for teams who need it to keep working even when websites change or fight back. It crossed 25,000 total stars this week, backed by 143 commits in the last 30 days, which tells you this is an actively maintained tool meeting real demand. The slight dip in weekly star growth (down about 18% from last week's peak) is worth watching to see whether this becomes a lasting staple or a fading spike.",
        },
        {
          owner: 'AlexsJones', name: 'llmfit', score: 44, stars_7d: 5313, category: 'AI / Machine Learning',
          story:
            'As teams increasingly want to run AI models locally — for cost savings, privacy, or both — the biggest hidden friction is simply not knowing what your hardware can handle, and llmfit solves that in one step by scanning your machine and returning a ranked list of compatible models. It added over 5,300 stars this week at the same pace as last week, signaling genuine sustained word-of-mouth rather than a one-day spike. For product and ops leaders, this is an early indicator that hardware compatibility is quietly becoming its own product category inside the local AI ecosystem.',
        },
        {
          owner: 'anomalyco', name: 'opencode', score: 38, stars_7d: 5057, category: 'Developer Tools',
          story:
            "With over 116,000 total stars and more than 5,000 added just this week, OpenCode is one of the most widely adopted free alternatives to paid AI coding tools like GitHub Copilot — and unlike many viral open-source projects, it's backed by over 1,100 code changes in the past 30 days, meaning the team is actively building, not coasting. For product managers, this represents a real shift in the competitive landscape: shipping software faster is no longer purely a function of headcount.",
        },
      ],
      new_entrants: [
        {
          owner: 'lingdojo', name: 'kana-dojo', score: 64,
          blurb:
            'A free, open-source Japanese learning tool that takes clear design cues from Duolingo — a useful reminder that polished, consumer-grade UX is increasingly an expectation even in the open-source world.',
        },
        {
          owner: 'linuxhsj', name: 'openclaw-zero-token', score: 59,
          blurb:
            'A tool designed to access paid AI services for free by piggybacking on an existing browser login — worth knowing about as a signal of how aggressively users will work around paywalls, and the security implications for product teams.',
        },
      ],
      ai_pulse: null,
    },
    { onConflict: 'week_date' }
  )

  if (error) {
    console.error('seed failed:', error)
    process.exit(1)
  }
  console.log('seeded digest 2026-07-15 ✓')
}

main().catch((e) => { console.error(e); process.exit(1) })
