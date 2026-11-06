-- 003-indexable-score-index.sql — run once in the Supabase SQL editor
-- Supports the E1 indexable-set fetch (lib/queries.ts getIndexableProjects):
-- it reads enrichments best-first by Early Signal Score with a bounded
-- LIMIT, and without an index Postgres has to sort the whole table (joined
-- with repos) to find the top rows — that sort is what hit the statement
-- timeout (57014) during the /sitemap.xml build prerender. With this index
-- the planner can walk scores in order and stop once the window is filled.
-- NULLS LAST matches the query/gate ranking (a missing score ranks below
-- every real score). CONCURRENTLY builds it without locking writes; it
-- cannot run inside a transaction block, which is fine for the SQL editor.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrichments_early_signal_score
  ON enrichments (early_signal_score DESC NULLS LAST);
