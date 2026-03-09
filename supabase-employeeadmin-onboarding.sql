-- Employee Onboarding Enhancement Migration
-- Adds status, auth linkage, and onboarding columns to ea_staff
-- Adds trigger on sts_recipients to auto-activate employees on signing

-- 1. Add status column with check constraint (default 'active' for existing rows)
ALTER TABLE ea_staff
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'onboarding', 'inactive', 'terminated'));

-- 2. Add Supabase Auth linkage
ALTER TABLE ea_staff
  ADD COLUMN IF NOT EXISTS supabase_auth_uid UUID;

-- 3. Add onboarding template reference
ALTER TABLE ea_staff
  ADD COLUMN IF NOT EXISTS onboarding_template_id UUID;

-- 4. Add onboarding envelope reference
ALTER TABLE ea_staff
  ADD COLUMN IF NOT EXISTS onboarding_envelope_id UUID;

-- 5. Add signing token (copied from sts_recipients.access_token)
ALTER TABLE ea_staff
  ADD COLUMN IF NOT EXISTS onboarding_signing_token UUID;

-- 6. Index on supabase_auth_uid for fast lookups
CREATE INDEX IF NOT EXISTS idx_ea_staff_auth_uid ON ea_staff(supabase_auth_uid);

-- 7. Index on onboarding_envelope_id for trigger lookups
CREATE INDEX IF NOT EXISTS idx_ea_staff_onboarding_envelope ON ea_staff(onboarding_envelope_id);

-- 8. Trigger function: when sts_recipients.status changes to 'signed',
--    look up ea_staff by onboarding_envelope_id and set status = 'active'
CREATE OR REPLACE FUNCTION fn_on_signing_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN
    UPDATE ea_staff
    SET status = 'active'
    WHERE onboarding_envelope_id = NEW.envelope_id
      AND status = 'onboarding';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger on sts_recipients
DROP TRIGGER IF EXISTS trg_on_signing_complete ON sts_recipients;
CREATE TRIGGER trg_on_signing_complete
  AFTER UPDATE ON sts_recipients
  FOR EACH ROW
  EXECUTE FUNCTION fn_on_signing_complete();
