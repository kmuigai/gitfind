-- 009-project-outcomes-news-dedupe.sql — run once in the Supabase SQL editor
-- Outcomes Ledger Phase 2 (Nov 6, 2026): the news sweep
-- (scripts/detect-news-outcomes.ts) writes the seven non-'dead' event
-- types. The same real-world event is routinely covered by several
-- outlets; a (repo, event type, event date) triple is one event, and the
-- ledger should hold it once. The sweep dedupes on that key in code
-- before inserting — this partial unique index makes the guarantee hold
-- at the database level too, mirroring migration 005's
-- one-'dead'-per-repo index for the lifecycle scan.
--
-- 'dead' is excluded: 005's stricter one-per-repo index already governs
-- it, and an event_date-scoped rule would be wrong there.
--
-- Apply before the first scheduled --write news sweep. Until then the
-- sweep behaves identically on its code-level dedupe alone.

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_outcomes_one_event_per_day
  ON project_outcomes (repo_id, event_type, event_date)
  WHERE event_type <> 'dead';
