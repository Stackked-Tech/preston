-- Add email column to ea_staff for Employee Portal auth linking
ALTER TABLE ea_staff ADD COLUMN email TEXT;
CREATE INDEX idx_ea_staff_email ON ea_staff(email);
