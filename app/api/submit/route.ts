import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getContributorCount, getCommitFrequency, getStarVelocity } from '@/lib/github'
import { getHNMentions } from '@/lib/hn'
import { calculateScore } from '@/lib/score'

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

  // Try to score the repo
  let score = 0
  let autoApproved = false

  try {
    // Fetch basic repo info via GitHub search (by owner/repo name)
    const repoInfo = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitFind/1.0',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    })

    if (repoInfo.ok) {
      const repoData = (await repoInfo.json()) as {
        id: number
        stargazers_count: number
        forks_count: number
      }

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

      // Auto-approve if Early Signal Score >= 60
      if (score >= 60) {
        autoApproved = true
        await db
          .from('submissions')
          .update({ status: 'approved' })
          .eq('id', submission.id)
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

// SQL to create the submissions table (run in Supabase SQL editor):
//
// CREATE TABLE IF NOT EXISTS submissions (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   repo_url TEXT NOT NULL,
//   email TEXT NOT NULL,
//   note TEXT,
//   status TEXT NOT NULL DEFAULT 'pending',
//   submitted_at TIMESTAMPTZ DEFAULT now()
// );
