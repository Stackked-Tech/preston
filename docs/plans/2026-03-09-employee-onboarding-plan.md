# Employee Onboarding Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect Employee Admin, Signed to Sealed, and Employee Portal into a single onboarding pipeline where admins onboard employees in one modal, employees receive invite emails, set passwords, sign documents, and access their dashboard.

**Architecture:** Server-side API route handles admin auth operations (invite, envelope creation) using service role key. Client-side hooks handle reads. A PostgreSQL trigger auto-updates employee status when signing completes. The existing STS signing flow is reused via redirect — no modifications to STS codebase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Auth + PostgreSQL + Storage), Tailwind CSS 3

**Design doc:** `docs/plans/2026-03-09-employee-onboarding-design.md`

**Note:** No test framework is configured. Verification is done via `npm run build` (TypeScript + ESLint) and manual testing in dev server.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase-employeeadmin-onboarding.sql`

**Context:** The `ea_staff` table currently has an `is_active` boolean but no status field, no auth linkage, and no onboarding columns. We need to add 5 new columns and a DB trigger that fires when an STS recipient signs.

**Step 1: Write the migration SQL**

```sql
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
```

**Step 2: Run the migration against the remote DB**

Use the Supabase Management API as documented in CLAUDE.md:
```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w | sed 's/go-keyring-base64://' | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/sfftouuzdrxfwcqqjjpm/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg sql "$(cat supabase-employeeadmin-onboarding.sql)" '{query: $sql}')"
```

Expected: Success response (empty array or confirmation).

**Step 3: Verify migration applied**

Query the table to confirm new columns exist:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/sfftouuzdrxfwcqqjjpm/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = '\''ea_staff'\'' AND column_name IN ('\''status'\'', '\''supabase_auth_uid'\'', '\''onboarding_template_id'\'', '\''onboarding_envelope_id'\'', '\''onboarding_signing_token'\'')"}'
```

Expected: 5 rows showing the new columns.

Also verify the trigger exists:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/sfftouuzdrxfwcqqjjpm/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = '\''trg_on_signing_complete'\''"}'
```

**Step 4: Commit**

```bash
git add supabase-employeeadmin-onboarding.sql
git commit -m "feat(onboarding): add migration for status, auth linkage, and signing trigger"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/employeeadmin.ts`
- Modify: `src/types/employeeportal.ts`

**Context:** The `EAStaff` interface needs the 5 new columns. The portal types need an `EmployeeRecord` type for the new `useEmployeeRecord` hook. We also need a type for the onboarding API request body.

**Step 1: Update `src/types/employeeadmin.ts`**

Add to the `EAStaff` interface (after `email` field, before `is_active`):
```typescript
status: 'active' | 'onboarding' | 'inactive' | 'terminated';
supabase_auth_uid: string | null;
onboarding_template_id: string | null;
onboarding_envelope_id: string | null;
onboarding_signing_token: string | null;
```

Add new type at end of file:
```typescript
export type EAStaffStatus = 'active' | 'onboarding' | 'inactive' | 'terminated';

export interface OnboardEmployeeRequest {
  display_name: string;
  email: string;
  branch_id: string;
  template_id: string;
  target_first: string;
  target_last: string;
  station_lease: number;
  financial_services: number;
  phorest_fee: number;
  refreshment: number;
  associate_pay?: number;
  supervisor?: string;
}
```

**Step 2: Update `src/types/employeeportal.ts`**

Add a new interface for the full employee record (used by auth routing and onboarding page):
```typescript
/** Full employee record for onboarding routing */
export interface EmployeeRecord {
  id: string;
  branch_id: string;
  display_name: string;
  status: 'active' | 'onboarding' | 'inactive' | 'terminated';
  onboarding_envelope_id: string | null;
  onboarding_signing_token: string | null;
  ea_branches: { name: string } | null;
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. Existing code using `EAStaff` and `EAStaffInsert` may fail since the new fields are required on `EAStaff` but not yet supplied in insert operations. The `EAStaffInsert` type (via `Omit<EAStaff, "id" | "created_at">`) will now require the new fields. Fix by making the new onboarding fields optional on `EAStaffInsert` — either adjust the Omit or make the fields nullable on EAStaff (they already are `| null`). The `status` field has a DB default so it's optional on insert — add a separate override:

```typescript
export type EAStaffInsert = Omit<EAStaff, "id" | "created_at" | "status" | "supabase_auth_uid" | "onboarding_template_id" | "onboarding_envelope_id" | "onboarding_signing_token"> & {
  status?: EAStaffStatus;
  supabase_auth_uid?: string | null;
  onboarding_template_id?: string | null;
  onboarding_envelope_id?: string | null;
  onboarding_signing_token?: string | null;
};
```

**Step 4: Commit**

```bash
git add src/types/employeeadmin.ts src/types/employeeportal.ts
git commit -m "feat(onboarding): add status, auth, and onboarding fields to types"
```

---

### Task 3: Supabase Admin Client

**Files:**
- Create: `src/lib/supabaseAdmin.ts`

**Context:** The project currently only has a client-side Supabase client using the anon key (`src/lib/supabase.ts`). The onboarding API route needs a service role client to call `auth.admin.inviteUserByEmail()`. This file is server-side only — never imported by client components.

**Step 1: Add env var to `.env`**

Add to `.env` (NOT `.env.local`, following project convention):
```
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-dashboard>
```

The actual key is retrieved from Supabase Dashboard → Settings → API → `service_role` key.

**Step 2: Create `src/lib/supabaseAdmin.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("Supabase admin client not configured — SUPABASE_SERVICE_ROLE_KEY missing");
}

export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. No components import this file yet.

**Step 4: Commit**

```bash
git add src/lib/supabaseAdmin.ts
git commit -m "feat(onboarding): add Supabase admin client for server-side auth operations"
```

---

### Task 4: Onboard Employee API Route

**Files:**
- Create: `src/app/api/employee-admin/onboard/route.ts`

**Context:** This is the core server-side endpoint. It orchestrates: (1) invite user via Supabase Auth, (2) insert ea_staff record, (3) create STS envelope from template, (4) update ea_staff with envelope/token. Follows the pattern of existing API routes like `src/app/api/paramount/send/route.ts`.

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { OnboardEmployeeRequest } from "@/types/employeeadmin";
import { RECIPIENT_COLORS } from "@/types/signedtosealed";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server not configured for admin operations" },
        { status: 500 }
      );
    }

    const body: OnboardEmployeeRequest = await req.json();
    const {
      display_name, email, branch_id, template_id,
      target_first, target_last,
      station_lease, financial_services, phorest_fee, refreshment,
      associate_pay, supervisor,
    } = body;

    // Validate required fields
    if (!display_name?.trim() || !email?.trim() || !branch_id || !template_id) {
      return NextResponse.json(
        { error: "display_name, email, branch_id, and template_id are required" },
        { status: 400 }
      );
    }

    // Use anon client for data operations (RLS is permissive)
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Step 1: Invite user via Supabase Auth ──
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: { onboarding_complete: false },
        redirectTo: `${req.headers.get("origin") || ""}/employee`,
      }
    );
    if (authError) {
      return NextResponse.json(
        { error: `Failed to create auth user: ${authError.message}` },
        { status: 500 }
      );
    }
    const authUid = authData.user.id;

    try {
      // ── Step 2: Insert ea_staff record ──
      const { data: staffRecord, error: staffError } = await supabase
        .from("ea_staff")
        .insert({
          branch_id,
          display_name: display_name.trim(),
          target_first: target_first.trim(),
          target_last: target_last.trim(),
          internal_id: 0,
          station_lease: station_lease || 0,
          financial_services: financial_services || 0,
          phorest_fee: phorest_fee || 0,
          refreshment: refreshment || 0,
          associate_pay: associate_pay ?? null,
          supervisor: supervisor?.trim() || null,
          email: email.trim(),
          is_active: true,
          sort_order: 0,
          status: "onboarding",
          supabase_auth_uid: authUid,
          onboarding_template_id: template_id,
        })
        .select()
        .single();
      if (staffError) throw new Error(`Failed to create staff record: ${staffError.message}`);

      // ── Step 3: Create STS envelope from template ──
      // 3a. Fetch template
      const { data: template, error: tplError } = await supabase
        .from("sts_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (tplError) throw new Error(`Template not found: ${tplError.message}`);

      // 3b. Create envelope
      const config = template.envelope_config || {};
      const { data: envelope, error: envError } = await supabase
        .from("sts_envelopes")
        .insert({
          title: config.title || template.name || "Onboarding Document",
          message: config.message || "",
          status: "sent",
          created_by: "system",
        })
        .select()
        .single();
      if (envError) throw new Error(`Failed to create envelope: ${envError.message}`);

      // 3c. Copy template documents
      const { data: templateDocs } = await supabase
        .from("sts_template_documents")
        .select("*")
        .eq("template_id", template_id)
        .order("sort_order");

      const docIdMap: Record<string, string> = {};
      for (const tDoc of templateDocs || []) {
        const newPath = `${envelope.id}/${Date.now()}_${tDoc.file_name}`;
        const { error: copyError } = await supabase.storage
          .from("sts-documents")
          .copy(tDoc.file_path, newPath);
        if (copyError) throw new Error(`Failed to copy document: ${copyError.message}`);

        const { data: newDoc, error: docError } = await supabase
          .from("sts_documents")
          .insert({
            envelope_id: envelope.id,
            file_name: tDoc.file_name,
            file_path: newPath,
            file_size: tDoc.file_size,
            page_count: tDoc.page_count,
            sort_order: tDoc.sort_order,
          })
          .select()
          .single();
        if (docError) throw new Error(`Failed to create document record: ${docError.message}`);
        docIdMap[tDoc.id] = newDoc.id;
      }

      // 3d. Create recipient (employee is sole signer)
      const { data: recipient, error: recipError } = await supabase
        .from("sts_recipients")
        .insert({
          envelope_id: envelope.id,
          name: display_name.trim(),
          email: email.trim(),
          role: "signer",
          signing_order: 1,
          status: "pending",
          color_hex: RECIPIENT_COLORS[0],
        })
        .select()
        .single();
      if (recipError) throw new Error(`Failed to create recipient: ${recipError.message}`);

      // 3e. Clone template fields → envelope fields
      const { data: templateFields } = await supabase
        .from("sts_template_fields")
        .select("*")
        .eq("template_id", template_id);

      for (const tf of templateFields || []) {
        const newDocId = docIdMap[tf.template_document_id];
        if (!newDocId) continue;

        await supabase.from("sts_fields").insert({
          envelope_id: envelope.id,
          document_id: newDocId,
          recipient_id: recipient.id,
          field_type: tf.field_type,
          fill_mode: tf.fill_mode,
          label: tf.label,
          page_number: tf.page_number,
          x_position: tf.x_position,
          y_position: tf.y_position,
          width: tf.width,
          height: tf.height,
          is_required: tf.is_required,
          dropdown_options: tf.dropdown_options,
        });
      }

      // ── Step 4: Update ea_staff with envelope ID and signing token ──
      const { error: updateError } = await supabase
        .from("ea_staff")
        .update({
          onboarding_envelope_id: envelope.id,
          onboarding_signing_token: recipient.access_token,
        })
        .eq("id", staffRecord.id);
      if (updateError) throw new Error(`Failed to update staff record: ${updateError.message}`);

      // ── Step 5: Log audit entry ──
      await supabase.from("sts_audit_log").insert({
        envelope_id: envelope.id,
        event_type: "envelope_created",
        actor_name: "System",
        actor_email: "system@whbcompanies.com",
        metadata: { source: "employee_onboarding", employee_id: staffRecord.id },
      });

      return NextResponse.json({
        staff: {
          ...staffRecord,
          onboarding_envelope_id: envelope.id,
          onboarding_signing_token: recipient.access_token,
        },
      });
    } catch (innerError) {
      // Rollback: delete the auth user if any subsequent step fails
      await supabaseAdmin.auth.admin.deleteUser(authUid);
      throw innerError;
    }
  } catch (err) {
    console.error("Onboard employee error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/employee-admin/onboard/route.ts
git commit -m "feat(onboarding): add API route for employee onboarding (auth invite + envelope creation)"
```

---

### Task 5: Admin Hooks — Templates + Onboard

**Files:**
- Modify: `src/lib/employeeAdminHooks.ts`

**Context:** The admin UI needs two new capabilities: (1) fetch STS templates for the onboarding modal dropdown, (2) call the onboard API route. Both are added to the existing hooks file following the same pattern as `useBranches()` and `useStaff()`.

**Step 1: Add `useTemplates` hook**

Add after the `useNameOverrides` function (at end of file):

```typescript
// ─── STS Templates (for onboarding) ─────────────────────

import type { STSTemplate } from "@/types/signedtosealed";

export function useTemplates() {
  const [templates, setTemplates] = useState<STSTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase
      .from("sts_templates")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setTemplates((data || []) as STSTemplate[]);
        setLoading(false);
      });
  }, []);

  return { templates, loading };
}
```

**Step 2: Add `onboardEmployee` function**

Add after `useTemplates`:

```typescript
// ─── Onboard Employee ────────────────────────────────────

import type { OnboardEmployeeRequest, EAStaff } from "@/types/employeeadmin";

export async function onboardEmployee(data: OnboardEmployeeRequest): Promise<EAStaff> {
  const res = await fetch("/api/employee-admin/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error || "Failed to onboard employee");
  }
  const { staff } = await res.json();
  return staff as EAStaff;
}
```

Note: Fix the import at the top of the file — `EAStaff` and `EAStaffInsert` are already imported, but `OnboardEmployeeRequest` and `STSTemplate` need to be added. Consolidate imports.

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/lib/employeeAdminHooks.ts
git commit -m "feat(onboarding): add useTemplates hook and onboardEmployee function"
```

---

### Task 6: Admin UI — Onboarding Modal + Status Columns

**Files:**
- Modify: `src/components/EmployeeAdmin.tsx`

**Context:** This is the largest UI change. We need to add: (1) an "Onboard New Employee" button, (2) an onboarding modal, (3) Status and Onboarding Doc columns to the staff table, (4) status dropdown in the edit modal replacing the active/inactive toggle. The existing component is ~725 lines.

**Step 1: Add imports**

Add to the existing imports at the top:
```typescript
import { useTemplates, onboardEmployee } from "@/lib/employeeAdminHooks";
import type { OnboardEmployeeRequest, EAStaffStatus } from "@/types/employeeadmin";
```

**Step 2: Add status badge helper**

Add above the `StaffModal` component:
```typescript
const STATUS_BADGE_STYLES: Record<EAStaffStatus, { bg: string; color: string; border: string }> = {
  active: { bg: "rgba(34,197,94,0.1)", color: "#4ade80", border: "rgba(34,197,94,0.2)" },
  onboarding: { bg: "rgba(212,175,55,0.1)", color: "#d4af37", border: "rgba(212,175,55,0.2)" },
  inactive: { bg: "rgba(156,163,175,0.1)", color: "#9ca3af", border: "rgba(156,163,175,0.2)" },
  terminated: { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" },
};

function StatusBadge({ status }: { status: EAStaffStatus }) {
  const s = STATUS_BADGE_STYLES[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}
```

**Step 3: Create `OnboardModal` component**

Add a new component below `StaffModal` and above `EmployeeAdmin`:

```typescript
interface OnboardModalProps {
  branchId: string;
  branches: EABranch[];
  onSuccess: (staff: EAStaff) => void;
  onClose: () => void;
}

function OnboardModal({ branchId, branches, onSuccess, onClose }: OnboardModalProps) {
  const { templates, loading: templatesLoading } = useTemplates();
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    branch_id: branchId,
    template_id: "",
    target_first: "",
    target_last: "",
    station_lease: "",
    financial_services: "-100",
    phorest_fee: "-10",
    refreshment: "-10",
    associate_pay: "",
    supervisor: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-split display name into first/last
  useEffect(() => {
    const parts = form.display_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      setForm((f) => ({
        ...f,
        target_first: parts[0],
        target_last: parts[parts.length - 1],
      }));
    } else if (parts.length === 1 && parts[0]) {
      setForm((f) => ({ ...f, target_first: parts[0], target_last: "" }));
    }
  }, [form.display_name]);

  const canSubmit =
    form.display_name.trim() !== "" &&
    form.email.trim() !== "" &&
    form.template_id !== "" &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: OnboardEmployeeRequest = {
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        branch_id: form.branch_id,
        template_id: form.template_id,
        target_first: form.target_first.trim(),
        target_last: form.target_last.trim(),
        station_lease: Number(form.station_lease) || 0,
        financial_services: Number(form.financial_services) || 0,
        phorest_fee: Number(form.phorest_fee) || 0,
        refreshment: Number(form.refreshment) || 0,
        ...(form.associate_pay.trim() !== "" && { associate_pay: Number(form.associate_pay) }),
        ...(form.supervisor.trim() !== "" && { supervisor: form.supervisor.trim() }),
      };
      const staff = await onboardEmployee(payload);
      onSuccess(staff);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to onboard employee");
    } finally {
      setSubmitting(false);
    }
  };

  // Reuse input/label styles from StaffModal (same pattern)
  const inputStyle: React.CSSProperties = {
    background: "var(--input-bg)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    width: "100%",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    color: "var(--text-secondary)",
    fontSize: "0.75rem",
    fontWeight: 500,
    marginBottom: "0.25rem",
    display: "block",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none" as const };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl mb-1" style={{ color: "var(--gold)" }}>
          Onboard New Employee
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Creates account, sends invite email, and assigns onboarding document
        </p>

        {error && (
          <div
            className="rounded-md p-3 mb-4 text-sm"
            style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label style={labelStyle}>Full Name *</label>
            <input
              style={inputStyle}
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="Jane Smith"
            />
          </div>
          <div className="col-span-2">
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            <select
              style={selectStyle}
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
            >
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Onboarding Template *</label>
            <select
              style={selectStyle}
              value={form.template_id}
              onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
            >
              <option value="">Select template...</option>
              {templatesLoading ? (
                <option disabled>Loading...</option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Station Lease</label>
            <input
              style={inputStyle}
              type="number"
              value={form.station_lease}
              onChange={(e) => setForm((f) => ({ ...f, station_lease: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Financial Services</label>
            <input
              style={inputStyle}
              type="number"
              value={form.financial_services}
              onChange={(e) => setForm((f) => ({ ...f, financial_services: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Phorest Fee</label>
            <input
              style={inputStyle}
              type="number"
              value={form.phorest_fee}
              onChange={(e) => setForm((f) => ({ ...f, phorest_fee: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Refreshment</label>
            <input
              style={inputStyle}
              type="number"
              value={form.refreshment}
              onChange={(e) => setForm((f) => ({ ...f, refreshment: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Associate Pay</label>
            <input
              style={inputStyle}
              type="number"
              placeholder="Empty = N/A"
              value={form.associate_pay}
              onChange={(e) => setForm((f) => ({ ...f, associate_pay: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Supervisor</label>
            <input
              style={inputStyle}
              placeholder="Empty = N/A"
              value={form.supervisor}
              onChange={(e) => setForm((f) => ({ ...f, supervisor: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            className="px-4 py-2 text-sm rounded"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded font-medium"
            style={{
              background: canSubmit ? "var(--gold)" : "var(--input-bg)",
              color: canSubmit ? "#0a0b0e" : "var(--text-muted)",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? "Creating..." : "Onboard Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Add onboarding state + button to main component**

In the `EmployeeAdmin` function body, add state:
```typescript
const [isOnboarding, setIsOnboarding] = useState(false);
```

Add the "Onboard New Employee" button next to the existing "+ Add Staff" button in the controls area (the `div` with `className="flex items-center gap-4"`):
```typescript
<button
  className="px-3 py-1.5 text-sm rounded font-medium"
  style={{ background: "var(--gold)", color: "#0a0b0e" }}
  onClick={() => setIsOnboarding(true)}
>
  Onboard New Employee
</button>
```

**Step 5: Update staff table headers and rows**

Change the table headers array from:
```typescript
["Name", "NetSuite ID", "Station Lease", "Fin. Services", "Phorest Fee", "Refreshment"]
```
to:
```typescript
["Name", "Status", "Onboarding Doc", "NetSuite ID", "Station Lease", "Fin. Services", "Phorest Fee", "Refreshment"]
```

Update `colSpan` on the empty-state `<td>` from `6` to `8`.

Add two new `<td>` cells in the staff row after the Name cell, before NetSuite ID:
```typescript
<td className="px-4 py-3 text-sm">
  <StatusBadge status={s.status || 'active'} />
</td>
<td className="px-4 py-3 text-sm">
  {s.onboarding_envelope_id ? (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={s.status === 'active' || s.status === 'inactive' || s.status === 'terminated'
        ? { background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }
        : { background: "rgba(212,175,55,0.1)", color: "#d4af37", border: "1px solid rgba(212,175,55,0.2)" }
      }
    >
      {s.status === 'onboarding' ? 'Pending' : 'Signed'}
    </span>
  ) : (
    <span className="text-xs" style={{ color: "var(--text-muted)" }}>&mdash;</span>
  )}
</td>
```

**Step 6: Update StaffModal — replace active toggle with status dropdown**

In the `StaffModal` component, add `status` to the form state:
```typescript
status: (staff?.status || 'active') as string,
```

Replace the "Active toggle — edit mode only" section with a status dropdown:
```typescript
{!isAdding && staff && (
  <div className="mt-4">
    <label style={labelStyle}>Status</label>
    <select
      style={{
        ...inputStyle,
        appearance: "none" as const,
      }}
      value={form.status}
      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
    >
      <option value="active">Active</option>
      <option value="onboarding">Onboarding</option>
      <option value="inactive">Inactive</option>
      <option value="terminated">Terminated</option>
    </select>
  </div>
)}
```

Update the payload in `handleSubmit` to include `status` and derive `is_active`:
```typescript
is_active: form.status === 'active' || form.status === 'onboarding',
status: form.status as EAStaffStatus,
```

Remove `const [localActive, setLocalActive]` and the `handleToggle` function since they're no longer needed.

**Step 7: Render the OnboardModal**

At the end of the JSX (next to where StaffModal is rendered):
```typescript
{isOnboarding && (
  <OnboardModal
    branchId={activeBranch}
    branches={branches}
    onSuccess={(newStaff) => {
      // Refetch staff to include the new record
      // The useStaff hook's refetch will pick it up
    }}
    onClose={() => setIsOnboarding(false)}
  />
)}
```

Note: We need access to `refetch` from `useStaff`. Update the destructuring to include it:
```typescript
const { staff, loading: staffLoading, addStaff, updateStaff, toggleActive, refetch } = useStaff(activeBranch);
```

Then in `onSuccess`:
```typescript
onSuccess={() => refetch()}
```

**Step 8: Update filtering logic**

The current `visibleStaff` filter uses `is_active`. Update to also respect status:
```typescript
const visibleStaff = showInactive
  ? staff
  : staff.filter((s) => s.status === 'active' || s.status === 'onboarding');
```

Update the active/inactive counts:
```typescript
const activeCount = staff.filter((s) => s.status === 'active' || s.status === 'onboarding').length;
const inactiveCount = staff.filter((s) => s.status === 'inactive' || s.status === 'terminated').length;
```

**Step 9: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 10: Commit**

```bash
git add src/components/EmployeeAdmin.tsx
git commit -m "feat(onboarding): add onboard modal, status columns, and status dropdown to Employee Admin"
```

---

### Task 7: Portal Hooks — `useEmployeeRecord`

**Files:**
- Modify: `src/lib/employeePortalHooks.ts`

**Context:** The employee portal needs a hook to fetch the full `ea_staff` record (including status and onboarding fields) for routing decisions and the onboarding page. The existing `useEmployeeFees` hook only fetches fee-related columns.

**Step 1: Add `useEmployeeRecord` hook**

Add after the `useEmployeeFees` function:

```typescript
import type { EmployeeRecord } from "@/types/employeeportal";

export function useEmployeeRecord(email: string | undefined) {
  const [record, setRecord] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecord = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    if (!email) {
      setRecord(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_staff")
        .select("id, branch_id, display_name, status, onboarding_envelope_id, onboarding_signing_token, ea_branches(name)")
        .eq("email", email)
        .in("status", ["active", "onboarding"])
        .limit(1)
        .single();
      if (err) throw err;
      setRecord(data as EmployeeRecord);
      setError(null);
    } catch (err) {
      // No record found is not an error for new employees
      setRecord(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  return { record, loading, error, refetch: fetchRecord };
}
```

**Step 2: Update `useEmployeeFees` to use status instead of is_active**

Change the query filter from:
```typescript
.eq("is_active", true);
```
to:
```typescript
.in("status", ["active", "onboarding"]);
```

This ensures onboarding employees can also see their fee data once they reach the dashboard.

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/lib/employeePortalHooks.ts
git commit -m "feat(onboarding): add useEmployeeRecord hook and update fee filter to use status"
```

---

### Task 8: Auth Hooks — Route by `ea_staff.status`

**Files:**
- Modify: `src/lib/employeeAuthHooks.ts`

**Context:** The current auth hook checks `user_metadata.onboarding_complete` for routing. We need to change it to check `ea_staff.status` instead — the single source of truth. The hook needs to fetch the employee record after login.

**Step 1: Rewrite `useEmployeeAuth`**

Replace the entire file contents:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { User } from "@supabase/supabase-js";

export function useEmployeeAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null);
  const [signingToken, setSigningToken] = useState<string | null>(null);

  // Fetch ea_staff status for routing
  const fetchEmployeeStatus = useCallback(async (email: string) => {
    const { data } = await supabase
      .from("ea_staff")
      .select("status, onboarding_signing_token")
      .eq("email", email)
      .in("status", ["active", "onboarding"])
      .limit(1)
      .single();
    if (data) {
      setEmployeeStatus(data.status);
      setSigningToken(data.onboarding_signing_token);
    } else {
      // No staff record — treat as active (legacy employee or error)
      setEmployeeStatus("active");
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email) {
        await fetchEmployeeStatus(u.email);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email) {
        await fetchEmployeeStatus(u.email);
      } else {
        setEmployeeStatus(null);
        setSigningToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchEmployeeStatus]);

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;
      return null;
    },
    []
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setEmployeeStatus(null);
    setSigningToken(null);
  }, []);

  // Derived routing state
  const needsOnboarding = employeeStatus === "onboarding" && signingToken != null;
  const onboardingComplete = employeeStatus === "active";

  return {
    user,
    loading,
    onboardingComplete,
    needsOnboarding,
    signingToken,
    employeeStatus,
    login,
    logout,
  };
}
```

**Key changes:**
- Removed `completeOnboarding()` — the DB trigger handles this now
- Added `fetchEmployeeStatus()` — queries `ea_staff` for status and signing token
- Added `needsOnboarding` derived state — `true` when status is `onboarding` and signing token exists
- Kept `onboardingComplete` for backward compatibility — derived from `status === 'active'`

**Step 2: Verify build**

Run: `npm run build`
Expected: May have build errors in components that used `completeOnboarding`. The `OnboardingPage.tsx` uses it — that's fine since we're replacing it in the next task.

**Step 3: Commit**

```bash
git add src/lib/employeeAuthHooks.ts
git commit -m "feat(onboarding): update auth hooks to route by ea_staff.status"
```

---

### Task 9: Onboarding Document Component

**Files:**
- Rewrite: `src/components/employee-portal/OnboardingPage.tsx`

**Context:** The current `OnboardingPage.tsx` is a placeholder with a "Continue to Dashboard" button. We're replacing it with `OnboardingDocument` that shows the employee's onboarding status and a link to sign their document. The file stays as `OnboardingPage.tsx` to avoid changing the page route import.

**Step 1: Rewrite `src/components/employee-portal/OnboardingPage.tsx`**

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import { useEmployeeRecord } from "@/lib/employeePortalHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function OnboardingPage() {
  const { user, loading: authLoading, needsOnboarding, onboardingComplete } = useEmployeeAuth();
  const { record, loading: recordLoading } = useEmployeeRecord(user?.email ?? undefined);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/employee");
    } else if (!authLoading && onboardingComplete) {
      router.replace("/employee/dashboard");
    }
  }, [authLoading, user, onboardingComplete, router]);

  const loading = authLoading || recordLoading;

  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <p style={{ color: "var(--text-muted)" }} className="font-sans text-sm">
          Loading...
        </p>
      </div>
    );
  }

  const signingUrl = record?.onboarding_signing_token
    ? `/signed-to-sealed/sign?token=${record.onboarding_signing_token}`
    : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 border text-center"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <Image
          src="/whb-legacy-vert-bw.png"
          alt="WHB Legacy"
          width={80}
          height={66}
          className="object-contain mx-auto"
          style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
        />
        <h1
          className="font-serif text-2xl mt-6"
          style={{ color: "var(--gold)" }}
        >
          Welcome to WHB Companies
        </h1>
        <p
          className="font-sans text-sm mt-3 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {record?.display_name
            ? `Hi ${record.display_name}, before you can access your dashboard, please review and sign your onboarding document.`
            : "Before you can access your dashboard, please review and sign your onboarding document."}
        </p>

        {record?.ea_branches?.name && (
          <p className="font-sans text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Branch: {record.ea_branches.name}
          </p>
        )}

        {signingUrl ? (
          <a
            href={signingUrl}
            className="mt-8 w-full py-2.5 rounded-md font-sans text-sm font-medium tracking-wide transition-opacity inline-block"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              textDecoration: "none",
            }}
          >
            Review &amp; Sign Your Document
          </a>
        ) : (
          <p className="mt-8 font-sans text-sm" style={{ color: "var(--text-muted)" }}>
            No onboarding document assigned. Please contact your administrator.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. The page route at `src/app/employee/onboarding/page.tsx` already imports from this file.

**Step 3: Commit**

```bash
git add src/components/employee-portal/OnboardingPage.tsx
git commit -m "feat(onboarding): replace placeholder onboarding page with document signing flow"
```

---

### Task 10: Login Page — Update Routing

**Files:**
- Modify: `src/components/employee-portal/LoginPage.tsx`

**Context:** The login page currently routes based on `onboardingComplete`. We need it to also check `needsOnboarding` so employees in the onboarding state go to the right page.

**Step 1: Update redirect logic**

Change the import to include `needsOnboarding`:
```typescript
const { user, loading, onboardingComplete, needsOnboarding, login } = useEmployeeAuth();
```

Update the redirect `useEffect`:
```typescript
useEffect(() => {
  if (!loading && user) {
    if (needsOnboarding) {
      router.replace("/employee/onboarding");
    } else {
      router.replace("/employee/dashboard");
    }
  }
}, [loading, user, needsOnboarding, router]);
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/employee-portal/LoginPage.tsx
git commit -m "feat(onboarding): update login page routing for onboarding status"
```

---

### Task 11: Dashboard Enhancement — Onboarding Document Section

**Files:**
- Modify: `src/components/employee-portal/Dashboard.tsx`

**Context:** The dashboard should show an "Onboarding Documents" section when the employee has an `onboarding_envelope_id`. Shows signed/pending status with a link to re-open the signing view if still pending.

**Step 1: Add `useEmployeeRecord` import and hook call**

Add import:
```typescript
import { useEmployeeFees, useEmployeeRecord } from "@/lib/employeePortalHooks";
```

Add hook call inside the `Dashboard` component (after the existing hooks):
```typescript
const { record } = useEmployeeRecord(user?.email ?? undefined);
```

**Step 2: Add onboarding document section**

Insert after the `<h2>Your Fee Summary</h2>` heading, before the error display:

```typescript
{/* Onboarding Document Status */}
{record?.onboarding_envelope_id && (
  <div
    className="rounded-lg border p-5 mb-6"
    style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
  >
    <h3
      className="font-serif text-base mb-3"
      style={{ color: "var(--text-primary)" }}
    >
      Onboarding Documents
    </h3>
    <div className="flex items-center justify-between">
      <span className="font-sans text-sm" style={{ color: "var(--text-secondary)" }}>
        Onboarding Agreement
      </span>
      <div className="flex items-center gap-3">
        {record.status === "onboarding" ? (
          <>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(212,175,55,0.1)",
                color: "#d4af37",
                border: "1px solid rgba(212,175,55,0.2)",
              }}
            >
              Pending Signature
            </span>
            {record.onboarding_signing_token && (
              <a
                href={`/signed-to-sealed/sign?token=${record.onboarding_signing_token}`}
                className="text-xs font-medium"
                style={{ color: "var(--gold)" }}
              >
                Sign Now
              </a>
            )}
          </>
        ) : (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(34,197,94,0.1)",
              color: "#4ade80",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            Signed
          </span>
        )}
      </div>
    </div>
  </div>
)}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/employee-portal/Dashboard.tsx
git commit -m "feat(onboarding): add onboarding document status section to employee dashboard"
```

---

### Task 12: Final Verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with no TypeScript or ESLint errors.

**Step 2: Dev server smoke test**

Run: `npm run dev`

Manual test checklist:
- [ ] `/employee-admin` loads — see Status and Onboarding Doc columns (existing staff show "active" and "—")
- [ ] "Onboard New Employee" button opens modal with template dropdown
- [ ] Status dropdown appears in edit modal (replaces active/inactive toggle)
- [ ] `/employee` login page loads
- [ ] `/employee/onboarding` shows signing CTA (for onboarding employees)
- [ ] `/employee/dashboard` shows onboarding document section (for employees with envelope)

**Step 3: Commit any final fixes**

If any issues are found during smoke testing, fix and commit individually.

---

## Task Dependency Graph

```
Task 1 (DB Migration)
  └→ Task 2 (Types)
       └→ Task 3 (supabaseAdmin) ─────────────────┐
       └→ Task 7 (Portal Hooks)                    │
            └→ Task 8 (Auth Hooks)                 │
                 └→ Task 9 (Onboarding Component)  │
                 └→ Task 10 (Login Routing)         │
            └→ Task 11 (Dashboard Enhancement)      │
       └→ Task 5 (Admin Hooks) ────────────────────┤
            └→ Task 6 (Admin UI)                   │
       └→ Task 4 (API Route) ←────────────────────┘
  Task 12 (Final Verification) — depends on all above
```

**Parallelizable groups:**
- Tasks 3, 5, 7 can run in parallel (after Task 2)
- Tasks 4, 6 can run in parallel (after Tasks 3+5)
- Tasks 8, 9, 10, 11 must be sequential (auth hooks → components)
