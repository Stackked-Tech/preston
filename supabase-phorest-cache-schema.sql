-- Phorest commission cache table
-- Stores processed commission results as JSONB to avoid repeated API calls

CREATE TABLE IF NOT EXISTS phorest_commission_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_range_key TEXT NOT NULL UNIQUE,
  results JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS (permissive, matching existing app pattern)
ALTER TABLE phorest_commission_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to commission cache"
  ON phorest_commission_cache FOR ALL
  USING (true) WITH CHECK (true);

-- Index for lookups by date range
CREATE INDEX IF NOT EXISTS idx_commission_cache_date_range
  ON phorest_commission_cache (date_range_key);
