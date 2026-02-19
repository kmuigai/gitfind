-- GitFind Database Schema
-- Run this in your Supabase project: SQL Editor → paste → Run
-- After running, you should see 5 tables in your Table Editor.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  description TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  contributors INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  category TEXT NOT NULL,
  early_signal_score INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  commit_count INTEGER NOT NULL DEFAULT 0,
  month TEXT NOT NULL, -- format: '2025-06'
  UNIQUE (repo_id, tool_name, month)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Full-text search on repo name and description
CREATE INDEX IF NOT EXISTS repos_fts_idx
  ON repos USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Fast score lookups and category filtering
CREATE INDEX IF NOT EXISTS enrichments_score_idx ON enrichments(early_signal_score DESC);
CREATE INDEX IF NOT EXISTS enrichments_repo_id_idx ON enrichments(repo_id);
CREATE INDEX IF NOT EXISTS enrichments_category_idx ON enrichments(category);

-- Tool contribution aggregation
CREATE INDEX IF NOT EXISTS tool_contributions_tool_month_idx ON tool_contributions(tool_name, month);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS repos_updated_at ON repos;
CREATE TRIGGER repos_updated_at
  BEFORE UPDATE ON repos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED CATEGORIES
-- ============================================================

INSERT INTO categories (name, slug, description) VALUES
  ('AI / Machine Learning', 'ai-ml', 'Artificial intelligence, machine learning, LLMs, and neural networks'),
  ('Developer Tools', 'developer-tools', 'Tools, utilities, and frameworks for software developers'),
  ('Security', 'security', 'Cybersecurity, cryptography, and privacy tools'),
  ('Data & Analytics', 'data-analytics', 'Data science, analytics, databases, and visualization'),
  ('Web Frameworks', 'web-frameworks', 'Frontend and backend web development frameworks'),
  ('Infrastructure & DevOps', 'infrastructure-devops', 'Cloud infrastructure, containers, and DevOps tools'),
  ('Mobile', 'mobile', 'iOS, Android, and cross-platform mobile development'),
  ('Open Source Utilities', 'open-source-utilities', 'General-purpose utilities and productivity tools')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS — anon key can read, service role key can write
-- ============================================================

ALTER TABLE repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_contributions ENABLE ROW LEVEL SECURITY;

-- Public read access for directory data
CREATE POLICY "Public can read repos" ON repos FOR SELECT USING (true);
CREATE POLICY "Public can read enrichments" ON enrichments FOR SELECT USING (true);
CREATE POLICY "Public can read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public can read tool_contributions" ON tool_contributions FOR SELECT USING (true);

-- No public write access — pipeline uses service role key (bypasses RLS)
-- Newsletter signup writes via API route using service role key
-- Submissions write via API route using service role key
