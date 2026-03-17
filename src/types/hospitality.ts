// ═══════════════════════════════════════════════════
// Hospitality Maintenance Types
// ═══════════════════════════════════════════════════

// ── Configuration Types ──────────────────────────

export interface HMProperty {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  qr_code_id: string;
  is_active: boolean;
  hourly_rate: number | null;
  is_retainer: boolean;
  retainer_amount: number | null;
  retainer_start_date: string | null;
  retainer_end_date: string | null;
  created_at: string;
}

export type HMPropertyInsert = Omit<HMProperty, "id" | "created_at" | "qr_code_id">;

export interface HMRequesterType {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export type HMRequesterTypeInsert = Omit<HMRequesterType, "id">;

export interface HMCategory {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export type HMCategoryInsert = Omit<HMCategory, "id">;

export interface HMUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "manager" | "staff";
  password_hash: string;
  must_reset_password: boolean;
  is_active: boolean;
  created_at: string;
}

export type HMUserInsert = Omit<HMUser, "id" | "created_at">;

export interface HMUserProperty {
  id: string;
  user_id: string;
  property_id: string;
}

// ── Request Types ────────────────────────────────

export type HMUrgency = "routine" | "urgent" | "emergency";
export type HMRequestStatus = "pending" | "approved" | "rejected";

export interface HMRequest {
  id: string;
  property_id: string;
  requester_type_id: string;
  contact_phone: string | null;
  category_id: string;
  description: string;
  urgency: HMUrgency;
  status: HMRequestStatus;
  manager_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type HMRequestInsert = Omit<HMRequest, "id" | "created_at" | "status" | "manager_notes" | "reviewed_by" | "reviewed_at">;

export interface HMRequestPhoto {
  id: string;
  request_id: string;
  storage_path: string;
  created_at: string;
}

// ── Task Types ───────────────────────────────────

export type HMTaskStatus = "new" | "acknowledged" | "in_progress" | "on_hold" | "completed";
export type HMPriority = "low" | "medium" | "high" | "critical";
export type HMFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
export type HMPhotoType = "before" | "during" | "after";

export interface HMTask {
  id: string;
  request_id: string | null;
  recurring_task_id: string | null;
  property_id: string;
  title: string | null;
  description: string | null;
  assigned_to: string | null;
  status: HMTaskStatus;
  priority: HMPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export type HMTaskInsert = Omit<HMTask, "id" | "created_at" | "completed_at">;

export interface HMTaskNote {
  id: string;
  task_id: string;
  user_id: string | null;
  note: string;
  created_at: string;
}

export interface HMTaskPhoto {
  id: string;
  task_id: string;
  user_id: string | null;
  storage_path: string;
  photo_type: HMPhotoType;
  created_at: string;
}

export interface HMTaskTimeLog {
  id: string;
  task_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
}

export interface HMTaskMaterial {
  id: string;
  task_id: string;
  name: string;
  quantity: number | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface HMRecurringTask {
  id: string;
  property_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  priority: HMPriority;
  frequency: HMFrequency;
  next_due_date: string;
  assigned_to: string | null;
  is_active: boolean;
  created_at: string;
}

export type HMRecurringTaskInsert = Omit<HMRecurringTask, "id" | "created_at">;

// ── Extended / Joined Types ──────────────────────

export interface HMRequestWithDetails extends HMRequest {
  property?: HMProperty;
  category?: HMCategory;
  requester_type?: HMRequesterType;
  photos?: HMRequestPhoto[];
  reviewer?: HMUser;
}

export interface HMTaskWithDetails extends HMTask {
  property?: HMProperty;
  request?: HMRequest;
  assigned_user?: HMUser;
  notes?: HMTaskNote[];
  photos?: HMTaskPhoto[];
  time_logs?: HMTaskTimeLog[];
  materials?: HMTaskMaterial[];
}
