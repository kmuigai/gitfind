-- 008-demand-events-created-index.sql — run once in the Supabase SQL editor
-- Support for the archive snapshot's demand_events slice (the table joined
-- the daily archive alongside project_outcomes): the export fetches one UTC
-- day of events as
--   SELECT * FROM demand_events
--   WHERE created_at >= <date> AND created_at < <the next day>
--     AND id > <last id of the previous page>
--   ORDER BY id
-- The table's indexes lead with event_type (idx_demand_events_type_created)
-- or with query text, so a created_at range cannot use them and Postgres
-- scans the whole table — per page, under keyset paging. That is the same
-- wrong-leading-column problem migration 007 fixed for the snapshot_date
-- tables. demand_events is built to become the highest-volume table the
-- archive touches (one row per search, click, and category view), so it
-- gets its (created_at, id) index now, before the slice can grow into the
-- role statement timeout on a busy day.
--
-- Plain CREATE INDEX, not CONCURRENTLY: the SQL editor wraps the script in
-- a transaction and CONCURRENTLY is not allowed inside one. The table is
-- small today (capture began Nov 6, 2026), so the build takes seconds; run
-- it any time.

CREATE INDEX IF NOT EXISTS idx_demand_events_created_id
  ON demand_events (created_at, id);
