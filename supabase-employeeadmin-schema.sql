-- Employee Administration Schema
-- Tables use ea_ prefix

-- Branches (salon locations)
CREATE TABLE ea_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  subsidiary_id INTEGER NOT NULL,
  account INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff (one row per employee per branch)
CREATE TABLE ea_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT NOT NULL REFERENCES ea_branches(branch_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  target_first TEXT NOT NULL,
  target_last TEXT NOT NULL,
  internal_id INTEGER NOT NULL DEFAULT 0,
  station_lease NUMERIC NOT NULL DEFAULT 0,
  financial_services NUMERIC NOT NULL DEFAULT 0,
  phorest_fee NUMERIC NOT NULL DEFAULT 0,
  refreshment NUMERIC NOT NULL DEFAULT 0,
  associate_pay NUMERIC,
  supervisor TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, display_name)
);

-- Name overrides (Phorest name -> staff display_name mapping)
CREATE TABLE ea_name_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT NOT NULL REFERENCES ea_branches(branch_id) ON DELETE CASCADE,
  phorest_name TEXT NOT NULL,
  staff_display_name TEXT NOT NULL,
  UNIQUE (branch_id, phorest_name)
);

-- Enable RLS (permissive, matching project pattern)
ALTER TABLE ea_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ea_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE ea_name_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on ea_branches" ON ea_branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ea_staff" ON ea_staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ea_name_overrides" ON ea_name_overrides FOR ALL USING (true) WITH CHECK (true);
