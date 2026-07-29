-- 002-model-metrics.sql — run once in the Supabase SQL editor
-- Daily snapshots of open-model metrics for the Open Model Index (/open-model-index)

CREATE TABLE IF NOT EXISTS model_metrics (
  model_key TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  hf_downloads BIGINT NOT NULL DEFAULT 0,   -- cumulative HF weight downloads (0 when no HF repo)
  hf_likes INT NOT NULL DEFAULT 0,
  gh_stars INT NOT NULL DEFAULT 0,
  gh_forks INT NOT NULL DEFAULT 0,
  gh_contributors INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (model_key, snapshot_date)
);

CREATE INDEX IF NOT EXISTS model_metrics_date_idx ON model_metrics (snapshot_date DESC);

ALTER TABLE model_metrics ENABLE ROW LEVEL SECURITY;

-- Public read (the index is public content); writes via service role only.
CREATE POLICY "public read model_metrics" ON model_metrics
  FOR SELECT USING (true);
