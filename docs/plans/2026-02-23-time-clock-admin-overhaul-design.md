# Time Clock Admin Overhaul — Design

**Date:** 2026-02-23
**Approach:** Evolve existing time clock app in place

## Summary

Transform the R Alexander Time Clock from an employee-oriented time tracker into a multi-company contractor management system with manager approval workflow and NetSuite-ready export. Key changes: multi-company support, contractor terminology, billable rates, approval queue, crew batch entry, remove overtime logic, kiosk/mobile optimization.

## Data Model Changes

### New Table: `tc_companies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Company name |
| `is_active` | BOOLEAN | Default true |
| `created_at` | TIMESTAMPTZ | Auto |

### Modified: `tc_employees` (UI label: "Contractors")

| Change | Detail |
|--------|--------|
| Add `company_id` | UUID FK → `tc_companies` (required) |
| Add `billable_rate` | DECIMAL — hourly rate set by admin |
| DB column names unchanged | `employee_number` stays in DB, displayed as "Resource Number" in UI |

### Modified: `tc_jobs`

| Change | Detail |
|--------|--------|
| Add `company_id` | UUID FK → `tc_companies` (required) |
| Jobs scoped per company | Contractors only see jobs for their company during clock-in |

### Modified: `tc_time_entries`

| Change | Detail |
|--------|--------|
| Add `approval_status` | TEXT — `'pending'` / `'approved'` / `'flagged'`. Default `'pending'` |
| Add `approved_by` | TEXT — approver name (nullable) |
| Add `approved_at` | TIMESTAMPTZ (nullable) |
| Add `flag_note` | TEXT — reason if flagged (nullable) |

### Removals

- `tc_settings` overtime keys (`daily_threshold`, `weekly_threshold`)
- Overtime calculation logic in `useTimeClockReports`
- Overtime flags/badges in all report views

## Admin UI — Tab Structure

| Tab | Purpose | Status |
|-----|---------|--------|
| **Companies** | Add/manage companies, toggle active | New |
| **Contractors** | Add/manage per company, set resource #, billable rate, toggle active | Replaces "Employees" |
| **Jobs** | Add/manage per company, toggle active | Modified (company scoped) |
| **Approval Queue** | Review pending entries, approve/flag | New |
| **Daily Log** | View entries by date, company filter, approval status | Modified |
| **Weekly** | Weekly summary, company filter, no overtime | Modified |
| **Monthly** | Monthly summary, company filter, no overtime | Modified |
| **Crew Entry** | Batch entry for supervisor (Julian's workflow) | New |
| **Settings** | Location settings only | Simplified |

### Approval Queue (Brian's Morning Workflow)

- Default view: yesterday's date (date picker to go back)
- Grouped by company
- Entry row: Resource #, Name, Job, Clock In/Out, Hours, Billable Amount
- Actions: Approve (checkmark) or Flag (with note)
- Bulk action: Approve All per company group
- Header count: "12 pending, 3 flagged"
- Export approved entries to CSV

### Crew Entry (Julian's End-of-Day Workflow)

- Select company → select job → select date (default today)
- Grid of active contractors for that company
- Checkboxes + clock in/out time inputs per contractor
- Submit creates individual `tc_time_entries` in `pending` status

## Kiosk & Clock-In Flow

### Kiosk (wall-mounted iPad)

5-screen flow preserved with terminology changes:

1. **Numpad** — Enter 4-digit resource number
2. **Confirm** — "Welcome, [Name] — [Company Name]" with resource number
3. **Job select** — Active jobs for contractor's company only
4. **Action** — Clock In or Clock Out (elapsed time shown)
5. **Auto-reset** — 30s inactivity or 4s post-action

All new entries created with `approval_status: 'pending'`.

### Mobile

- Numpad fills viewport on phones
- Touch targets minimum 48px
- Admin tabs collapse to sidebar/bottom nav on mobile
- No horizontal scrolling

## Export (NetSuite-Ready CSV)

| Column | Source |
|--------|--------|
| Company | `tc_companies.name` |
| Resource Number | `tc_employees.employee_number` |
| Contractor Name | First + Last |
| Job | `tc_jobs.name` |
| Date | Entry date |
| Clock In | Time |
| Clock Out | Time |
| Hours | Calculated |
| Billable Rate | `tc_employees.billable_rate` |
| Total | Hours x Rate |
| Approved By | `tc_time_entries.approved_by` |
| Approved At | Timestamp |

Scope: approved entries for selected date range, filterable by company.

## Terminology Map (UI only — DB columns unchanged)

| Old UI | New UI | DB Column |
|--------|--------|-----------|
| Employee | Contractor | — |
| Employee Number | Resource Number | `employee_number` |
| Employee # | Resource # | — |
| Overtime | *(removed)* | — |
| *(new)* | Billable Rate | `billable_rate` |
| *(new)* | Company | `tc_companies` |
| *(new)* | Approval Status | `approval_status` |

## Resource Number Format

4-digit auto-increment starting at 1001. Globally unique across all companies. System auto-detects company from resource number during clock-in.

## Out of Scope (Future)

- Live NetSuite API push (currently export-only)
- Brian notification system (email/push for pending entries)
- GPS/location validation enforcement
