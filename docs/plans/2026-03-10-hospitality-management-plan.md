# Hospitality Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a QR-code-driven maintenance request pipeline with tenant submission, manager approval, and a full-featured maintenance task management PWA.

**Architecture:** Sub-route architecture under `/hospitality` with four distinct views: public request form (no auth), manager dashboard (password-gated), maintenance staff task board (custom user login), and admin panel (password-gated). Client-side Supabase hooks for data, server-side API routes for Twilio SMS and Claude translation. PWA manifest for home-screen install.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (PostgreSQL + Storage), Tailwind CSS 3, Twilio REST API (SMS), Claude Haiku 4.5 (translation), qrcode (npm, QR generation)

**Design doc:** `docs/plans/2026-03-10-hospitality-management-design.md`

---

## Task 1: Database Schema

**Files:**
- Create: `supabase-hospitality-schema.sql`

**Step 1: Write the schema SQL file**

```sql
-- ═══════════════════════════════════════════════════════════════
-- Hospitality Management Schema
-- Table prefix: hm_
-- ═══════════════════════════════════════════════════════════════

-- ─── Configuration Tables ────────────────────────────────────

CREATE TABLE hm_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  lat decimal(10,7),
  lng decimal(10,7),
  notes text,
  qr_code_id uuid UNIQUE DEFAULT gen_random_uuid(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_requester_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE hm_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE hm_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL CHECK (role IN ('manager', 'staff')),
  password_hash text NOT NULL,
  must_reset_password boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_user_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES hm_users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  UNIQUE(user_id, property_id)
);

-- ─── Request Tables ──────────────────────────────────────────

CREATE TABLE hm_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  requester_type_id uuid NOT NULL REFERENCES hm_requester_types(id),
  contact_phone text,
  category_id uuid NOT NULL REFERENCES hm_categories(id),
  description text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  manager_notes text,
  reviewed_by uuid REFERENCES hm_users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_request_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES hm_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── Task Tables ─────────────────────────────────────────────

CREATE TABLE hm_recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  category_id uuid REFERENCES hm_categories(id),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_due_date date NOT NULL,
  assigned_to uuid REFERENCES hm_users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES hm_requests(id) ON DELETE SET NULL,
  recurring_task_id uuid REFERENCES hm_recurring_tasks(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
  title text,
  description text,
  assigned_to uuid REFERENCES hm_users(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'on_hold', 'completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES hm_users(id),
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_task_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES hm_users(id),
  storage_path text NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('before', 'during', 'after')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hm_task_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES hm_users(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_minutes integer,
  notes text
);

CREATE TABLE hm_task_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES hm_tasks(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity decimal,
  cost decimal(10,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX idx_hm_requests_property ON hm_requests(property_id);
CREATE INDEX idx_hm_requests_status ON hm_requests(status);
CREATE INDEX idx_hm_tasks_status ON hm_tasks(status);
CREATE INDEX idx_hm_tasks_assigned ON hm_tasks(assigned_to);
CREATE INDEX idx_hm_tasks_property ON hm_tasks(property_id);
CREATE INDEX idx_hm_user_properties_user ON hm_user_properties(user_id);
CREATE INDEX idx_hm_user_properties_property ON hm_user_properties(property_id);
CREATE INDEX idx_hm_properties_qr ON hm_properties(qr_code_id);

-- ─── RLS (permissive, consistent with other micro-apps) ─────

ALTER TABLE hm_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_requester_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_user_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_request_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_task_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE hm_recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on hm_properties" ON hm_properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_requester_types" ON hm_requester_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_categories" ON hm_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_users" ON hm_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_user_properties" ON hm_user_properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_requests" ON hm_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_request_photos" ON hm_request_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_tasks" ON hm_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_notes" ON hm_task_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_photos" ON hm_task_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_time_logs" ON hm_task_time_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_task_materials" ON hm_task_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hm_recurring_tasks" ON hm_recurring_tasks FOR ALL USING (true) WITH CHECK (true);

-- ─── Seed Data ───────────────────────────────────────────────

INSERT INTO hm_requester_types (label, sort_order) VALUES
  ('Property Owner', 1),
  ('Property Manager', 2),
  ('Guest', 3);

INSERT INTO hm_categories (label, sort_order) VALUES
  ('Plumbing', 1),
  ('Electrical', 2),
  ('HVAC', 3),
  ('Appliances', 4),
  ('Structural/Building', 5),
  ('Landscaping/Exterior', 6),
  ('Pest Control', 7),
  ('General/Other', 8);
```

**Step 2: Run the migration against Supabase**

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w | sed 's/go-keyring-base64://' | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/sfftouuzdrxfwcqqjjpm/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg sql "$(cat supabase-hospitality-schema.sql)" '{query: $sql}')"
```

Expected: JSON response with no errors.

**Step 3: Create Supabase Storage bucket**

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w | sed 's/go-keyring-base64://' | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/sfftouuzdrxfwcqqjjpm/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "INSERT INTO storage.buckets (id, name, public) VALUES ('"'"'hospitality'"'"', '"'"'hospitality'"'"', true) ON CONFLICT DO NOTHING;"}'
```

**Step 4: Commit**

```bash
git add supabase-hospitality-schema.sql
git commit -m "feat(hospitality): add database schema with 13 tables"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/hospitality.ts`

**Step 1: Write type definitions**

```typescript
// ─── Configuration Types ─────────────────────────────────────

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

// ─── Request Types ───────────────────────────────────────────

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

// ─── Task Types ──────────────────────────────────────────────

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

// ─── Joined/Extended Types ───────────────────────────────────

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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/types/hospitality.ts`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/types/hospitality.ts
git commit -m "feat(hospitality): add TypeScript type definitions"
```

---

## Task 3: Supabase Hooks — Configuration Entities

**Files:**
- Create: `src/lib/hospitalityHooks.ts`

**Step 1: Write hooks for properties, categories, requester types, and users**

This file follows the exact pattern from `src/lib/paramountHooks.ts`:
- `"use client"` at top
- Import `supabase, isSupabaseConfigured` from `./supabase`
- Import types from `@/types/hospitality`
- Each hook returns `{ data, loading, error, refetch, ...mutators }`

Hooks to implement in this step:
- `useProperties()` — CRUD for `hm_properties`
- `useRequesterTypes()` — CRUD for `hm_requester_types`
- `useCategories()` — CRUD for `hm_categories`
- `useHMUsers()` — CRUD for `hm_users` (name avoids collision with React's useUser)
- `useUserProperties(userId?)` — manage `hm_user_properties` assignments
- `normalizePhone()` helper — reuse pattern from paramount hooks

Each hook must include:
- `useState` for `[data, loading, error]`
- `useCallback` for fetch function
- `useEffect` for initial fetch
- `isSupabaseConfigured` guard
- CRUD methods: `add`, `update`, `remove` (with optimistic updates where appropriate)

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/hospitalityHooks.ts`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/hospitalityHooks.ts
git commit -m "feat(hospitality): add Supabase hooks for config entities"
```

---

## Task 4: Supabase Hooks — Requests and Tasks

**Files:**
- Modify: `src/lib/hospitalityHooks.ts`

**Step 1: Add request and task hooks**

Hooks to add:
- `useRequests(propertyIds?, status?)` — fetch `hm_requests` with joins to property, category, requester_type, photos. Filterable by property and status.
- `useSubmitRequest()` — insert into `hm_requests` + upload photos to `hospitality` bucket → insert `hm_request_photos`. Returns `{ submitRequest, submitting, error }`.
- `useReviewRequest()` — approve/reject: update `hm_requests` status + on approve, insert `hm_tasks`. Returns `{ approveRequest, approveWithEdits, rejectRequest }`.
- `useTasks(assignedTo?, status?, propertyId?)` — fetch `hm_tasks` with joins. Filterable.
- `useTaskDetail(taskId)` — fetch single task with all related data (notes, photos, time logs, materials).
- `useTaskActions(taskId)` — update status, add note, add photo, start/stop timer, add material. Each returns its own loading/error state.
- `useRecurringTasks()` — CRUD for `hm_recurring_tasks`.
- `usePropertyByQrCode(qrCodeId)` — single property lookup by `qr_code_id` (for public form).

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/hospitalityHooks.ts`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/hospitalityHooks.ts
git commit -m "feat(hospitality): add request and task hooks"
```

---

## Task 5: API Routes — SMS, Translation, Auth, Recurring

**Files:**
- Create: `src/app/api/hospitality/sms/route.ts`
- Create: `src/app/api/hospitality/translate/route.ts`
- Create: `src/app/api/hospitality/auth/route.ts`
- Create: `src/app/api/hospitality/recurring/route.ts`

**Step 1: SMS route**

Follow the exact pattern from `src/app/api/paramount/send/route.ts`:
- POST handler
- Accept `{ to, message }` in body
- Use `TWILIO_HM_PHONE_NUMBER` env var (fall back to `TWILIO_PHONE_NUMBER`)
- Send via Twilio REST API with Basic Auth
- Return `{ success: true, sid }` or error

**Step 2: Translation route**

```typescript
// POST /api/hospitality/translate
// Body: { text: string, targetLang?: string }
// Uses Claude Haiku 4.5 via Anthropic API
// Returns: { translation: string }
```

- Import Anthropic SDK or use fetch directly to `https://api.anthropic.com/v1/messages`
- Use `ANTHROPIC_API_KEY` env var
- Model: `claude-haiku-4-5-20251001`
- System prompt: "Translate the following maintenance request text to Spanish. Preserve any technical or maintenance terminology. Return only the translated text."
- Return translated text

**Step 3: Auth route**

```typescript
// POST /api/hospitality/auth
// Body: { email: string, password: string }
// Checks hm_users table, verifies bcrypt hash
// Returns: { user: HMUser, mustResetPassword: boolean } or 401
//
// PUT /api/hospitality/auth
// Body: { userId: string, newPassword: string }
// Updates password_hash, sets must_reset_password = false
// Returns: { success: true }
```

- Use `bcryptjs` (or `bcrypt`) npm package for password hashing
- Server-side only — never expose password_hash to client

**Step 4: Recurring tasks cron route**

```typescript
// POST /api/hospitality/recurring
// Protected by CRON_SECRET Bearer token (same pattern as paramount/send-scheduled)
// Checks hm_recurring_tasks where next_due_date <= today and is_active = true
// Creates hm_tasks for each due recurring task
// Advances next_due_date based on frequency
// Returns: { created: number }
```

**Step 5: Verify all routes compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add src/app/api/hospitality/
git commit -m "feat(hospitality): add API routes for SMS, translate, auth, recurring"
```

---

## Task 6: Install Dependencies

**Step 1: Install new packages**

```bash
npm install qrcode bcryptjs
npm install -D @types/qrcode @types/bcryptjs
```

- `qrcode` — QR code generation for property URLs
- `bcryptjs` — password hashing for user auth (pure JS, no native deps)

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(hospitality): add qrcode and bcryptjs dependencies"
```

---

## Task 7: Public Request Form

**Files:**
- Create: `src/app/hospitality/request/[propertyId]/page.tsx`
- Create: `src/components/hospitality/RequestForm.tsx`

**Step 1: Create the route page**

```typescript
// src/app/hospitality/request/[propertyId]/page.tsx
// NO password gate — this is a public page
// Receives propertyId from URL params (this is the qr_code_id)
// Renders <RequestForm propertyId={propertyId} />
```

No `metadata` export needed since this is a dynamic public page. Or add generic metadata: `title: "Maintenance Request"`.

**Step 2: Build the RequestForm component**

Mobile-first design. This is what tenants see after scanning the QR code.

Behavior:
- On mount, call `usePropertyByQrCode(propertyId)` to fetch property name
- If property not found, show error message
- Form fields:
  - Property name (read-only, auto-filled)
  - Requester type (dropdown, from `useRequesterTypes()`)
  - Contact phone (tel input)
  - Category (dropdown, from `useCategories()`)
  - Description (textarea)
  - Photos (multi-file input with preview thumbnails, camera capture on mobile)
  - Urgency (three-button selector: Routine / Urgent / Emergency)
- Submit button calls `useSubmitRequest().submitRequest()`
- On success: show confirmation screen with checkmark
- After submit: trigger SMS to manager(s) via `/api/hospitality/sms`

Styling:
- Use CSS variables (`var(--bg-primary)`, `var(--text-primary)`, `var(--gold)`)
- Large touch targets (min 44px)
- Clean, minimal layout — no header/nav (standalone form)
- Photo upload: grid of thumbnails with X to remove, + button to add more

**Step 3: Verify it renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/hospitality/request/[any-uuid]`
Expected: Form renders (may show "property not found" without seed data).

**Step 4: Commit**

```bash
git add src/app/hospitality/request/ src/components/hospitality/RequestForm.tsx
git commit -m "feat(hospitality): add public request form with QR code support"
```

---

## Task 8: Manager Dashboard

**Files:**
- Create: `src/app/hospitality/page.tsx`
- Create: `src/components/hospitality/ManagerDashboard.tsx`
- Create: `src/components/hospitality/RequestQueue.tsx`
- Create: `src/components/hospitality/RequestReviewCard.tsx`
- Create: `src/components/hospitality/ApprovalModal.tsx`
- Create: `src/components/hospitality/RejectionModal.tsx`

**Step 1: Create the route page**

```typescript
// src/app/hospitality/page.tsx
import PasswordGate from "@/components/PasswordGate";
import ManagerDashboard from "@/components/hospitality/ManagerDashboard";

export const metadata = {
  title: "Hospitality Management | WHB Command Center",
};

export default function HospitalityPage() {
  return (
    <PasswordGate>
      <ManagerDashboard />
    </PasswordGate>
  );
}
```

**Step 2: Build ManagerDashboard orchestrator**

- "use client"
- Import hooks: `useRequests`, `useProperties`, `useReviewRequest`
- State: `selectedRequestId`, filter by property, filter by status
- Header with app title, admin button (top-right, links to `/hospitality/admin`), back to home link
- Renders `<RequestQueue>` with pending requests
- On card action → opens `<ApprovalModal>` or `<RejectionModal>`

**Step 3: Build RequestQueue**

- Filterable list of pending requests
- Filter controls: property dropdown, urgency filter
- Sort by: newest first (default), urgency
- Each item rendered as `<RequestReviewCard>`

**Step 4: Build RequestReviewCard**

- Expandable card showing: property name, category, urgency badge, description preview, photo thumbnails, timestamp
- Expand to see full description and all photos
- Three action buttons: Reject, Approve, Approve with Edits
- Urgency badges: Routine (gray), Urgent (orange), Emergency (red)

**Step 5: Build ApprovalModal**

- Modal overlay
- "Approve with Edits" mode: editable fields for priority, due date, category, staff assignment (dropdown), manager notes
- "Approve" mode: just a confirm button (auto-maps urgency to priority)
- Urgency → Priority mapping: routine→medium, urgent→high, emergency→critical
- On confirm: calls `approveRequest()` or `approveWithEdits()`, triggers SMS to staff

**Step 6: Build RejectionModal**

- Modal overlay
- Textarea for rejection notes (required)
- Preview of SMS that will be sent
- On confirm: calls `rejectRequest()`, triggers SMS to requester

**Step 7: Verify it renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/hospitality`
Expected: Password gate → empty dashboard (no requests yet).

**Step 8: Commit**

```bash
git add src/app/hospitality/page.tsx src/components/hospitality/ManagerDashboard.tsx \
  src/components/hospitality/RequestQueue.tsx src/components/hospitality/RequestReviewCard.tsx \
  src/components/hospitality/ApprovalModal.tsx src/components/hospitality/RejectionModal.tsx
git commit -m "feat(hospitality): add manager dashboard with request review flow"
```

---

## Task 9: Maintenance Staff Task Board

**Files:**
- Create: `src/app/hospitality/tasks/page.tsx`
- Create: `src/components/hospitality/TaskBoard.tsx`
- Create: `src/components/hospitality/TaskList.tsx`
- Create: `src/components/hospitality/TaskDetail.tsx`
- Create: `src/components/hospitality/TaskStatusBar.tsx`
- Create: `src/components/hospitality/TranslateButton.tsx`

**Step 1: Create the route page**

```typescript
// src/app/hospitality/tasks/page.tsx
// NO PasswordGate — uses custom user login
// Renders <TaskBoard />
```

Add metadata: `title: "Maintenance Tasks | WHB Command Center"`.

**Step 2: Build TaskBoard orchestrator**

- "use client"
- Login gate: if no user session in state, show login form (email + password)
- On login: POST to `/api/hospitality/auth`, store user in state
- If `must_reset_password`: show password reset form before proceeding
- Once authenticated: render task interface
- State: `currentUser`, `selectedTaskId`, `viewMode` (list/detail)
- Import hooks: `useTasks`, `useTaskDetail`, `useTaskActions`
- Header: "WHB Maintenance" title, user name, logout button
- Mobile bottom nav: Tasks, My Tasks (filtered to current user)

**Step 3: Build TaskList**

- Sortable/filterable task queue
- Filters: status (multi-select chips), property, priority, date range
- Sort: priority desc + due date asc (default)
- Each task row: title/description preview, property name, priority badge, status badge, due date, assigned user
- Priority badges: Low (gray), Medium (blue), High (orange), Critical (red pulsing)
- Status badges: color-coded chips
- Tap row → navigate to TaskDetail

**Step 4: Build TaskDetail**

- Full task view with tabbed sections (mobile-friendly tabs)
- **Details tab:** title, description, request photos (from original request), property info, translate button
- **Activity tab:** timestamped note log (newest first), add note form at bottom
- **Photos tab:** three sections (Before / During / After), camera capture + upload, grid of thumbnails
- **Time tab:** start/stop timer button (large, prominent), manual entry form (start time, end time, notes), total hours logged summary
- **Materials tab:** list of parts added, add form (name, quantity, cost, notes), running cost total
- Status update: `<TaskStatusBar>` at top, tappable to advance status

**Step 5: Build TaskStatusBar**

- Horizontal pipeline: New → Acknowledged → In Progress → On Hold → Completed
- Current status highlighted with gold
- Completed statuses have checkmark
- Tap next status to advance (with confirmation)
- On "Completed": trigger SMS to requester

**Step 6: Build TranslateButton**

- Single button: "Traducir al Espanol" / "Show Original"
- On click: POST to `/api/hospitality/translate` with description + notes text
- Toggle between translated and original
- Loading state while translating
- Cache translation in component state (don't re-translate on toggle)

**Step 7: Verify it renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/hospitality/tasks`
Expected: Login form renders.

**Step 8: Commit**

```bash
git add src/app/hospitality/tasks/ src/components/hospitality/TaskBoard.tsx \
  src/components/hospitality/TaskList.tsx src/components/hospitality/TaskDetail.tsx \
  src/components/hospitality/TaskStatusBar.tsx src/components/hospitality/TranslateButton.tsx
git commit -m "feat(hospitality): add maintenance task board with full task management"
```

---

## Task 10: Admin Panel

**Files:**
- Create: `src/app/hospitality/admin/page.tsx`
- Create: `src/components/hospitality/HospitalityAdmin.tsx`
- Create: `src/components/hospitality/PropertyManager.tsx`
- Create: `src/components/hospitality/UserManager.tsx`
- Create: `src/components/hospitality/CategoryManager.tsx`
- Create: `src/components/hospitality/RequesterTypeManager.tsx`
- Create: `src/components/hospitality/RecurringTaskManager.tsx`
- Create: `src/components/hospitality/StatsDashboard.tsx`

**Step 1: Create the route page**

```typescript
// src/app/hospitality/admin/page.tsx
import PasswordGate from "@/components/PasswordGate";
import HospitalityAdmin from "@/components/hospitality/HospitalityAdmin";

export const metadata = {
  title: "Hospitality Admin | WHB Command Center",
};

export default function HospitalityAdminPage() {
  return (
    <PasswordGate>
      <HospitalityAdmin />
    </PasswordGate>
  );
}
```

**Step 2: Build HospitalityAdmin orchestrator**

- Tab-based navigation: Properties | Users | Categories | Requester Types | Recurring Tasks | Dashboard
- Each tab renders its manager component
- Header: title, back link to `/hospitality`

**Step 3: Build PropertyManager**

- Table/card list of all properties
- Add property form: name, address, city, state, zip, lat, lng, notes
- Edit inline or via modal
- QR code generation: use `qrcode` npm package to generate PNG
  - QR encodes URL: `{origin}/hospitality/request/{qr_code_id}`
  - Download button for PNG
  - Print button
- Deactivate toggle (soft delete)
- Assign managers/staff: multi-select from `hm_users`

**Step 4: Build UserManager**

- Table of all users (managers + staff)
- Add user form: name, email, phone, role (manager/staff), initial password
- Password is hashed server-side via `/api/hospitality/auth` PUT endpoint (add a create-user endpoint)
- Property assignment: multi-select checkboxes
- Toggle active/inactive
- Reset password button (sets `must_reset_password = true`)

**Step 5: Build CategoryManager**

- Sortable list of categories
- Add/edit inline
- Deactivate toggle (don't delete — referenced by requests)
- Drag to reorder (update `sort_order`)

**Step 6: Build RequesterTypeManager**

- Same pattern as CategoryManager
- Sortable list, add/edit, deactivate, drag to reorder

**Step 7: Build RecurringTaskManager**

- Table of recurring task templates
- Add/edit form: title, description, property (dropdown), category (dropdown), priority, frequency, next due date, assigned to (dropdown)
- Toggle active/inactive
- Show next due date, last generated date

**Step 8: Build StatsDashboard**

- Key metrics cards: Total open tasks, Avg completion time, Tasks this week/month
- Tasks by status (bar chart or colored counts)
- Tasks by property (table)
- Tasks by staff member (table)
- Requests by category (pie chart or bar)
- Use simple CSS-based charts (colored bars with percentages) — no chart library needed for MVP

**Step 9: Verify it renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/hospitality/admin`
Expected: Password gate → tabbed admin panel.

**Step 10: Commit**

```bash
git add src/app/hospitality/admin/ src/components/hospitality/HospitalityAdmin.tsx \
  src/components/hospitality/PropertyManager.tsx src/components/hospitality/UserManager.tsx \
  src/components/hospitality/CategoryManager.tsx src/components/hospitality/RequesterTypeManager.tsx \
  src/components/hospitality/RecurringTaskManager.tsx src/components/hospitality/StatsDashboard.tsx
git commit -m "feat(hospitality): add admin panel with property, user, and config management"
```

---

## Task 11: PWA Configuration

**Files:**
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx` — add manifest link and meta tags

**Step 1: Create PWA manifest**

```json
{
  "name": "WHB Maintenance",
  "short_name": "Maintenance",
  "description": "WHB Companies Maintenance Task Management",
  "start_url": "/hospitality/tasks",
  "display": "standalone",
  "background_color": "#0a0b0e",
  "theme_color": "#d4af37",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 2: Add manifest link to layout.tsx**

Add to the `<head>` section of `src/app/layout.tsx`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#d4af37" />
```

**Step 3: Create placeholder icons**

Generate simple 192x192 and 512x512 PNG icons with the WHB brand gold color and a wrench/tool icon. These can be replaced later with proper branding.

**Step 4: Verify manifest loads**

Run: `npm run dev`
Open DevTools → Application → Manifest
Expected: Manifest loads with correct values.

**Step 5: Commit**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png src/app/layout.tsx
git commit -m "feat(hospitality): add PWA manifest for home screen install"
```

---

## Task 12: Landing Page Integration

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add Hospitality Management to the microApps array**

Add to the `microApps` array in `src/app/page.tsx`:

```typescript
{
  name: "Hospitality Management",
  description: "Maintenance requests & task management",
  href: "/hospitality",
  icon: "🏠",
  color: "#d4af37",
}
```

**Step 2: Verify it appears**

Run: `npm run dev`
Navigate to: `http://localhost:3000`
Expected: New card appears in the app grid.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(hospitality): add to landing page"
```

---

## Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Hospitality Management to project documentation**

Update these sections:
- **Project Overview** micro-app list: add entry 8
- **Routing** section: add hospitality routes
- **Data Layer** section: add `src/lib/hospitalityHooks.ts` entry
- **Type Definitions** section: add `hospitality.ts`
- **Component Structure** section: add hospitality components
- **Database** section: add `supabase-hospitality-schema.sql`
- **Environment Variables** section: add `ANTHROPIC_API_KEY` and `TWILIO_HM_PHONE_NUMBER`

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Hospitality Management to CLAUDE.md"
```

---

## Task 14: Build Verification & Lint

**Step 1: Run linter**

```bash
npm run lint
```

Expected: No errors (warnings acceptable).

**Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Fix any issues found**

If lint or build errors, fix them and commit:
```bash
git add -A
git commit -m "fix(hospitality): resolve lint and build errors"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Database schema | None |
| 2 | Type definitions | None |
| 3 | Hooks — config entities | Task 2 |
| 4 | Hooks — requests & tasks | Task 3 |
| 5 | API routes (SMS, translate, auth, recurring) | Task 2 |
| 6 | Install dependencies | None |
| 7 | Public request form | Tasks 3, 4 |
| 8 | Manager dashboard | Tasks 3, 4 |
| 9 | Maintenance task board | Tasks 4, 5 |
| 10 | Admin panel | Tasks 3, 4, 6 |
| 11 | PWA configuration | None |
| 12 | Landing page integration | None |
| 13 | Update CLAUDE.md | All above |
| 14 | Build verification | All above |

**Parallelizable groups:**
- Group A (no deps): Tasks 1, 2, 6, 11, 12
- Group B (after types): Tasks 3, 5
- Group C (after hooks): Tasks 4
- Group D (after all data layer): Tasks 7, 8, 9, 10
- Group E (final): Tasks 13, 14
