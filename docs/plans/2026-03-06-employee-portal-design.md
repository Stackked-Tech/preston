# Employee Portal Design

**Date:** 2026-03-06
**Status:** Approved
**Route:** `/employee`, `/employee/onboarding`, `/employee/dashboard`

## Objective

Build an employee-facing portal where salon staff can log in with email and password via Supabase Auth, complete a placeholder onboarding flow on first login, and view their assigned fees (station lease, financial services, phorest fee, refreshment) from the `ea_staff` table.

## Database Changes

### Add email to `ea_staff`

```sql
ALTER TABLE ea_staff ADD COLUMN email TEXT;
CREATE INDEX idx_ea_staff_email ON ea_staff(email);
```

- Nullable — not all staff need portal access
- No unique constraint (same email across multiple branches is valid)
- Admin sets email via Employee Admin UI edit modal

### Onboarding tracking

Stored in Supabase Auth user metadata: `user.user_metadata.onboarding_complete` (boolean). Set via `supabase.auth.updateUser()`. No new table or column needed.

### RLS

Keep existing permissive RLS. Portal hook filters by email client-side. Consistent with rest of codebase.

## Auth Flow

Client-side Supabase Auth via existing SDK (`supabase.auth.signInWithPassword`).

### `useEmployeeAuth` hook

Returns: `user`, `loading`, `onboardingComplete`, `login()`, `logout()`, `completeOnboarding()`

### Route logic

- `/employee` — if session exists, redirect to onboarding or dashboard based on `onboarding_complete`
- `/employee/onboarding` — if no session, redirect to login. If onboarding already complete, redirect to dashboard.
- `/employee/dashboard` — if no session, redirect to login

Session persistence via Supabase Auth's built-in localStorage token storage + `onAuthStateChange` listener.

## Dashboard

### Data fetching

`useEmployeeFees(email)` queries `ea_staff` joined with `ea_branches` where `email = user.email AND is_active = true`. Returns array (multi-branch support).

### Layout

One card per branch assignment showing:
- Branch name
- Station Lease, Financial Services, Phorest Fee, Refreshment (as currency)
- Total fees sum
- Associate Pay + Supervisor if applicable
- "No fee data found" empty state

## Supabase Auth Config (Manual)

1. Enable Email provider in Supabase Dashboard (Authentication > Providers)
2. Disable "Confirm email" (Authentication > Settings) for internal use
3. Create employee accounts via Dashboard (Authentication > Users > Add User)

## File Inventory

### New files

| File | Purpose |
|------|---------|
| `supabase-employee-portal-schema.sql` | ALTER TABLE + index |
| `src/types/employeeportal.ts` | Auth session + fee types |
| `src/lib/employeeAuthHooks.ts` | `useEmployeeAuth` hook |
| `src/lib/employeePortalHooks.ts` | `useEmployeeFees` hook |
| `src/components/employee-portal/LoginPage.tsx` | Login form |
| `src/components/employee-portal/OnboardingPage.tsx` | Placeholder onboarding |
| `src/components/employee-portal/Dashboard.tsx` | Fee cards |
| `src/app/employee/page.tsx` | Login route |
| `src/app/employee/onboarding/page.tsx` | Onboarding route |
| `src/app/employee/dashboard/page.tsx` | Dashboard route |

### Modified files

| File | Change |
|------|--------|
| `src/types/employeeadmin.ts` | Add `email: string \| null` to `EAStaff` |
| `src/components/EmployeeAdmin.tsx` | Add email field to edit modal |
| `src/app/page.tsx` | Add Employee Portal card to landing page |
| `CLAUDE.md` | Update documentation |

## Constraints

- Client-side Supabase SDK only — no new API routes, no middleware
- Read-only portal — employees cannot edit fees
- Permissive RLS (unchanged) — client-side email filtering
- No new dependencies
- Preston brand: gold accent, Cormorant Garamond headings, DM Sans body, dark/light theme
