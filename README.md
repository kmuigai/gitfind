# GitFind

An open source intelligence directory that surfaces rising GitHub projects with plain-English context.

**Live at [gitfind.ai](https://gitfind.ai)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it does

GitFind tracks thousands of GitHub repositories and scores them using an **Early Signal Score** — a proprietary algorithm that detects genuinely rising projects before they go mainstream. Every project gets an AI-generated summary written in plain English, so you don't need to be a developer to understand what it does or why it matters.

## Key features

- **Early Signal Score** — weighted algorithm combining star velocity, contributor ratios, fork activity, social mentions, and commit frequency
- **Daily snapshots** — stars, forks, and open issues tracked over time for every repo
- **AI enrichment** — Claude-generated plain-English summaries and categorization
- **AI Code Index** — daily commit activity across major AI coding tools (Claude Code, Cursor, Copilot, Aider, Gemini CLI, Devin)

## Tech stack

- **Framework:** Next.js 16, TypeScript, Tailwind CSS v4
- **Database:** PostgreSQL via Supabase (JS client)
- **AI:** Claude API for enrichment
- **Hosting:** Vercel
- **Data:** GitHub Archive, Hacker News, npm/PyPI/crates.io

## Getting started

```bash
git clone https://github.com/nicholaskayu/gitfind-v2.git
cd gitfind-v2
npm install
```

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [`.env.example`](.env.example) for the full list. You need:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GITHUB_TOKEN` | GitHub personal access token for API calls |
| `ANTHROPIC_API_KEY` | Claude API key for AI enrichment |

## Data pipeline

Four GitHub Actions workflows run on staggered schedules:

| Workflow | Schedule | What it does |
|----------|----------|-------------|
| `pipeline.yml` | Midnight UTC daily | Discover new repos via GH Archive + HN, enrich with Claude, score, fetch package downloads |
| `chart-data.yml` | 5 AM UTC daily | AI Code Index — daily commit counts for 6 AI coding tools |
| `snapshot-light.yml` | 6 AM UTC daily | Daily star/fork/open_issues snapshots for all repos |
| `weekly-stats.yml` | 8 AM UTC Sundays | Weekly contributors, commit frequency, release cadence |

## Project structure

```
app/              → Next.js App Router pages and API routes
  ai-code-index/  → AI Code Index page
  category/       → Category browsing
  project/        → Individual project pages
  submit/         → Repo submission form
  api/            → API routes
lib/              → Shared utilities
  queries.ts      → Supabase query helpers
  score.ts        → Early Signal Score algorithm
  supabase.ts     → Supabase client
  enrichment.ts   → Claude enrichment logic
scripts/          → Data pipeline scripts
  pipeline.ts     → Main enrichment + scoring pipeline
  ingest-gharchive.ts → GitHub Archive ingestion
  ingest-hn.ts    → Hacker News ingestion
  search-commits.ts   → AI Code Index data collection
  snapshot-light.ts   → Daily snapshot collection
  snapshot-weekly.ts  → Weekly stats collection
  fetch-downloads.ts  → Package download counts
```

## License

[MIT](LICENSE)
