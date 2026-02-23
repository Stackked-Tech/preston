-- ============================================================
-- Time Clock Overhaul Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Companies table
CREATE TABLE IF NOT EXISTS tc_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE tc_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tc_companies" ON tc_companies
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Add company_id + billable_rate to tc_employees
ALTER TABLE tc_employees
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES tc_companies(id),
  ADD COLUMN IF NOT EXISTS billable_rate DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tc_employees_company_id ON tc_employees(company_id);

-- 3. Add company_id to tc_jobs
ALTER TABLE tc_jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES tc_companies(id);

CREATE INDEX IF NOT EXISTS idx_tc_jobs_company_id ON tc_jobs(company_id);

-- 4. Add approval fields to tc_time_entries
ALTER TABLE tc_time_entries
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flag_note TEXT;

CREATE INDEX IF NOT EXISTS idx_tc_time_entries_approval ON tc_time_entries(approval_status);
