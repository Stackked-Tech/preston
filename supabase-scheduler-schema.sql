-- Construction Scheduler Schema (cs_ prefix)
-- Run against Supabase project: sfftouuzdrxfwcqqjjpm

-- ─── Subcontractors ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  trade TEXT NOT NULL DEFAULT 'General',
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Projects ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  pm_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed')),
  start_date DATE,
  estimated_end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Phases ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#d4af37',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tasks ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES cs_phases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INT NOT NULL DEFAULT 1,
  dependency_id UUID REFERENCES cs_tasks(id) ON DELETE SET NULL,
  sub_id UUID REFERENCES cs_subs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Sub Portal Tokens ──────────────────────────────
CREATE TABLE IF NOT EXISTS cs_sub_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_id UUID NOT NULL REFERENCES cs_subs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Notification Log ───────────────────────────────
CREATE TABLE IF NOT EXISTS cs_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL REFERENCES cs_subs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES cs_tasks(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Schedule Templates ─────────────────────────────
CREATE TABLE IF NOT EXISTS cs_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cs_template_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES cs_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#d4af37'
);

CREATE TABLE IF NOT EXISTS cs_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES cs_templates(id) ON DELETE CASCADE,
  template_phase_id UUID REFERENCES cs_template_phases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  duration_days INT NOT NULL DEFAULT 1,
  offset_days INT NOT NULL DEFAULT 0,
  dependency_index INT, -- index referencing another template task's sort_order
  trade TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- ─── Indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cs_phases_project ON cs_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_project ON cs_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_phase ON cs_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_sub ON cs_tasks(sub_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_dependency ON cs_tasks(dependency_id);
CREATE INDEX IF NOT EXISTS idx_cs_sub_tokens_token ON cs_sub_tokens(token);
CREATE INDEX IF NOT EXISTS idx_cs_sub_tokens_sub ON cs_sub_tokens(sub_id);
CREATE INDEX IF NOT EXISTS idx_cs_notifications_project ON cs_notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_cs_notifications_sub ON cs_notifications(sub_id);
CREATE INDEX IF NOT EXISTS idx_cs_template_phases_template ON cs_template_phases(template_id);
CREATE INDEX IF NOT EXISTS idx_cs_template_tasks_template ON cs_template_tasks(template_id);

-- ─── RLS (permissive, same as other micro-apps) ─────
ALTER TABLE cs_subs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_sub_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_template_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_subs_all" ON cs_subs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_projects_all" ON cs_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_phases_all" ON cs_phases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_tasks_all" ON cs_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_sub_tokens_all" ON cs_sub_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_notifications_all" ON cs_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_templates_all" ON cs_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_template_phases_all" ON cs_template_phases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cs_template_tasks_all" ON cs_template_tasks FOR ALL USING (true) WITH CHECK (true);
