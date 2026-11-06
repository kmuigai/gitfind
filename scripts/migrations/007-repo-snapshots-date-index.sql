-- 007-repo-snapshots-date-index.sql — run once in the Supabase SQL editor
-- Fix for Archive Snapshot run #1 (Nov 6, 2026): the export's dated-slice
-- fetch — SELECT * FROM repo_snapshots WHERE snapshot_date = <date> — died
-- with "canceling statement due to statement timeout". The only indexes on
-- the dated fact tables lead with repo_id (repo_snapshots_repo_date_idx is
-- (repo_id, snapshot_date)), so a slice by date alone cannot use them and
-- Postgres scans the whole multi-million-row table — per page, under offset
-- paging. On the Micro instance's cold cache that exceeds the role statement
-- timeout.
--
-- These indexes lead with snapshot_date so one day's slice (and the export's
-- keyset cursor, id > last id within the day) is a direct index range scan.
-- package_downloads and weekly_stats share the same table shape, the same
-- wrong-leading-column index, and the same export query — they get the same
-- index now rather than failing the same way on a later run.
--
-- Plain CREATE INDEX, not CONCURRENTLY: the SQL editor wraps the script in
-- a transaction and CONCURRENTLY is not allowed inside one. A plain build
-- briefly locks each table against writes — these tables are written only
-- by batch pipelines, so run this between pipeline runs (midday UTC is
-- quiet). At current sizes each build takes seconds to a few minutes.

CREATE INDEX IF NOT EXISTS idx_repo_snapshots_snapshot_date
  ON repo_snapshots (snapshot_date, id);

CREATE INDEX IF NOT EXISTS idx_package_downloads_snapshot_date
  ON package_downloads (snapshot_date, id);

CREATE INDEX IF NOT EXISTS idx_weekly_stats_snapshot_date
  ON weekly_stats (snapshot_date, id);
