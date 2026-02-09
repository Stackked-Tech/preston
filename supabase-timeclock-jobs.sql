-- ============================================================
-- R Alexander Time Clock: Jobs Feature Migration
-- ============================================================

-- Jobs table
CREATE TABLE IF NOT EXISTS tc_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add job_id to time entries (nullable for backwards compat)
ALTER TABLE tc_time_entries
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES tc_jobs(id);

-- Enable RLS
ALTER TABLE tc_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all access (matches existing tc_employees/tc_time_entries pattern)
CREATE POLICY "Allow all access to tc_jobs"
  ON tc_jobs FOR ALL
  USING (true)
  WITH CHECK (true);
