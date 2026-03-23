-- Cached Looker "Paid to Salon" tips fetched via GitHub Action
-- Used by Payout Suite payroll when Looker can't be reached from Vercel

CREATE TABLE IF NOT EXISTS ps_looker_tips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  staff_name text NOT NULL,
  paid_to_salon numeric(10,2) NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(branch_id, start_date, end_date, staff_name)
);

-- Index for fast lookups by branch + period
CREATE INDEX IF NOT EXISTS idx_ps_looker_tips_lookup
  ON ps_looker_tips(branch_id, start_date, end_date);

-- RLS: permissive (matches other ps/payout suite tables)
ALTER TABLE ps_looker_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ps_looker_tips"
  ON ps_looker_tips FOR ALL
  USING (true)
  WITH CHECK (true);
