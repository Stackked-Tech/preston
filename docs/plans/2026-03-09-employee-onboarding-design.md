# Employee Onboarding Enhancement — Design Document

## Objective

Connect Employee Admin, Signed to Sealed, and Employee Portal into a single onboarding pipeline. Admin onboards an employee in one modal interaction → employee receives invite email → sets password → signs onboarding document → gains dashboard access.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth approach | Supabase `inviteUserByEmail()` | No temp passwords, employee sets own password via magic link, simpler and more secure |
| Signing completion → status update | PostgreSQL DB trigger | Zero coupling between STS and Employee systems, guaranteed to fire |
| Signing UX | Styled redirect (not iframe) | STS signing view is already a full-page experience, iframe risks layout issues |
| Existing employees | Default to `active` | Already working, onboarding flow is forward-only |
| Force password change | Removed | Invite flow handles this — employee sets password on first visit |

## Database Changes

### New columns on `ea_staff`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `status` | `TEXT CHECK (status IN ('active','onboarding','inactive','terminated'))` | `'active'` | Replaces `is_active` as primary status |
| `supabase_auth_uid` | `UUID` | `NULL` | Links to `auth.users.id` |
| `onboarding_template_id` | `UUID` | `NULL` | FK → `sts_templates.id` |
| `onboarding_envelope_id` | `UUID` | `NULL` | FK → `sts_envelopes.id` |
| `onboarding_signing_token` | `UUID` | `NULL` | Copied from `sts_recipients.access_token` |

### DB trigger: `on_signing_complete`

Fires on `sts_recipients` UPDATE when `status` changes to `'signed'`. Looks up `ea_staff` where `onboarding_envelope_id` matches the recipient's `envelope_id`, then sets `ea_staff.status = 'active'`.

### Migration strategy

All existing `ea_staff` rows get `status = 'active'`. All onboarding columns default to `NULL`.

## API Route: `POST /api/employee-admin/onboard`

Server-side route using `supabaseAdmin` client (service role key).

### Request body

```typescript
{
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

### Sequence

1. `supabase.auth.admin.inviteUserByEmail(email)` with `user_metadata: { onboarding_complete: false }` → returns `auth_uid`
2. Insert `ea_staff` record with `status = 'onboarding'`, `supabase_auth_uid = auth_uid`, `onboarding_template_id = template_id`
3. Create STS envelope from template server-side: create envelope → copy docs from storage → create recipient → clone template fields
4. Update `ea_staff` with `onboarding_envelope_id` and `onboarding_signing_token` (from `sts_recipients.access_token`)
5. Return new employee record

Error handling: if any step fails after auth user creation, delete the auth user (rollback).

## Admin UI Changes (`EmployeeAdmin.tsx`)

### New elements

- **"Onboard New Employee" button** — next to existing "+ Add Staff", gold accent
- **Onboarding modal** — name, email, branch (pre-selected), template dropdown (from `sts_templates`), fee fields, optional associate section. Submits to API route.
- **Status column** — color-coded badges: green (active), gold (onboarding), gray (inactive), red (terminated)
- **Onboarding Doc column** — "Signed" (green) / "Pending" (gold) / "—" (no doc). Derived from `sts_envelopes.status` via `onboarding_envelope_id`.
- **Status dropdown in edit modal** — replaces `is_active` toggle. `active`/`onboarding` = active, `inactive`/`terminated` = inactive for backward compat.

### New hooks (`employeeAdminHooks.ts`)

- `useTemplates()` — fetches `sts_templates` for dropdown
- `onboardEmployee(data)` — calls API route, adds returned record to state

## Employee Portal Changes

### Auth flow (`employeeAuthHooks.ts`)

Post-login routing based on `ea_staff.status`:
1. If `status === 'onboarding'` and `onboarding_signing_token` exists → `/employee/onboarding`
2. Else → `/employee/dashboard`

Single source of truth: `ea_staff.status` replaces `user_metadata.onboarding_complete`.

### `OnboardingDocument.tsx` (replaces `OnboardingPage.tsx`)

- Fetches `ea_staff` record by email to get `onboarding_signing_token`
- Shows branded welcome card with employee name, branch, and "Review & Sign Your Onboarding Document" button
- Button opens `/signed-to-sealed/sign?token={token}` in same tab
- If employee returns before signing, card still shows waiting state
- DB trigger handles status transition on signing completion

### `Dashboard.tsx` enhancement

- New "Onboarding Documents" section (shown if `onboarding_envelope_id` exists)
- Document name, status badge (green "Signed" / amber "Pending"), link to signing view if pending
- Existing fee cards unchanged below

### New hook (`employeePortalHooks.ts`)

- `useEmployeeRecord(email)` — fetches full `ea_staff` record for routing and onboarding page

## Infrastructure

### New env var

```
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Server-side only. Never `NEXT_PUBLIC_`.

### New file: `src/lib/supabaseAdmin.ts`

Supabase client using service role key. Only imported by API routes.

### Custom SMTP

Configure provider (Resend recommended) in Supabase Dashboard → Settings → Auth → SMTP. Set sender to WHB domain. Customize "Invite User" email template with WHB branding.

## Deliverables Summary

| Deliverable | File(s) |
|---|---|
| Migration SQL | `supabase-employeeadmin-onboarding.sql` |
| Admin Supabase client | `src/lib/supabaseAdmin.ts` |
| Onboard API route | `src/app/api/employee-admin/onboard/route.ts` |
| Admin UI updates | `src/components/EmployeeAdmin.tsx` |
| Admin hooks additions | `src/lib/employeeAdminHooks.ts` |
| Onboarding component | `src/components/employee-portal/OnboardingDocument.tsx` |
| Dashboard enhancement | `src/components/employee-portal/Dashboard.tsx` |
| Auth flow update | `src/lib/employeeAuthHooks.ts` |
| Portal hooks addition | `src/lib/employeePortalHooks.ts` |
| Types update | `src/types/employeeadmin.ts`, `src/types/employeeportal.ts` |

## Constraints

- Service role key never exposed client-side
- No modifications to Signed to Sealed codebase
- Existing STS signing flow used as-is via redirect
- All new files use `@/` path alias
- Client-side Supabase SDK for reads, API routes for admin operations
