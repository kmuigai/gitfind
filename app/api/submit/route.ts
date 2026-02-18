import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getContributorCount, getCommitFrequency, getStarVelocity } from '@/lib/github'
import { getHNMentions } from '@/lib/hn'
import { calculateScore } from '@/lib/score'
import { enrichRepo } from '@/lib/enrichment'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'github.com') return null
    const parts = parsed.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
  } catch {
    return null
  }
}

interface GitHubRepoResponse {
  id: number
  name: string
  owner: { login: string }
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  html_url: string
  pushed_at: string
  created_at: string
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

  const { repo_url, email, note } = body as Record<string, unknown>

  const repoUrl = typeof repo_url === 'string' ? repo_url.trim() : ''
  const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const noteStr = typeof note === 'string' ? note.trim() : null

  if (!repoUrl) {
    return NextResponse.json({ error: 'GitHub repository URL is required' }, { status: 400 })
  }
  if (!emailStr || !isValidEmail(emailStr)) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const parsed = parseGitHubUrl(repoUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'Please provide a valid GitHub repository URL (e.g. https://github.com/owner/repo)' }, { status: 400 })
  }

  const { owner, repo } = parsed

  const db = createServiceClient()

  // Store the submission first
  const { data: submission, error: submitError } = await db
    .from('submissions')
    .insert({
      repo_url: repoUrl,
      email: emailStr,
      note: noteStr,
      status: 'pending',
    })
    .select('id')
    .single()

  if (submitError || !submission) {
    console.error('Submission insert error:', submitError)
    return NextResponse.json({ error: 'Failed to save submission. Please try again.' }, { status: 500 })
  }

  // Try to score and potentially add the repo to the directory
  let score = 0
  let autoApproved = false

  try {
    const repoInfo = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitFind/1.0',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    })

    if (repoInfo.ok) {
      const repoData = (await repoInfo.json()) as GitHubRepoResponse

      const [starVelocity, contributors, commits, hnMentions] = await Promise.all([
        getStarVelocity(owner, repo, repoData.stargazers_count),
        getContributorCount(owner, repo),
        getCommitFrequency(owner, repo),
        getHNMentions(owner, repo),
      ])

      const result = calculateScore({
        stars: repoData.stargazers_count,
        stars_7d: starVelocity.stars_7d,
        stars_30d: starVelocity.stars_30d,
        contributors,
        forks: repoData.forks_count,
        hn_mentions_7d: hnMentions.mentions_7d,
        hn_mentions_30d: hnMentions.mentions_30d,
        commits_30d: commits,
      })

      score = result.score

      // Auto-approve if Early Signal Score >= 60: add to directory
      if (score >= 60) {
        autoApproved = true

        // Mark submission approved
        await db
          .from('submissions')
          .update({ status: 'approved' })
          .eq('id', submission.id)

        // Upsert the repo into the directory
        const { data: upsertedRepo, error: repoError } = await db
          .from('repos')
          .upsert(
            {
              github_id: repoData.id,
              name: repoData.name,
              owner: repoData.owner.login,
              description: repoData.description,
              stars: repoData.stargazers_count,
              forks: repoData.forks_count,
              contributors,
              language: repoData.language,
              url: repoData.html_url,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'github_id' }
          )
          .select('id')
          .single()

        // Enrich with Claude so summary appears in the directory immediately
        if (!repoError && upsertedRepo) {
          await enrichRepo(
            upsertedRepo.id,
            {
              github_id: repoData.id,
              name: repoData.name,
              owner: repoData.owner.login,
              description: repoData.description,
              stars: repoData.stargazers_count,
              forks: repoData.forks_count,
              contributors,
              language: repoData.language,
            },
            score,
            true // force refresh — brand new submission
          )
        }
      }
    }
  } catch (err) {
    console.error('Error scoring submitted repo:', err)
    // Score stays 0, status stays pending — we'll review manually
  }

  return NextResponse.json({
    success: true,
    submission_id: submission.id,
    score,
    auto_approved: autoApproved,
    message: autoApproved
      ? `Great news — ${owner}/${repo} scored ${score}/100 and has been automatically added to the directory.`
      : `Thanks for submitting ${owner}/${repo}. We'll review it and be in touch at ${emailStr} about listing options.`,
  }, { status: 201 })
}
