# GitFind Architecture

> Open source intelligence directory that surfaces rising GitHub projects with plain-English context.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions (4 workflows)                │
│  pipeline.yml │ chart-data.yml │ snapshot-light │ weekly-stats  │
└──────┬────────┴───────┬────────┴───────┬───────┴───────┬───────┘
       │                │                │               │
       ▼                ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase (PostgreSQL)                    │
│  repos │ enrichments │ repo_snapshots │ weekly_stats │ …        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App (Vercel)                      │
│  Server Components → lib/queries.ts → Supabase JS client       │
│  API Routes: /api/search, /api/newsletter, /api/submit, …      │
│  Client Components: charts, search, forms                      │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
app/                        # Next.js App Router pages
  page.tsx                  # Homepage — top repos, category grid
  ai-code-index/page.tsx    # AI Code Index dashboard
  insights/page.tsx         # Insights & analysis
  submit/page.tsx           # Community repo submission
  api/                      # API routes
    search/route.ts         # Full-text repo search
    newsletter/route.ts     # Resend email subscription
    submit/route.ts         # Repo submission handler
    ai-code-index/route.ts  # AI Code Index data endpoint

components/                 # Shared React components
  TerminalNav.tsx           # Navigation bar + status indicators
  Ticker.tsx                # GIT_FEED stock-ticker banner
  ProjectCard.tsx           # Repo card with score, stats, category
  SearchBar.tsx             # Command-style search input
  AICodeIndexDashboard.tsx  # Full AI Code Index control panel
  AICodeIndexChart.tsx      # Recharts line chart for commit data
  MarketShareChart.tsx      # Tool market share visualization
  NewsletterSignup.tsx      # Email signup form
  SubmitForm.tsx            # Repo submission form

lib/                        # Core business logic
  queries.ts                # Typed Supabase query helpers
  score.ts                  # Early Signal Score algorithm
  supabase.ts               # Supabase client (anon + service role)
  database.types.ts         # Hand-crafted DB types
  enrichment.ts             # Claude API enrichment logic
  github.ts                 # GitHub API helpers
  hn.ts                     # Hacker News API helpers

scripts/                    # Data pipeline scripts (run via GitHub Actions)
  pipeline.ts               # Main orchestrator: ingest → enrich → score
  ingest-gharchive.ts       # Discover repos from GH Archive events
  ingest-hn.ts              # Discover repos mentioned on HN
  search-commits.ts         # AI Code Index — daily commit counts
  snapshot-light.ts         # Daily star/fork/issue snapshots
  snapshot-weekly.ts        # Weekly contributor/commit/release stats
  fetch-downloads.ts        # npm/PyPI/crates.io download counts
  send-digest.ts            # Weekly email digest via Resend
```

## Data Pipeline

Four GitHub Actions workflows ingest data on staggered schedules:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `pipeline.yml` | Midnight UTC | Discover repos (GH Archive + HN), enrich with Claude, score |
| `chart-data.yml` | 5 AM UTC | AI Code Index commit counts (fills T-2 to avoid index lag) |
| `snapshot-light.yml` | 6 AM UTC | Daily star/fork/open_issues snapshots |
| `weekly-stats.yml` | Sun 8 AM UTC | Weekly contributors, commit frequency, releases |

### Pipeline Flow

```
GH Archive events ─┐
                    ├─→ repos table ─→ Claude enrichment ─→ enrichments table
HN front page ─────┘                                         (score, summary,
                                                               category, etc.)
```

## Database Schema (Key Tables)

- **repos** — All tracked repositories (~5K). Source of truth for GitHub metadata.
- **enrichments** — Claude-generated: summary, one-liner, category, early_signal_score.
- **repo_snapshots** — Daily time-series: stars, forks, stars_7d, open_issues.
- **weekly_stats** — Weekly time-series: contributors, commit_count_4w, releases.
- **tool_contributions** — AI Code Index: daily commit counts per tool (7 tools).
- **package_downloads** — npm/PyPI/crates.io download snapshots.
- **subscribers** — Newsletter email list.
- **submissions** — Community-submitted repos.

Full schema: `supabase-schema.sql`

## Early Signal Score

Proprietary ranking algorithm in `lib/score.ts`. Weights:

| Signal | Weight |
|--------|--------|
| Star velocity (7-day) | 25% |
| Contributor-to-star ratio | 20% |
| Cross-platform mentions | 15% |
| Fork velocity / stars | 10% |
| Commit frequency (30-day) | 10% |
| Star acceleration | 10% |
| Fork acceleration | 10% |
| Manipulation filter | Penalty |

## Query Layer

`lib/queries.ts` provides typed helpers over the Supabase JS client. Key pattern:

```typescript
const { data } = await supabase.from('enrichments').select('*')
const typed = data as unknown as Enrichment[]  // Required cast for supabase-js v2.96+
```

**Important constraint:** Supabase PostgREST caps responses at 1000 rows. Any query that could exceed this must paginate with `.range(offset, offset+999)` in a while loop.

## Observability

- **Sentry** — Error monitoring (client, server, edge). Config in `sentry.*.config.ts`.
- **Vercel Analytics** — Page views and web vitals.
- **CI** — GitHub Actions: typecheck + lint + build on every PR (`.github/workflows/ci.yml`).
- **Pre-commit** — Husky + lint-staged: typecheck + ESLint on staged `.ts/.tsx` files.

## External Services

| Service | Purpose | Key env var |
|---------|---------|-------------|
| Supabase | Database + auth | `NEXT_PUBLIC_SUPABASE_URL` |
| GitHub API | Repo metadata, commits | `GITHUB_TOKEN` / `GITFIND_GITHUB_TOKEN` |
| Claude API | AI enrichment | `ANTHROPIC_API_KEY` |
| Resend | Email newsletters | `RESEND_API_KEY` |
| Sentry | Error monitoring | `NEXT_PUBLIC_SENTRY_DSN` |
| Vercel | Hosting + deploys | (managed) |
