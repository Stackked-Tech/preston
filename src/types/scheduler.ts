// ─── Construction Scheduler Types (cs_ prefix) ──────────────────

export interface CSProject {
  id: string;
  name: string;
  address: string;
  pm_name: string;
  status: "planning" | "active" | "on_hold" | "completed";
  start_date: string | null;
  estimated_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CSProjectInsert = Omit<CSProject, "id" | "created_at" | "updated_at">;

export interface CSPhase {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  color: string;
  created_at: string;
}

export type CSPhaseInsert = Omit<CSPhase, "id" | "created_at">;

export interface CSTask {
  id: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  dependency_id: string | null; // task this depends on
  sub_id: string | null;
  status: "pending" | "in_progress" | "completed" | "delayed";
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CSTaskInsert = Omit<CSTask, "id" | "created_at" | "updated_at">;

export interface CSSub {
  id: string;
  name: string;
  company: string | null;
  trade: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export type CSSubInsert = Omit<CSSub, "id" | "created_at">;

export interface CSSubToken {
  id: string;
  sub_id: string;
  token: string;
  expires_at: string | null;
  created_at: string;
}

export interface CSNotification {
  id: string;
  project_id: string;
  sub_id: string;
  task_id: string | null;
  channel: "sms" | "email";
  message: string;
  status: "sent" | "failed" | "pending";
  sent_at: string;
  created_at: string;
}

export interface CSTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export type CSTemplateInsert = Omit<CSTemplate, "id" | "created_at">;

export interface CSTemplatePhase {
  id: string;
  template_id: string;
  name: string;
  sort_order: number;
  color: string;
}

export interface CSTemplateTask {
  id: string;
  template_id: string;
  template_phase_id: string | null;
  name: string;
  duration_days: number;
  offset_days: number; // days from project start
  dependency_index: number | null; // index of task this depends on
  trade: string | null;
  sort_order: number;
}

// ─── Joined / computed types ─────────────────────────

export interface CSTaskWithSub extends CSTask {
  sub?: CSSub | null;
}

export interface CSPhaseWithTasks extends CSPhase {
  tasks: CSTaskWithSub[];
}

export interface CSProjectWithDetails extends CSProject {
  phases: CSPhaseWithTasks[];
  tasks: CSTaskWithSub[];
}
