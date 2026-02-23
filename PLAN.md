# Feature Implementation Plan

**Overall Progress:** `100%`

## TLDR
Add 4 new compounding data points to GitFind's daily/weekly data collection: open issues (daily, free — already in the API response), contributor count (weekly), commit frequency (weekly), and release cadence (weekly). These create irreplaceable time-series data that strengthens the moat.

## Critical Decisions
- Decision 1: **Open issues goes into snapshot-light.ts** — it's already in the `GET /repos` response we fetch daily, so zero extra API cost. Just store one more field.
- Decision 2: **Contributors, commits, and releases go into a new weekly script** — these each require a separate API call per repo. Running weekly instead of daily keeps API cost manageable (~12K calls/week at 4K repos vs ~84K daily).
- Decision 3: **Add `open_issues` column to existing `repo_snapshots` table, new `weekly_stats` table for weekly metrics** — keeps daily and weekly data cleanly separated.
- Decision 4: **New `weekly-stats.yml` workflow on Sundays at 08:00 UTC** — separate from daily snapshots to avoid rate limit collisions.

## Tasks

- [x] 🟩 **Step 1: Add `open_issues` column to `repo_snapshots`**
  - [x] 🟩 ALTER TABLE SQL written and run in Supabase
  - [x] 🟩 `supabase-schema.sql` updated

- [x] 🟩 **Step 2: Update `snapshot-light.ts` to store open issues**
  - [x] 🟩 Added `open_issues_count` to response type
  - [x] 🟩 Included `open_issues` in upsert
  - [x] 🟩 Tested locally — confirmed open_issues stored (e.g. 33,090 for top repo)

- [x] 🟩 **Step 3: Create `weekly_stats` table**
  - [x] 🟩 CREATE TABLE with contributors, commit_count_4w, last_release_date, last_release_tag
  - [x] 🟩 Unique constraint on (repo_id, snapshot_date)
  - [x] 🟩 RLS policy added, index added
  - [x] 🟩 SQL run in Supabase

- [x] 🟩 **Step 4: Build `scripts/snapshot-weekly.ts`**
  - [x] 🟩 3 API calls per repo: contributors (Link header trick), commit_activity (4-week sum), releases
  - [x] 🟩 Rate limiter with sleep-until-reset pattern
  - [x] 🟩 Upserts into weekly_stats table
  - [x] 🟩 Tested locally — 2,989 rows written successfully

- [x] 🟩 **Step 5: Create `weekly-stats.yml` GitHub Actions workflow**
  - [x] 🟩 Cron: `0 8 * * 0` (Sundays 8AM UTC)
  - [x] 🟩 180-minute timeout
  - [x] 🟩 Same secrets as snapshot-light

- [x] 🟩 **Step 6: Update `database.types.ts`**
  - [x] 🟩 Added `open_issues` to repo_snapshots types
  - [x] 🟩 Added `weekly_stats` table type with WeeklyStat export
  - [x] 🟩 Typecheck passes clean

- [x] 🟩 **Step 7: Verify and commit**
  - [x] 🟩 `npm run typecheck` clean
  - [x] 🟩 Committed and pushed
  - [x] 🟩 Daily workflow will store open_issues on next 6AM UTC run
  - [x] 🟩 Weekly workflow will run on next Sunday 8AM UTC
