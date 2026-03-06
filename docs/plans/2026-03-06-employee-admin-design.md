# Employee Administration Micro-App Design

**Date:** 2026-03-06
**Status:** Approved
**Route:** `/employee-admin`

## Objective

Move employee payroll configuration from hardcoded values in `src/lib/payrollConfig.ts` into Supabase, managed through a new CRUD UI. The Payout Suite continues to work unchanged via a compatibility fetch function.

## Database Schema

Three new tables with `ea_` prefix.

### `ea_branches`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `branch_id` | `text` UNIQUE NOT NULL | Phorest branch ID |
| `name` | `text` NOT NULL | Full branch name |
| `abbreviation` | `text` NOT NULL | Short name (e.g., "WHS MH") |
| `subsidiary_id` | `integer` NOT NULL | NetSuite subsidiary |
| `account` | `integer` NOT NULL | NetSuite account |
| `display_order` | `integer` NOT NULL | UI tab ordering |
| `created_at` | `timestamptz` | Default `now()` |

### `ea_staff`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `branch_id` | `text` NOT NULL | FK to `ea_branches.branch_id` |
| `display_name` | `text` NOT NULL | Config key name |
| `target_first` | `text` NOT NULL | Phorest first name match |
| `target_last` | `text` NOT NULL | Phorest last name match |
| `internal_id` | `integer` NOT NULL DEFAULT 0 | NetSuite internal ID |
| `station_lease` | `numeric` NOT NULL DEFAULT 0 | Negative number |
| `financial_services` | `numeric` NOT NULL DEFAULT 0 | Fee |
| `phorest_fee` | `numeric` NOT NULL DEFAULT 0 | Fee |
| `refreshment` | `numeric` NOT NULL DEFAULT 0 | Fee |
| `associate_pay` | `numeric` NULL | Hourly rate if associate |
| `supervisor` | `text` NULL | Supervisor name if associate |
| `is_active` | `boolean` NOT NULL DEFAULT true | Soft delete toggle |
| `sort_order` | `integer` NOT NULL DEFAULT 0 | XLSX output ordering |
| `created_at` | `timestamptz` | Default `now()` |

UNIQUE constraint on `(branch_id, display_name)`.

### `ea_name_overrides`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `branch_id` | `text` NOT NULL | FK to `ea_branches.branch_id` |
| `phorest_name` | `text` NOT NULL | Name as appears in Phorest |
| `staff_display_name` | `text` NOT NULL | Maps to `ea_staff.display_name` |

UNIQUE constraint on `(branch_id, phorest_name)`.

## UI Layout

Single-page with branch tabs at top. Each branch tab shows:

1. **Staff table** — columns: Name, NetSuite ID, Station Lease, Financial Services, Phorest Fee, Refreshment. Associate badge if applicable. Click row to open edit modal. "Show Inactive" toggle for soft-deleted rows.
2. **Name Overrides table** — below staff table. Columns: Phorest Name, Maps To, Delete button. Add button for new overrides.
3. **Add Staff button** — opens modal in create mode.

No branch editing UI — branch config (name, subsidiary, account) rarely changes.

## Data Flow

```
ea_branches + ea_staff + ea_name_overrides
        |
        v
fetchBranchConfigs()  -- returns BranchConfig[] (same shape as today)
        |
        v
payrollTransform.ts, payrollExcel.ts, colorChargesParser.ts (unchanged)
```

`fetchBranchConfigs()` added to `payrollConfig.ts`. Queries all three tables, assembles into the existing `BranchConfig[]` shape.

## Migration Strategy

1. Create tables via `supabase-employeeadmin-schema.sql`
2. Seed all current data via `supabase-employeeadmin-seed.sql` (~130 staff, 5 branches, 2 name overrides)
3. Add `fetchBranchConfigs()` to `payrollConfig.ts`
4. Update `PayoutSuite.tsx` and API route to call `fetchBranchConfigs()` instead of importing `BRANCHES`
5. Delete hardcoded staff constants and order arrays from `payrollConfig.ts`

## File Inventory

### New files

| File | Purpose |
|------|---------|
| `supabase-employeeadmin-schema.sql` | Table definitions |
| `supabase-employeeadmin-seed.sql` | Seed data from current config |
| `src/types/employeeadmin.ts` | TypeScript types |
| `src/lib/employeeAdminHooks.ts` | CRUD hooks with optimistic UI |
| `src/components/EmployeeAdmin.tsx` | Main UI component |
| `src/app/employee-admin/page.tsx` | Page route with PasswordGate |

### Modified files

| File | Change |
|------|--------|
| `src/lib/payrollConfig.ts` | Delete hardcoded data, add `fetchBranchConfigs()` |
| `src/components/PayoutSuite.tsx` | Use `fetchBranchConfigs()` instead of `BRANCHES` |
| `src/app/api/phorest/payroll/route.ts` | Use `fetchBranchConfigs()` instead of `BRANCHES` |

### Unchanged

- `payrollTransform.ts`, `payrollExcel.ts`, `colorChargesParser.ts` — consume `BranchConfig` type only

## Constraints

- Client-side Supabase SDK for all data access
- No new dependencies
- Follows existing patterns: `PasswordGate`, CSS custom properties, gold accent theme
- Single-file component approach
