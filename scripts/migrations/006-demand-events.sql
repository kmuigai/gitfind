-- 006-demand-events.sql — run once in the Supabase SQL editor
-- The Demand Graph (Board Directive 3, Nov 6, 2026): one row per act of
-- visitor intent on gitfind.ai — searches, project clicks, category views,
-- digest clicks — stored in GitFind's own database as a proprietary asset.
-- This is NOT pageview analytics (Vercel Analytics owns that); it is the raw
-- record of what people came looking for, which later answers questions no
-- analytics product can: top unmet searches, trending queries, most-clicked
-- projects per category. Rationale and aggregation plan: docs/demand-graph.md.
--
-- Writers: app/api/events/route.ts only (service role), fed by the client
-- helper in lib/track.ts. Validation mirrors this schema: lib/demand.ts.
--
-- Privacy by construction: no IP addresses, no raw user agents, no emails,
-- no account ids are ever stored. session_hash is a daily-rotating
-- anonymous hash (see lib/track.ts) — it groups one browser's events for
-- one UTC day and deliberately cannot link a person across days.

CREATE TABLE IF NOT EXISTS demand_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'search', 'project_click', 'category_view', 'digest_click'
  )),
  -- For 'search' rows: the raw search string. The query IS the asset —
  -- it is stored verbatim (capped at 200 chars by the API route).
  query TEXT,
  -- Clicked project key ("owner/name") or category slug, by event type.
  target TEXT,
  referrer_page TEXT,
  session_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_demand_events_type_created
  ON demand_events (event_type, created_at DESC);

-- Search rows are the most-queried slice (top queries, unmet-search joins),
-- so they get their own partial index on the query text.
CREATE INDEX IF NOT EXISTS idx_demand_events_search_query
  ON demand_events (query) WHERE event_type = 'search';

ALTER TABLE demand_events ENABLE ROW LEVEL SECURITY;

-- Insert-only for the anon role; there is deliberately no SELECT policy, so
-- demand rows are never publicly readable. The API route writes via the
-- service role, which bypasses RLS; Kayu reads aggregates in the dashboard.
-- Same privacy pattern as api_access_requests (004).
CREATE POLICY "anon insert demand_events" ON demand_events
  FOR INSERT TO anon WITH CHECK (true);
