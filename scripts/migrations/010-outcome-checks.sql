-- 010-outcome-checks.sql — run once in the Supabase SQL editor
-- Outcomes Ledger Phase 2 backfill (Nov 6, 2026): gate G8 of the
-- product-first program requires the 2025–26 outcome history of the top
-- 1,000 projects (by Early Signal Score) to be provably processed —
-- 1,000 / 1,000, each project carrying an outcome row or a recorded
-- "checked, no outcome" pass. project_outcomes alone cannot prove the
-- negative: a project with no outcome row might mean "nothing happened"
-- or "nobody looked". This table is the audit trail that separates the
-- two — one row per completed pass over one repo for one window.
--
-- Writers: scripts/backfill-outcomes.ts (checker = 'news-sweep-backfill').
-- The runner skips repos that already carry a row for the window, so the
-- backfill is resumable batch by batch; the partial unique index below
-- makes one recorded pass per repo per backfill window hold at the
-- database level too (the same pattern as 005's one-'dead'-per-repo and
-- 009's one-event-per-day indexes). Design: docs/outcomes-ledger.md,
-- "The 2025–26 backfill".

CREATE TABLE IF NOT EXISTS outcome_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  checker TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('outcome_found', 'none_found')),
  outcomes_found INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_outcome_checks_repo_id
  ON outcome_checks (repo_id);
CREATE INDEX IF NOT EXISTS idx_outcome_checks_window
  ON outcome_checks (checker, window_start);

-- A repo's backfill pass for a window is recorded once. A re-run skips it
-- in code; this makes a duplicate recorded pass impossible even if two
-- batches were ever pointed at the same repos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_outcome_checks_one_backfill_pass
  ON outcome_checks (repo_id, window_start)
  WHERE checker = 'news-sweep-backfill';

ALTER TABLE outcome_checks ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policies at all — the same posture as project_outcomes
-- (migration 005). Nothing public ever reads or writes this table: every
-- access goes through the service role, which bypasses RLS. The coverage
-- record is part of the proprietary ledger, not public site data.
