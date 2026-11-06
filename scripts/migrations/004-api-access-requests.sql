-- 004-api-access-requests.sql — run once in the Supabase SQL editor
-- Stores /developers request-access submissions (app/api/api-access/route.ts):
-- who asked for API early access, what they would build, and which tier they
-- are interested in. Read by Kayu in the Supabase dashboard (Table Editor).

CREATE TABLE IF NOT EXISTS api_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  use_case TEXT NOT NULL,
  tier_interest TEXT NOT NULL
);

ALTER TABLE api_access_requests ENABLE ROW LEVEL SECURITY;

-- Insert-only for the anon role; there is deliberately no SELECT policy, so
-- the rows (names, work emails, companies) are never publicly readable.
-- The API route writes via the service role, which bypasses RLS.
CREATE POLICY "anon insert api_access_requests" ON api_access_requests
  FOR INSERT TO anon WITH CHECK (true);
