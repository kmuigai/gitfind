-- 005-project-outcomes.sql — run once in the Supabase SQL editor
-- The Outcomes Ledger (Board Directive 2, Nov 6, 2026): one row per real-world
-- event in a tracked project's life — funding, acquisition, shutdown, death,
-- adoption, maintainer moves, breakouts. Outcomes are later joined to the
-- point-in-time score history (repo_snapshots / enrichments) by repo_id +
-- event_date to measure how well the Early Signal Score predicted them.
-- That join is the proprietary asset: anyone can scrape GitHub, but the
-- outcome labels against GitFind's own daily record exist only here.
--
-- Writers: scripts/detect-lifecycle-outcomes.ts (automated lifecycle scan,
-- detected_by = 'lifecycle-scan'), future news sweeps, and manual rows Kayu
-- adds in the Table Editor. Taxonomy: docs/outcomes-ledger.md.

CREATE TABLE IF NOT EXISTS project_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'funding', 'acquired', 'shutdown', 'pivot',
    'adopted', 'maintainer_move', 'breakout', 'dead'
  )),
  event_date DATE NOT NULL,
  source_url TEXT,
  details TEXT,
  confidence TEXT NOT NULL DEFAULT 'likely' CHECK (confidence IN ('confirmed', 'likely')),
  detected_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_outcomes_repo_date
  ON project_outcomes (repo_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_project_outcomes_event_type
  ON project_outcomes (event_type);

-- A repo can only die once. The lifecycle scan skips repos that already have
-- a 'dead' row; this partial unique index makes that guarantee hold at the
-- database level too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_outcomes_one_dead_per_repo
  ON project_outcomes (repo_id) WHERE event_type = 'dead';

ALTER TABLE project_outcomes ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policies at all — not even insert-only. Unlike
-- api_access_requests (004), nothing public ever writes or reads this table:
-- every access goes through the service role, which bypasses RLS. The ledger
-- is a proprietary asset, not public site data; if a UI ever needs it, add a
-- scoped policy then, on purpose.
