-- R Alexander Time Clock Schema
-- Run this in the Supabase SQL Editor

-- Employees table
CREATE TABLE tc_employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Time entries table
CREATE TABLE tc_time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES tc_employees(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Settings table
CREATE TABLE tc_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_tc_time_entries_employee_id ON tc_time_entries(employee_id);
CREATE INDEX idx_tc_time_entries_clock_in ON tc_time_entries(clock_in);
CREATE INDEX idx_tc_employees_number ON tc_employees(employee_number);

-- Default settings
INSERT INTO tc_settings (setting_key, setting_value) VALUES
  ('overtime', '{"daily_threshold": 8, "weekly_threshold": 40}'),
  ('location', '{"name": "R Alexander Barn", "lat": null, "lng": null, "radius_meters": null}');

-- Enable RLS
ALTER TABLE tc_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon/authenticated (shared tablet, no per-user auth)
CREATE POLICY "Allow all on tc_employees" ON tc_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tc_time_entries" ON tc_time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tc_settings" ON tc_settings FOR ALL USING (true) WITH CHECK (true);
