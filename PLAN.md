# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Add 4 new compounding data points to GitFind's daily/weekly data collection: open issues (daily, free — already in the API response), contributor count (weekly), commit frequency (weekly), and release cadence (weekly). These create irreplaceable time-series data that strengthens the moat.

## Critical Decisions
- Decision 1: **Open issues goes into snapshot-light.ts** — it's already in the `GET /repos` response we fetch daily, so zero extra API cost. Just store one more field.
- Decision 2: **Contributors, commits, and releases go into a new weekly script** — these each require a separate API call per repo. Running weekly instead of daily keeps API cost manageable (~12K calls/week at 4K repos vs ~84K daily).
- Decision 3: **Add columns to existing `repo_snapshots` table** — no new tables. Open issues lives alongside stars/forks in the daily snapshot. Weekly metrics get their own `snapshot_date` rows (same table, same structure).
- Decision 4: **New `weekly-stats.yml` workflow on Sundays at 08:00 UTC** — separate from daily snapshots to avoid rate limit collisions.

## Tasks

- [ ] 🟥 **Step 1: Add `open_issues` column to `repo_snapshots`**
  - [ ] 🟥 Write the ALTER TABLE SQL: `ALTER TABLE repo_snapshots ADD COLUMN IF NOT EXISTS open_issues INTEGER NOT NULL DEFAULT 0;`
  - [ ] 🟥 Update `supabase-schema.sql` so the column is in the canonical schema file
  - [ ] 🟥 Run the SQL in Supabase SQL Editor (you'll do this manually — I'll give you the exact SQL to paste)

- [ ] 🟥 **Step 2: Update `snapshot-light.ts` to store open issues**
  - [ ] 🟥 Add `open_issues_count` to the response type (it's already in the GitHub API response, we're just ignoring it)
  - [ ] 🟥 Include `open_issues` in the `repo_snapshots` upsert alongside stars/forks
  - [ ] 🟥 Test locally with `npx tsx scripts/snapshot-light.ts` (confirm open_issues appears in snapshot rows)

- [ ] 🟥 **Step 3: Create new `weekly-stats` table**
  - [ ] 🟥 Write CREATE TABLE SQL for `weekly_stats` with columns: `repo_id`, `snapshot_date`, `contributors`, `commit_count_4w` (commits in last 4 weeks), `last_release_date`, `last_release_tag`
  - [ ] 🟥 Add unique constraint on `(repo_id, snapshot_date)` to prevent duplicates
  - [ ] 🟥 Add RLS policy (public read, service role write)
  - [ ] 🟥 Update `supabase-schema.sql` with the new table
  - [ ] 🟥 Run the SQL in Supabase SQL Editor

- [ ] 🟥 **Step 4: Build `scripts/snapshot-weekly.ts`**
  - [ ] 🟥 For each repo, make 3 API calls:
    - `GET /repos/{owner}/{repo}/contributors?per_page=1&anon=true` — read contributor count from response header `Link` last page number (1 API call, avoids paginating)
    - `GET /repos/{owner}/{repo}/stats/commit_activity` — returns 52 weeks of commit counts (1 API call, sum last 4 weeks)
    - `GET /repos/{owner}/{repo}/releases?per_page=1` — latest release date and tag (1 API call)
  - [ ] 🟥 Rate limiter: same pattern as snapshot-light (read `X-RateLimit-Remaining`, sleep when low)
  - [ ] 🟥 Upsert results into `weekly_stats` table
  - [ ] 🟥 Test locally with `npx tsx scripts/snapshot-weekly.ts`

- [ ] 🟥 **Step 5: Create `weekly-stats.yml` GitHub Actions workflow**
  - [ ] 🟥 Cron schedule: `0 8 * * 0` (Sundays 8AM UTC) — avoids collision with daily snapshot at 6AM UTC and pipeline at midnight
  - [ ] 🟥 Runs `npx tsx scripts/snapshot-weekly.ts`
  - [ ] 🟥 Timeout: 180 minutes (3 hours) — 4K repos × 3 calls each = 12K calls at 5K/hour ≈ 2.5 hours
  - [ ] 🟥 Same secrets as snapshot-light workflow

- [ ] 🟥 **Step 6: Update `database.types.ts`**
  - [ ] 🟥 Add `open_issues` to the `repo_snapshots` Row type
  - [ ] 🟥 Add `weekly_stats` table type
  - [ ] 🟥 Run `npm run typecheck` to confirm no type errors

- [ ] 🟥 **Step 7: Verify and commit**
  - [ ] 🟥 Run `npm run typecheck && npm run lint`
  - [ ] 🟥 Commit and push
  - [ ] 🟥 Confirm daily workflow stores open_issues on next run
  - [ ] 🟥 Confirm weekly workflow runs on next Sunday
