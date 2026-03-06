# Employee Administration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CRUD micro-app at `/employee-admin` that manages salon employee payroll configuration in Supabase, replacing the hardcoded data in `payrollConfig.ts`.

**Architecture:** Three new Supabase tables (`ea_branches`, `ea_staff`, `ea_name_overrides`) store the data. A compatibility function `fetchBranchConfigs()` returns the same `BranchConfig[]` shape so all Payout Suite consumers work unchanged. The UI is a single-page component with branch tabs, a staff table, edit modal, and name overrides section.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase client SDK, Tailwind CSS 3 with CSS custom properties.

**Design doc:** `docs/plans/2026-03-06-employee-admin-design.md`

---

## Task 1: Database Schema

**Files:**
- Create: `supabase-employeeadmin-schema.sql`

**Step 1: Write the schema SQL**

Follow the pattern in `supabase-paramount-schema.sql`. Three tables with `ea_` prefix:

```sql
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
```

**Step 2: Run the schema in Supabase**

Execute the SQL in the Supabase SQL Editor (dashboard) against the project database. Verify all three tables appear in the Table Editor.

**Step 3: Commit**

```bash
git add supabase-employeeadmin-schema.sql
git commit -m "feat: add employee admin schema (ea_branches, ea_staff, ea_name_overrides)"
```

---

## Task 2: Seed Data

**Files:**
- Create: `supabase-employeeadmin-seed.sql`
- Reference: `src/lib/payrollConfig.ts` (read-only — source of truth for all current data)

**Step 1: Write the seed SQL**

Generate INSERT statements from the hardcoded data in `payrollConfig.ts`. This is ~130 staff rows across 5 branches plus 2 name overrides.

Branch inserts (order matches tab display):

```sql
-- Branches
INSERT INTO ea_branches (branch_id, name, abbreviation, subsidiary_id, account, display_order) VALUES
('MQxU0-XtU5feIqq2iWBVgw', 'William Henry Salon Mount Holly', 'WHS MH', 5, 111, 1),
('8M4TophXdPSUruaequULaw', 'William Henry Salon McAdenville', 'WHS MCAD', 6, 111, 2),
('5xgjrXAIiFwmt0XheOoHng', 'William Henry Signature Salon Belmont', 'WHS BEL', 5, 111, 3),
('Sil3zmgt4KE4RYWqWnx-hQ', 'William Henry The Spa', 'WHS SPA', 5, 111, 4),
('yrr4_ACmrRVr0J3NoC2s2Q', 'Ballards Barbershop', 'BALLARDS', 7, 111, 5);
```

Staff inserts: For each branch, iterate through the staff config in `payrollConfig.ts` and generate rows. Use `sort_order` based on the position in the corresponding `*_ORDER` array. Include all fields: `display_name`, `target_first`, `target_last`, `internal_id`, `station_lease`, `financial_services`, `phorest_fee`, `refreshment`, `associate_pay`, `supervisor`, `is_active` (default true), `sort_order`.

Name override inserts (only Mount Holly has them currently):

```sql
-- Name overrides
INSERT INTO ea_name_overrides (branch_id, phorest_name, staff_display_name) VALUES
('MQxU0-XtU5feIqq2iWBVgw', 'Olivia Cornette', 'Olivia Wilson'),
('MQxU0-XtU5feIqq2iWBVgw', 'Maddie Shultz', 'Maddie Schultz');
```

**Important:** Every single staff member from `payrollConfig.ts` must be represented. Cross-reference against:
- `MOUNT_HOLLY_STAFF` / `MOUNT_HOLLY_ORDER` (23 staff)
- `MCADENVILLE_STAFF` / `MCADENVILLE_ORDER` (26 staff)
- `BELMONT_STAFF` / `BELMONT_ORDER` (43 staff)
- `SPA_STAFF` / `SPA_ORDER` (20 staff)
- `BALLARDS_STAFF` / `BALLARDS_ORDER` (14 staff)

Total: 126 staff rows.

**Step 2: Run the seed in Supabase**

Execute the SQL in the Supabase SQL Editor. Verify row counts:
- `ea_branches`: 5 rows
- `ea_staff`: 126 rows
- `ea_name_overrides`: 2 rows

**Step 3: Commit**

```bash
git add supabase-employeeadmin-seed.sql
git commit -m "feat: add employee admin seed data from payrollConfig.ts"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/types/employeeadmin.ts`
- Reference: `src/types/paramount.ts` and `src/types/timeclock.ts` for pattern

**Step 1: Write the types**

```typescript
// Employee Administration Types
// Tables use ea_ prefix

export interface EABranch {
  id: string;
  branch_id: string;
  name: string;
  abbreviation: string;
  subsidiary_id: number;
  account: number;
  display_order: number;
  created_at: string;
}

export interface EAStaff {
  id: string;
  branch_id: string;
  display_name: string;
  target_first: string;
  target_last: string;
  internal_id: number;
  station_lease: number;
  financial_services: number;
  phorest_fee: number;
  refreshment: number;
  associate_pay: number | null;
  supervisor: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type EAStaffInsert = Omit<EAStaff, "id" | "created_at">;
export type EAStaffUpdate = Partial<Omit<EAStaff, "id" | "created_at" | "branch_id">>;

export interface EANameOverride {
  id: string;
  branch_id: string;
  phorest_name: string;
  staff_display_name: string;
}

export type EANameOverrideInsert = Omit<EANameOverride, "id">;
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/types/employeeadmin.ts
git commit -m "feat: add employee admin TypeScript types"
```

---

## Task 4: CRUD Hooks

**Files:**
- Create: `src/lib/employeeAdminHooks.ts`
- Reference: `src/lib/timeClockHooks.ts` (pattern for `useCompanies`, `useEmployees`)

**Step 1: Write the hooks**

Three hooks following the established pattern: `useState` + `useEffect` fetch + CRUD methods + optimistic updates.

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  EABranch,
  EAStaff,
  EAStaffInsert,
  EAStaffUpdate,
  EANameOverride,
  EANameOverrideInsert,
} from "@/types/employeeadmin";
```

**`useBranches()`** — Fetches `ea_branches` ordered by `display_order`. Read-only (no CRUD needed per design). Returns `{ branches, loading, error }`.

**`useStaff(branchId: string)`** — Fetches `ea_staff` filtered by `branch_id`, ordered by `sort_order`. Refetches when `branchId` changes. Methods:
- `addStaff(insert: EAStaffInsert): Promise<EAStaff>` — inserts, appends to state
- `updateStaff(id: string, updates: EAStaffUpdate): Promise<void>` — updates, patches in state
- `toggleActive(id: string, isActive: boolean): Promise<void>` — convenience wrapper on updateStaff
- Returns `{ staff, loading, error, addStaff, updateStaff, toggleActive, refetch }`

Include both active and inactive staff in the query (UI controls visibility with a toggle).

**`useNameOverrides(branchId: string)`** — Fetches `ea_name_overrides` filtered by `branch_id`. Methods:
- `addOverride(insert: EANameOverrideInsert): Promise<EANameOverride>` — inserts
- `deleteOverride(id: string): Promise<void>` — deletes
- Returns `{ overrides, loading, error, addOverride, deleteOverride, refetch }`

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/lib/employeeAdminHooks.ts
git commit -m "feat: add employee admin CRUD hooks"
```

---

## Task 5: Page Route

**Files:**
- Create: `src/app/employee-admin/page.tsx`
- Reference: `src/app/payout-suite/page.tsx` (exact pattern)

**Step 1: Write the page**

```tsx
import PasswordGate from "@/components/PasswordGate";
import EmployeeAdmin from "@/components/EmployeeAdmin";

export const metadata = {
  title: "Employee Admin | WHB Command Center",
};

export default function EmployeeAdminPage() {
  return (
    <PasswordGate>
      <EmployeeAdmin />
    </PasswordGate>
  );
}
```

**Step 2: Create a placeholder component**

Create `src/components/EmployeeAdmin.tsx` with a minimal placeholder so the route compiles:

```tsx
"use client";

export default function EmployeeAdmin() {
  return <div style={{ color: "var(--text-primary)", padding: "2rem" }}>Employee Admin — loading...</div>;
}
```

**Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 4: Commit**

```bash
git add src/app/employee-admin/page.tsx src/components/EmployeeAdmin.tsx
git commit -m "feat: add employee-admin route with placeholder component"
```

---

## Task 6: Employee Admin UI

**Files:**
- Modify: `src/components/EmployeeAdmin.tsx` (replace placeholder with full component)
- Reference: `src/components/PayoutSuite.tsx` for layout patterns, `src/components/PasswordGate.tsx` for styling patterns, `src/app/globals.css` for CSS variables

This is the largest task. The component has these sections:

**6a: Layout shell with branch tabs**

- Import hooks: `useBranches`, `useStaff`, `useNameOverrides` from `@/lib/employeeAdminHooks`
- Import `useTheme` from `@/lib/theme`
- State: `activeBranch` (string, first branch's `branch_id`), `showInactive` (boolean)
- Header: "Employee Administration" in Cormorant Garamond, gold accent
- Home link (top-left, links to `/`)
- Theme toggle (top-right)
- Branch tabs: horizontal row, gold underline on active tab, click to switch `activeBranch`
- All colors use CSS variables: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--gold`, `--border-color`, `--card-bg`, `--input-bg`

**6b: Staff table**

- Columns: Name, NetSuite ID, Station Lease, Fin. Services, Phorest Fee, Refreshment
- Associate badge: small pill/tag next to name if `supervisor` is set (text: "Associate")
- Row styling: inactive rows dimmed (opacity 0.5) and only shown when `showInactive` is true
- Click row -> open edit modal
- "Show Inactive" toggle checkbox above table
- "+ Add Staff" button in header area
- Empty state if no staff for branch
- Staff count summary: "N active, M inactive"

**6c: Edit/Add modal**

- Modal overlay (dark backdrop, centered card)
- Fields: Display Name, Target First, Target Last, NetSuite Internal ID, Station Lease, Financial Services, Phorest Fee, Refreshment, Associate Pay (optional), Supervisor (optional), Sort Order
- In edit mode: pre-filled with current values, "Save" and "Cancel" buttons, active/inactive toggle
- In create mode: empty fields, `branch_id` set automatically, "Add" and "Cancel" buttons
- Validation: display_name, target_first, target_last required
- On save: call `addStaff` or `updateStaff` from hook, close modal

**6d: Name Overrides section**

- Below staff table, separated by a heading
- Small table: Phorest Name, Maps To, delete (x) button
- "+ Add Override" button opens inline form (two text inputs + "Add" button), not a modal
- Count in heading: "Name Overrides (N)"

**Styling rules (from globals.css):**
- Background: `var(--bg-primary)` for page, `var(--bg-secondary)` for cards/modal
- Text: `var(--text-primary)`, `var(--text-secondary)` for muted
- Borders: `var(--border-color)`
- Inputs: `var(--input-bg)` background
- Gold buttons: `background: var(--gold)`, `color: #0a0b0e`
- Table header: `var(--text-muted)`, uppercase, small text
- Font: headings use `font-serif` (Cormorant Garamond), body uses `font-sans` (DM Sans)

**Step 1: Implement the full component**

Write `src/components/EmployeeAdmin.tsx` with all four sections above. Single file, all state managed locally.

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Manual test**

Run: `npm run dev`
Navigate to `http://localhost:3000/employee-admin`, enter password, verify:
- Branch tabs render and switch
- Staff table loads data from Supabase
- Can add a new staff member
- Can edit an existing staff member
- Can toggle active/inactive
- Name overrides section loads and CRUD works

**Step 4: Commit**

```bash
git add src/components/EmployeeAdmin.tsx
git commit -m "feat: add Employee Admin UI with branch tabs, staff table, edit modal, and name overrides"
```

---

## Task 7: Compatibility Layer (fetchBranchConfigs)

**Files:**
- Modify: `src/lib/payrollConfig.ts`

This is the bridge that lets Payout Suite read from the DB instead of hardcoded constants.

**Step 1: Add `fetchBranchConfigs()` to `payrollConfig.ts`**

Add this function alongside the existing exports. It queries all three `ea_*` tables and assembles the same `BranchConfig[]` shape:

```typescript
import { supabase } from "./supabase";

export async function fetchBranchConfigs(): Promise<BranchConfig[]> {
  const [branchRes, staffRes, overrideRes] = await Promise.all([
    supabase.from("ea_branches").select("*").order("display_order"),
    supabase.from("ea_staff").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("ea_name_overrides").select("*"),
  ]);

  if (branchRes.error) throw branchRes.error;
  if (staffRes.error) throw staffRes.error;
  if (overrideRes.error) throw overrideRes.error;

  const branches = branchRes.data || [];
  const allStaff = staffRes.data || [];
  const allOverrides = overrideRes.data || [];

  return branches.map((b) => {
    const branchStaff = allStaff.filter((s) => s.branch_id === b.branch_id);
    const branchOverrides = allOverrides.filter((o) => o.branch_id === b.branch_id);

    const staffConfig: Record<string, StaffMember> = {};
    const staffOrder: string[] = [];

    for (const s of branchStaff) {
      staffConfig[s.display_name] = {
        targetFirst: s.target_first,
        targetLast: s.target_last,
        internalId: s.internal_id,
        stationLease: Number(s.station_lease),
        financialServices: Number(s.financial_services),
        phorestFee: Number(s.phorest_fee),
        refreshment: Number(s.refreshment),
        associatePay: s.associate_pay != null ? Number(s.associate_pay) : null,
        supervisor: s.supervisor,
      };
      staffOrder.push(s.display_name);
    }

    const employeePurchaseNameMap: Record<string, string> = {};
    for (const o of branchOverrides) {
      employeePurchaseNameMap[o.phorest_name] = o.staff_display_name;
    }

    return {
      branchId: b.branch_id,
      name: b.name,
      abbreviation: b.abbreviation,
      subsidiaryId: b.subsidiary_id,
      account: b.account,
      staffConfig,
      staffOrder,
      employeePurchaseNameMap,
    };
  });
}
```

**Important:** Supabase returns `numeric` columns as strings. Wrap with `Number()` to convert back to the `number` type that `StaffMember` expects.

Do NOT delete the hardcoded data yet — that happens in Task 9 after verification.

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/lib/payrollConfig.ts
git commit -m "feat: add fetchBranchConfigs() compatibility layer for DB-backed config"
```

---

## Task 8: Wire Payout Suite to DB Config

**Files:**
- Modify: `src/components/PayoutSuite.tsx`
- Modify: `src/app/api/phorest/payroll/route.ts`

**Step 1: Update PayoutSuite.tsx**

Change imports:
```typescript
// BEFORE:
import { BRANCHES, isBranchConfigured, computePayDate, branchSlug } from "@/lib/payrollConfig";

// AFTER:
import { fetchBranchConfigs, computePayDate, branchSlug as branchSlugFn } from "@/lib/payrollConfig";
import type { BranchConfig } from "@/lib/payrollConfig";
```

Add state and fetch for branches:
```typescript
const [BRANCHES, setBranches] = useState<BranchConfig[]>([]);
const [branchesLoading, setBranchesLoading] = useState(true);

useEffect(() => {
  fetchBranchConfigs().then((configs) => {
    setBranches(configs);
    setBranchesLoading(false);
  }).catch((err) => {
    console.error("Failed to fetch branch configs:", err);
    setBranchesLoading(false);
  });
}, []);
```

Replace all calls to `isBranchConfigured(branchId)` with inline check:
```typescript
const isBranchConfigured = (branchId: string) => {
  const branch = BRANCHES.find((b) => b.branchId === branchId);
  return !!branch && Object.keys(branch.staffConfig).length > 0;
};
```

The `branchSlug` function currently reads from hardcoded `BRANCHES`. After migration, update it to accept the branch array or make `PayoutSuite` pass slug directly. The simplest approach: keep `branchSlug` in `payrollConfig.ts` but make it accept an optional `BranchConfig[]` parameter, or just inline the slug logic where needed.

Add a loading state at the top of the render: if `branchesLoading`, show a spinner or "Loading branches...".

**Step 2: Update API route**

In `src/app/api/phorest/payroll/route.ts`, the route currently calls `getBranchConfig(branchId)` and `isBranchConfigured(branchId)` which read from the hardcoded `BRANCHES` array. Change to:

```typescript
import { fetchBranchConfigs, computePayPeriodConfig, branchSlug } from "@/lib/payrollConfig";

// Inside POST handler, before using branch config:
const allBranches = await fetchBranchConfigs();
const branch = allBranches.find((b) => b.branchId === branchId);
```

Replace `getBranchConfig(branchId)` with the find above. Replace `isBranchConfigured(branchId)` with `!branch || Object.keys(branch.staffConfig).length === 0`.

The `branchSlug` function is also called in this file for storage paths. Update it similarly — either pass the fetched branches or inline the slug logic.

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 4: Manual verification**

Run `npm run dev`. Navigate to `/payout-suite`. Verify:
- Branch tabs still load correctly
- Running a payroll for Mount Holly or Ballards (a configured branch) still works end-to-end
- The generated XLSX matches previous output

**Step 5: Commit**

```bash
git add src/components/PayoutSuite.tsx src/app/api/phorest/payroll/route.ts
git commit -m "feat: wire Payout Suite to DB-backed branch config via fetchBranchConfigs"
```

---

## Task 9: Clean Up Hardcoded Data

**Files:**
- Modify: `src/lib/payrollConfig.ts`

**Step 1: Delete hardcoded constants**

Remove from `payrollConfig.ts`:
- `MOUNT_HOLLY_STAFF`, `MOUNT_HOLLY_ORDER`
- `MCADENVILLE_STAFF`, `MCADENVILLE_ORDER`
- `BELMONT_STAFF`, `BELMONT_ORDER`
- `SPA_STAFF`, `SPA_ORDER`
- `BALLARDS_STAFF`, `BALLARDS_ORDER`
- `BRANCHES` export (the const array)
- `getBranchConfig()` function (replaced by fetch)
- `isBranchConfigured()` function (inlined in consumers)

**Keep:**
- `StaffMember`, `BranchConfig`, `PayPeriodConfig` interfaces
- `computePayDate()`, `computePayPeriodConfig()`
- `NEW_GUEST_SOURCES`
- `branchSlug()` (update to accept branches array or make it work without hardcoded data)
- `fetchBranchConfigs()` (added in Task 7)

**Step 2: Fix any remaining imports**

Search for any other files importing `BRANCHES`, `getBranchConfig`, or `isBranchConfigured` from `payrollConfig`:

```bash
grep -r "BRANCHES\|getBranchConfig\|isBranchConfigured" src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining references.

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 4: Verify build**

Run: `npm run build`
Expected: Successful build with no errors.

**Step 5: Commit**

```bash
git add src/lib/payrollConfig.ts
git commit -m "refactor: remove hardcoded staff/branch data from payrollConfig.ts (now in Supabase)"
```

---

## Task 10: Add to Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add Employee Admin card to the landing page app selector**

Read `src/app/page.tsx` first to understand the current layout. Add a new card/link for Employee Admin following the same pattern as the other micro-app cards. Link to `/employee-admin`.

**Step 2: Verify**

Run `npm run dev`, navigate to `/`, verify the new card appears and links correctly.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add Employee Admin to landing page app selector"
```

---

## Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Employee Admin to project documentation**

Update the following sections:
- **Project Overview**: Add item 6 for Employee Admin
- **Routing**: Add `/employee-admin` route
- **Data Layer**: Add `src/lib/employeeAdminHooks.ts` entry
- **Type Definitions**: Add `employeeadmin.ts`
- **Component Structure**: Mention `EmployeeAdmin.tsx`
- **Database**: Add `supabase-employeeadmin-schema.sql` entry with table names and `ea_` prefix

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Employee Admin to CLAUDE.md project documentation"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `supabase-employeeadmin-schema.sql` | Database tables |
| 2 | `supabase-employeeadmin-seed.sql` | Seed current data |
| 3 | `src/types/employeeadmin.ts` | TypeScript types |
| 4 | `src/lib/employeeAdminHooks.ts` | CRUD hooks |
| 5 | `src/app/employee-admin/page.tsx`, `src/components/EmployeeAdmin.tsx` | Route + placeholder |
| 6 | `src/components/EmployeeAdmin.tsx` | Full UI component |
| 7 | `src/lib/payrollConfig.ts` | `fetchBranchConfigs()` |
| 8 | `src/components/PayoutSuite.tsx`, `src/app/api/phorest/payroll/route.ts` | Wire Payout Suite to DB |
| 9 | `src/lib/payrollConfig.ts` | Delete hardcoded data |
| 10 | `src/app/page.tsx` | Landing page link |
| 11 | `CLAUDE.md` | Documentation |

Tasks 1-6 can be done independently of 7-9. Tasks 7-9 must be sequential. Task 10-11 are independent cleanup.
