-- 001-digests.sql — run once in the Supabase SQL editor
-- Stores each Tuesday Briefing issue for the public archive at /insights/briefing

CREATE TABLE IF NOT EXISTS digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_date DATE UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  intro TEXT NOT NULL,
  projects JSONB NOT NULL DEFAULT '[]',      -- [{ owner, name, story, score, stars_7d, category }]
  new_entrants JSONB NOT NULL DEFAULT '[]',  -- [{ owner, name, blurb, score }]
  ai_pulse TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digests_week_date_idx ON digests (week_date DESC);

ALTER TABLE digests ENABLE ROW LEVEL SECURITY;

-- Public read (the archive is public content); writes via service role only.
CREATE POLICY "public read digests" ON digests
  FOR SELECT USING (true);
