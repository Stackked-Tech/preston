# Payroll Storage & History — Design

## Problem

Payroll XLSX files are generated in-memory and returned as base64. Nothing is persisted. If the user closes the tab, the file is gone. Users need to browse and download past payroll runs.

## Decision: No Database Table

All metadata is encoded in the storage path. No `payroll_runs` table. Filenames are structured with prefixed segments for unambiguous parsing.

## Storage

- **Bucket**: `payroll` (new, public, permissive RLS)
- **Path**: `{branch-slug}/run-{YYYY-MM-DDTHH:mm:ss}_period-{start}_to_{end}_pay-{paydate}.xlsx`
- **Example**: `mount-holly/run-2026-02-25T14:30:22_period-2026-02-01_to_2026-02-14_pay-2026-02-19.xlsx`

Branch slugs: `whs-mount-holly`, `whs-mcadenville`, `whs-belmont`, `whs-the-spa`, `whs-ballards`

## API Route Changes

After XLSX buffer generation, upload to Supabase storage server-side. Return base64 + filePath in response. If upload fails, return data with a warning — don't fail the run.

## History UI

Per-branch collapsible "Past Runs" section below current results in each branch tab. Loads via `supabase.storage.list()` on tab switch. Each filename parsed into run date, pay period, pay date. Sorted newest-first. Date range filter on run date. No delete UI.

## Files Touched

- `src/app/api/phorest/payroll/route.ts` — storage upload
- `src/components/PayoutSuite.tsx` — Past Runs section
- Supabase dashboard — create bucket + RLS policy
