-- ═══════════════════════════════════════════════════
-- Hospitality Maintenance — Property Maintenance Request & Task System
-- Tables use hm_ prefix
-- ═══════════════════════════════════════════════════

-- ───────────────────────────────────────────────────
-- Configuration Tables
-- ───────────────────────────────────────────────────

-- Properties
CREATE TABLE hm_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  notes TEXT,
  qr_code_id UUID UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requester types (who submitted the request)
CREATE TABLE hm_requester_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Categories (maintenance categories)
CREATE TABLE hm_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Users (managers and staff)
CREATE TABLE hm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('manager', 'staff')),
  password_hash TEXT NOT NULL,
  must_reset_password BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-property assignments (many-to-many)
CREATE TABLE hm_user_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES hm_users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  UNIQUE(user_id, property_id)
);

-- ───────────────────────────────────────────────────
-- Request Tables
-- ───────────────────────────────────────────────────

-- Maintenance requests (submitted via QR code form)
CREATE TABLE hm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  requester_type_id UUID NOT NULL REFERENCES hm_requester_types(id),
  contact_phone TEXT,
  category_id UUID NOT NULL REFERENCES hm_categories(id),
  description TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  manager_notes TEXT,
  reviewed_by UUID REFERENCES hm_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos attached to requests
CREATE TABLE hm_request_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES hm_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────
-- Task Tables
-- ───────────────────────────────────────────────────

-- Recurring task definitions
CREATE TABLE hm_recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  category_id UUID REFERENCES hm_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_due_date DATE NOT NULL,
  assigned_to UUID REFERENCES hm_users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (created from requests, recurring tasks, or ad-hoc)
CREATE TABLE hm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES hm_requests(id) ON DELETE SET NULL,
  recurring_task_id UUID REFERENCES hm_recurring_tasks(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  assigned_to UUID REFERENCES hm_users(id),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'on_hold', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes on tasks
CREATE TABLE hm_task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES hm_users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos on tasks (before/during/after)
CREATE TABLE hm_task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES hm_users(id),
  storage_path TEXT NOT NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before', 'during', 'after')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time logs on tasks
CREATE TABLE hm_task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES hm_users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT
);

-- Materials used on tasks
CREATE TABLE hm_task_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL,
  cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────
-- Indexes
-- ───────────────────────────────────────────────────

CREATE INDEX idx_hm_requests_property ON hm_requests(property_id);
CREATE INDEX idx_hm_requests_status ON hm_requests(status);
CREATE INDEX idx_hm_tasks_status ON hm_tasks(status);
CREATE INDEX idx_hm_tasks_assigned ON hm_tasks(assigned_to);
CREATE INDEX idx_hm_tasks_property ON hm_tasks(property_id);
CREATE INDEX idx_hm_user_properties_user ON hm_user_properties(user_id);
CREATE INDEX idx_hm_user_properties_property ON hm_user_properties(property_id);
CREATE INDEX idx_hm_properties_qr ON hm_properties(qr_code_id);

-- ───────────────────────────────────────────────────
-- RLS policies (permissive, matching project pattern)
-- ───────────────────────────────────────────────────

ALTER TABLE hm_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_requester_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_user_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_request_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on hm_properties" ON hm_properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_requester_types" ON hm_requester_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_categories" ON hm_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_users" ON hm_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_user_properties" ON hm_user_properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_requests" ON hm_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_request_photos" ON hm_request_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_recurring_tasks" ON hm_recurring_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_tasks" ON hm_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_notes" ON hm_task_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_photos" ON hm_task_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_time_logs" ON hm_task_time_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_materials" ON hm_task_materials FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────
-- Seed data
-- ───────────────────────────────────────────────────

-- Requester types
INSERT INTO hm_requester_types (label, sort_order) VALUES
  ('Property Owner', 1),
  ('Property Manager', 2),
  ('Guest', 3);

-- Categories
INSERT INTO hm_categories (label, sort_order) VALUES
  ('Plumbing', 1),
  ('Electrical', 2),
  ('HVAC', 3),
  ('Appliances', 4),
  ('Structural/Building', 5),
  ('Landscaping/Exterior', 6),
  ('Pest Control', 7),
  ('General/Other', 8);

-- ───────────────────────────────────────────────────
-- Storage bucket
-- ───────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('hospitality', 'hospitality', true)
ON CONFLICT DO NOTHING;
