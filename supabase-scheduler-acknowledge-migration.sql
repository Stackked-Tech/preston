-- Add acknowledgment tracking to construction scheduler tasks
ALTER TABLE cs_tasks ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
