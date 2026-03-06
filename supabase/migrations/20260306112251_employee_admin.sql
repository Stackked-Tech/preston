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
-- ═══════════════════════════════════════════════════════════════════════════════
-- Employee Admin — Seed Data
-- Migrated from src/lib/payrollConfig.ts
-- 5 branches, 126 staff members, 2 name overrides
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_branches (5 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_branches (branch_id, name, abbreviation, subsidiary_id, account, display_order) VALUES
  ('MQxU0-XtU5feIqq2iWBVgw', 'William Henry Salon Mount Holly', 'WHS MH', 5, 111, 1),
  ('8M4TophXdPSUruaequULaw', 'William Henry Salon McAdenville', 'WHS MCAD', 6, 111, 2),
  ('5xgjrXAIiFwmt0XheOoHng', 'William Henry Signature Salon Belmont', 'WHS BEL', 5, 111, 3),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'William Henry The Spa', 'WHS SPA', 5, 111, 4),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Ballards Barbershop', 'BALLARDS', 7, 111, 5);

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_staff — Mount Holly (23 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_staff (branch_id, display_name, target_first, target_last, internal_id, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, is_active, sort_order) VALUES
  ('MQxU0-XtU5feIqq2iWBVgw', 'Danielle Baker', 'Danielle', 'Seeger Baker', 1736, -390, -100, -10, -10, NULL, NULL, true, 0),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Gabby Brewer', 'Gabby', 'Brewer', 3072, 0, 0, 0, 0, NULL, NULL, true, 1),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Emma Davis', 'Emma', 'Baldwin-Davis', 1738, -336, -100, -10, -10, NULL, NULL, true, 2),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Addison Brown', 'Addison', 'Brown', 3071, 0, -100, -10, -10, NULL, 'Seth King', true, 3),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Grace Deason', 'Grace', 'Deason', 1743, -336, -100, -10, -10, NULL, NULL, true, 4),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Molly Diaz', 'Molly', 'Diaz', 1758, -336, -100, -10, -10, NULL, NULL, true, 5),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Ashleigh Dotson', 'Ashleigh', 'Dotson', 1726, -390, -100, -10, -10, NULL, NULL, true, 6),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Kristen Forehand', 'Kristen', 'Forehand', 1752, -238, -100, -10, -10, NULL, NULL, true, 7),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Aubrey Hawkins', 'Aubrey', 'Hawkins', 2667, -25, -50, -5, -5, NULL, NULL, true, 8),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Jess Herzog', 'Jess', 'Herzog', 2296, -336, -100, -10, -10, NULL, NULL, true, 9),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Kaylie Houghtaling', 'Kaylie', 'Houghtaling', 1751, -336, -100, -10, -10, NULL, NULL, true, 10),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Seth King', 'Seth ', 'King', 1771, -336, -100, -10, -10, NULL, NULL, true, 11),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Grace Lesser', 'Grace', 'Lesser', 3074, 0, 0, 0, 0, NULL, NULL, true, 12),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Cassi Mcclure', 'Cassi', 'McClure', 1731, -390, -100, -10, -10, NULL, NULL, true, 13),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Brooke Parker', 'Brooke', 'Parker', 2671, -320, -100, -10, -10, NULL, NULL, true, 14),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Keleigh Ratliff', 'Keleigh', 'Ratliff', 1635, 0, 0, 0, 0, NULL, NULL, true, 15),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Torey Rome', 'Torey', 'Rome', 1775, -390, -100, -10, -10, NULL, NULL, true, 16),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Maddie Schultz', 'Maddie', 'Schultz', 3073, 0, 0, 0, 0, NULL, NULL, true, 17),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Sierra Sharpe', 'Sierra', 'Sharpe', 3077, 0, -50, -5, -5, NULL, 'Kristen Forehand', true, 18),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Dana Siepert', 'Dana', 'Siepert', 2295, -336, -100, -10, -10, NULL, NULL, true, 19),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Lauren Simonds', 'Lauren', 'Simonds', 1754, -336, -100, -10, -10, NULL, NULL, true, 20),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Aubrey White', 'Aubrey', 'White', 2670, -320, -100, -10, -10, NULL, NULL, true, 21),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Olivia Wilson', 'Olivia', 'Cornette Wilson', 1765, -390, -100, -10, -10, NULL, NULL, true, 22);

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_staff — McAdenville (26 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_staff (branch_id, display_name, target_first, target_last, internal_id, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, is_active, sort_order) VALUES
  ('8M4TophXdPSUruaequULaw', 'Kenya Bagwell', 'Kenya', 'Bagwell', 1861, -780, -100, -10, -10, NULL, NULL, true, 0),
  ('8M4TophXdPSUruaequULaw', 'Chloey Bailey', 'Chloey', 'Bailey', 1834, -336, -100, -10, -10, NULL, NULL, true, 1),
  ('8M4TophXdPSUruaequULaw', 'Sarah Bowen', 'Sarah', 'Roper-Bowen', 1827, -336, -100, -10, -10, NULL, NULL, true, 2),
  ('8M4TophXdPSUruaequULaw', 'Sariana Braggs', 'Sariana', 'Braggs', 2905, 0, 0, 0, 0, NULL, NULL, true, 3),
  ('8M4TophXdPSUruaequULaw', 'Brianna Cope', 'Brianna', 'Cope', 2294, -336, -100, -10, -10, NULL, NULL, true, 4),
  ('8M4TophXdPSUruaequULaw', 'Kate Dixon', 'Kate', 'Dixon', 1859, -336, -100, -10, -10, NULL, NULL, true, 5),
  ('8M4TophXdPSUruaequULaw', 'Emily English', 'Emily', 'English', 1841, -390, -100, -10, -10, NULL, NULL, true, 6),
  ('8M4TophXdPSUruaequULaw', 'Hannah Fleming', 'Hannah', 'Fleming (Rudisill)', 2863, -200, -100, -10, -10, NULL, NULL, true, 7),
  ('8M4TophXdPSUruaequULaw', 'Savannah Gohr', 'Savannah', 'Mercer Gohr', 1886, -336, -100, -10, -10, NULL, 'Kenya Bagwell', true, 8),
  ('8M4TophXdPSUruaequULaw', 'Kiersten Hacker', 'Kiersten', 'Hacker', 1863, -300, 0, 0, 0, NULL, NULL, true, 9),
  ('8M4TophXdPSUruaequULaw', 'Kendall Johnson', 'Kendall', 'Johnson', 3076, 0, 0, 0, 0, NULL, NULL, true, 10),
  ('8M4TophXdPSUruaequULaw', 'Leah Mace', 'Leah', 'Young Mace', 1865, -336, -100, -10, -10, NULL, NULL, true, 11),
  ('8M4TophXdPSUruaequULaw', 'April McElwaine', 'April', 'McElwaine', 1826, -336, -100, -10, -10, NULL, NULL, true, 12),
  ('8M4TophXdPSUruaequULaw', 'Kerry Minando', 'Kerry', 'Minando', 2423, -390, -100, -10, -10, NULL, NULL, true, 13),
  ('8M4TophXdPSUruaequULaw', 'Nadia Moore', 'Nadia', 'Moore', 2906, -200, -100, -10, -10, NULL, NULL, true, 14),
  ('8M4TophXdPSUruaequULaw', 'Ashley Mull', 'Ashley', 'Mull', 2505, -336, -80, -7, -5, NULL, NULL, true, 15),
  ('8M4TophXdPSUruaequULaw', 'Makenna Murphy', 'Makenna', 'Murphy', 2907, -200, -100, -10, -10, NULL, NULL, true, 16),
  ('8M4TophXdPSUruaequULaw', 'Stephanie Norris', 'Stephanie', 'Norris', 1891, -200, 0, 0, 0, NULL, NULL, true, 17),
  ('8M4TophXdPSUruaequULaw', 'Ciara Petty', 'Ciara', 'Petty', 2931, 0, -100, -10, -10, NULL, 'Emily English', true, 18),
  ('8M4TophXdPSUruaequULaw', 'Jessica Pitts', 'Jessica', 'Pitts', 1857, -336, -100, -10, -10, NULL, NULL, true, 19),
  ('8M4TophXdPSUruaequULaw', 'Sarah Rathbone', 'Sarah', 'Brookshire (Rathbone)', 1885, -336, -100, -10, -10, NULL, NULL, true, 20),
  ('8M4TophXdPSUruaequULaw', 'Dayna Simmons', 'Dayna', 'Simmons', 1838, -336, -100, -10, -10, NULL, NULL, true, 21),
  ('8M4TophXdPSUruaequULaw', 'Kendall Meek', 'Kendall', 'Meek', 0, 0, 0, 0, 0, NULL, NULL, true, 22),
  ('8M4TophXdPSUruaequULaw', 'Kristen Forehand', 'Kristen', 'Forehand', 0, 0, 0, 0, 0, NULL, NULL, true, 23),
  ('8M4TophXdPSUruaequULaw', 'Patience Pearson', 'Patience', 'Pearson', 0, 0, 0, 0, 0, NULL, NULL, true, 24),
  ('8M4TophXdPSUruaequULaw', 'Somer Wilson', 'Somer', 'Wilson', 0, 0, 0, 0, 0, NULL, NULL, true, 25);

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_staff — Belmont (43 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_staff (branch_id, display_name, target_first, target_last, internal_id, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, is_active, sort_order) VALUES
  ('5xgjrXAIiFwmt0XheOoHng', 'Alicia West', 'Alicia', 'West', 0, 0, 0, 0, 0, NULL, NULL, true, 0),
  ('5xgjrXAIiFwmt0XheOoHng', 'Allana Taylor', 'Allana', 'Taylor', 0, 0, 0, 0, 0, NULL, NULL, true, 1),
  ('5xgjrXAIiFwmt0XheOoHng', 'AnnaMae Baranowski', 'AnnaMae', 'Baranowski', 0, 0, 0, 0, 0, NULL, NULL, true, 2),
  ('5xgjrXAIiFwmt0XheOoHng', 'Ariel Leatherwood', 'Ariel', 'Leatherwood', 0, 0, 0, 0, 0, NULL, NULL, true, 3),
  ('5xgjrXAIiFwmt0XheOoHng', 'Aubrey Ballenger', 'Aubrey', 'Ballenger', 0, 0, 0, 0, 0, NULL, NULL, true, 4),
  ('5xgjrXAIiFwmt0XheOoHng', 'Brenda Sanchez', 'Brenda', 'Sanchez', 0, 0, 0, 0, 0, NULL, NULL, true, 5),
  ('5xgjrXAIiFwmt0XheOoHng', 'Cameryn Stansell', 'Cameryn', 'Stansell', 0, 0, 0, 0, 0, NULL, NULL, true, 6),
  ('5xgjrXAIiFwmt0XheOoHng', 'Candy Zepeda', 'Candy', 'Zepeda', 0, 0, 0, 0, 0, NULL, NULL, true, 7),
  ('5xgjrXAIiFwmt0XheOoHng', 'Cecy Sanchez', 'Cecy', 'Sanchez', 0, 0, 0, 0, 0, NULL, NULL, true, 8),
  ('5xgjrXAIiFwmt0XheOoHng', 'Ellie Flowers', 'Ellie', 'Flowers', 0, 0, 0, 0, 0, NULL, NULL, true, 9),
  ('5xgjrXAIiFwmt0XheOoHng', 'Emily Herrin', 'Emily', 'Herrin', 0, 0, 0, 0, 0, NULL, NULL, true, 10),
  ('5xgjrXAIiFwmt0XheOoHng', 'Emily Rinehart', 'Emily', 'Rinehart', 0, 0, 0, 0, 0, NULL, NULL, true, 11),
  ('5xgjrXAIiFwmt0XheOoHng', 'Erica Coombs', 'Erica', 'Coombs', 0, 0, 0, 0, 0, NULL, NULL, true, 12),
  ('5xgjrXAIiFwmt0XheOoHng', 'Gabby Brewer', 'Gabby', 'Brewer', 0, 0, 0, 0, 0, NULL, NULL, true, 13),
  ('5xgjrXAIiFwmt0XheOoHng', 'Grace Lesser', 'Grace', 'Lesser', 0, 0, 0, 0, 0, NULL, NULL, true, 14),
  ('5xgjrXAIiFwmt0XheOoHng', 'Jennifer Davis', 'Jennifer', 'Davis', 0, 0, 0, 0, 0, NULL, NULL, true, 15),
  ('5xgjrXAIiFwmt0XheOoHng', 'Jordan Kovacs', 'Jordan', 'Kovacs', 0, 0, 0, 0, 0, NULL, NULL, true, 16),
  ('5xgjrXAIiFwmt0XheOoHng', 'Julia Arnold', 'Julia', 'Arnold', 0, 0, 0, 0, 0, NULL, NULL, true, 17),
  ('5xgjrXAIiFwmt0XheOoHng', 'Julie Owen', 'Julie', 'Owen', 0, 0, 0, 0, 0, NULL, NULL, true, 18),
  ('5xgjrXAIiFwmt0XheOoHng', 'Kayla Harris', 'Kayla', 'Harris', 0, 0, 0, 0, 0, NULL, NULL, true, 19),
  ('5xgjrXAIiFwmt0XheOoHng', 'Kendall Hunt', 'Kendall', 'Hunt', 0, 0, 0, 0, 0, NULL, NULL, true, 20),
  ('5xgjrXAIiFwmt0XheOoHng', 'Kendall Johnson', 'Kendall', 'Johnson', 0, 0, 0, 0, 0, NULL, NULL, true, 21),
  ('5xgjrXAIiFwmt0XheOoHng', 'Kendall Meek', 'Kendall', 'Meek', 0, 0, 0, 0, 0, NULL, NULL, true, 22),
  ('5xgjrXAIiFwmt0XheOoHng', 'Kristen Forehand', 'Kristen', 'Forehand', 0, 0, 0, 0, 0, NULL, NULL, true, 23),
  ('5xgjrXAIiFwmt0XheOoHng', 'Lauren Eagle', 'Lauren', 'Eagle', 0, 0, 0, 0, 0, NULL, NULL, true, 24),
  ('5xgjrXAIiFwmt0XheOoHng', 'Lera Cline', 'Lera', 'Cline', 0, 0, 0, 0, 0, NULL, NULL, true, 25),
  ('5xgjrXAIiFwmt0XheOoHng', 'Lexy Sides', 'Lexy', 'Sides', 0, 0, 0, 0, 0, NULL, NULL, true, 26),
  ('5xgjrXAIiFwmt0XheOoHng', 'Lindsey Mackey Price', 'Lindsey', 'Mackey Price', 0, 0, 0, 0, 0, NULL, NULL, true, 27),
  ('5xgjrXAIiFwmt0XheOoHng', 'Maddie Schultz', 'Maddie', 'Schultz', 0, 0, 0, 0, 0, NULL, NULL, true, 28),
  ('5xgjrXAIiFwmt0XheOoHng', 'Makenna Murphy', 'Makenna', 'Murphy', 0, 0, 0, 0, 0, NULL, NULL, true, 29),
  ('5xgjrXAIiFwmt0XheOoHng', 'Mariah Wilson', 'Mariah', 'Wilson', 0, 0, 0, 0, 0, NULL, NULL, true, 30),
  ('5xgjrXAIiFwmt0XheOoHng', 'Melissa Petty', 'Melissa', 'Petty', 0, 0, 0, 0, 0, NULL, NULL, true, 31),
  ('5xgjrXAIiFwmt0XheOoHng', 'Nadia Moore', 'Nadia', 'Moore', 0, 0, 0, 0, 0, NULL, NULL, true, 32),
  ('5xgjrXAIiFwmt0XheOoHng', 'Nadya Bradshaw', 'Nadya', 'Bradshaw', 0, 0, 0, 0, 0, NULL, NULL, true, 33),
  ('5xgjrXAIiFwmt0XheOoHng', 'Patience Pearson', 'Patience', 'Pearson', 0, 0, 0, 0, 0, NULL, NULL, true, 34),
  ('5xgjrXAIiFwmt0XheOoHng', 'Sam Dancer', 'Sam', 'Dancer', 0, 0, 0, 0, 0, NULL, NULL, true, 35),
  ('5xgjrXAIiFwmt0XheOoHng', 'Sariana Braggs', 'Sariana', 'Braggs', 0, 0, 0, 0, 0, NULL, NULL, true, 36),
  ('5xgjrXAIiFwmt0XheOoHng', 'Shyanne Dutcher', 'Shyanne', 'Dutcher', 0, 0, 0, 0, 0, NULL, NULL, true, 37),
  ('5xgjrXAIiFwmt0XheOoHng', 'Sierra Hanafin', 'Sierra', 'Hanafin', 0, 0, 0, 0, 0, NULL, NULL, true, 38),
  ('5xgjrXAIiFwmt0XheOoHng', 'Somer Wilson', 'Somer', 'Wilson', 0, 0, 0, 0, 0, NULL, NULL, true, 39),
  ('5xgjrXAIiFwmt0XheOoHng', 'Stacey Rollins', 'Stacey', 'Rollins', 0, 0, 0, 0, 0, NULL, NULL, true, 40),
  ('5xgjrXAIiFwmt0XheOoHng', 'Sydney Key', 'Sydney', 'Key', 0, 0, 0, 0, 0, NULL, NULL, true, 41),
  ('5xgjrXAIiFwmt0XheOoHng', 'Virginia Hellams', 'Virginia', 'Hellams', 0, 0, 0, 0, 0, NULL, NULL, true, 42);

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_staff — The Spa (20 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_staff (branch_id, display_name, target_first, target_last, internal_id, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, is_active, sort_order) VALUES
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'AnnaMae Baranowski', 'AnnaMae', 'Baranowski', 0, 0, 0, 0, 0, NULL, NULL, true, 0),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Brittany Wilson', 'Brittany', 'Wilson', 0, 0, 0, 0, 0, NULL, NULL, true, 1),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Kalla Schull', 'Kalla', 'Schull', 0, 0, 0, 0, 0, NULL, NULL, true, 2),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Keleigh Ratliff', 'Keleigh', 'Ratliff', 0, 0, 0, 0, 0, NULL, NULL, true, 3),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Kelsey Romero', 'Kelsey', 'Romero', 0, 0, 0, 0, 0, NULL, NULL, true, 4),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Kendall Meek', 'Kendall', 'Meek', 0, 0, 0, 0, 0, NULL, NULL, true, 5),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Kristen Forehand', 'Kristen', 'Forehand', 0, 0, 0, 0, 0, NULL, NULL, true, 6),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Lindsay Holvig', 'Lindsay', 'Holvig', 0, 0, 0, 0, 0, NULL, NULL, true, 7),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Marco Schlemm', 'Marco', 'Schlemm', 0, 0, 0, 0, 0, NULL, NULL, true, 8),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Marla Walls', 'Marla', 'Walls', 0, 0, 0, 0, 0, NULL, NULL, true, 9),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Marolys Gil', 'Marolys', 'Gil', 0, 0, 0, 0, 0, NULL, NULL, true, 10),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Megan O''Shields', 'Megan', 'O''Shields', 0, 0, 0, 0, 0, NULL, NULL, true, 11),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Michelle Frazier', 'Michelle', 'Frazier', 0, 0, 0, 0, 0, NULL, NULL, true, 12),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Naomi Fretz', 'Naomi', 'Fretz', 0, 0, 0, 0, 0, NULL, NULL, true, 13),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Patience Pearson', 'Patience', 'Pearson', 0, 0, 0, 0, 0, NULL, NULL, true, 14),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Peter Koronios', 'Peter', 'Koronios', 0, 0, 0, 0, 0, NULL, NULL, true, 15),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Sadi Benford', 'Sadi', 'Benford', 0, 0, 0, 0, 0, NULL, NULL, true, 16),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Sierra Sharpe', 'Sierra', 'Sharpe', 0, 0, 0, 0, 0, NULL, NULL, true, 17),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Somer Wilson', 'Somer', 'Wilson', 0, 0, 0, 0, 0, NULL, NULL, true, 18),
  ('Sil3zmgt4KE4RYWqWnx-hQ', 'Stephanie Gee', 'Stephanie', 'Gee', 0, 0, 0, 0, 0, NULL, NULL, true, 19);

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_staff — Ballards (14 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_staff (branch_id, display_name, target_first, target_last, internal_id, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, is_active, sort_order) VALUES
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Bryan Walls', 'Bryan', 'Walls', 2293, -320, -100, -10, -10, NULL, NULL, true, 0),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Dustin G Goodson', 'Dustin', 'Goodson', 2484, -380, -100, -10, -10, NULL, NULL, true, 1),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Dustin H Helms', 'Dustin', 'Helms', 1536, -320, -100, -10, -10, NULL, NULL, true, 2),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Dustin P Prince', 'Dustin', 'Prince', 1535, -320, -100, -10, -10, NULL, NULL, true, 3),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Edward Trevino', 'Edward', 'Trevino', 1537, -320, -100, -10, -10, NULL, NULL, true, 4),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Hannah Fleming', 'Hannah', 'Fleming', 0, 0, 0, 0, 0, NULL, NULL, true, 5),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Kendall Meek', 'Kendall', 'Meek', 0, 0, 0, 0, 0, NULL, NULL, true, 6),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Kristen Forehand', 'Kristen', 'Forehand', 0, 0, 0, 0, 0, NULL, NULL, true, 7),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Owen Prince', 'Owen', 'Prince', 1550, -320, -100, -10, -10, NULL, NULL, true, 8),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Patience Pearson', 'Patience', 'Pearson', 0, 0, 0, 0, 0, NULL, NULL, true, 9),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Ray Goodson', 'Ray', 'Goodson', 1553, -320, -100, -10, -10, NULL, NULL, true, 10),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Rob Bumgardner', 'Rob', 'Bumgardner', 1531, -320, -100, -10, -10, NULL, NULL, true, 11),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Somer Wilson', 'Somer', 'Wilson', 0, 0, 0, 0, 0, NULL, NULL, true, 12),
  ('yrr4_ACmrRVr0J3NoC2s2Q', 'Thomas Moore', 'Thomas', 'Moore', 2805, -320, -100, -10, -10, NULL, NULL, true, 13);

-- ─────────────────────────────────────────────────────────────────────────────
-- ea_name_overrides — Mount Holly (2 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ea_name_overrides (branch_id, phorest_name, staff_display_name) VALUES
  ('MQxU0-XtU5feIqq2iWBVgw', 'Olivia Cornette', 'Olivia Wilson'),
  ('MQxU0-XtU5feIqq2iWBVgw', 'Maddie Shultz', 'Maddie Schultz');
