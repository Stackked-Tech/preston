# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
```

No test framework is configured.

## Project Overview

**WHB Companies Command Center** — A Next.js App Router application hosting eight micro-apps:

1. **Brain Dump** (`/brain-dump`) — Project portfolio tracker with drag-and-drop requirements, tags, comments, attachments, and CSV/PDF export
2. **R Alexander Time Clock** (`/time-clock`) — Employee time tracking with job assignments, overtime calculation, and reporting
3. **Signed to Sealed** (`/signed-to-sealed`) — Document signature platform with PDF rendering, field placement, multi-recipient workflows, and audit trails
4. **Payout Suite** (`/payout-suite`) — Phorest CSV → NetSuite payroll pipeline with per-branch staff config, XLSX generation, and Supabase storage
5. **Paramount Communications** (`/paramount`) — SMS messaging portal with Twilio integration, 1:1 and bulk messaging, contact management with tags, scheduled messages, delivery tracking, broadcast history, and message search
6. **Employee Admin** (`/employee-admin`) — Staff configuration management for payroll (names, NetSuite IDs, station leases, fees) across all WHB salon branches, backed by Supabase
7. **Employee Portal** (`/employee`) — Employee-facing portal with Supabase Auth login, placeholder onboarding, and read-only fee dashboard
8. **Hospitality Management** (`/hospitality`) — QR-code-driven maintenance request pipeline with tenant submission, manager approval workflow, maintenance staff task board (PWA), recurring task scheduling, and admin configuration. Features SMS notifications via Twilio and Spanish translation via Claude Haiku 4.5.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Supabase** — Database (PostgreSQL), file storage, no auth
- **Tailwind CSS 3** — Styling with CSS custom properties for theming
- **@dnd-kit** — Drag-and-drop (requirement sorting, signature field placement)
- **react-pdf / pdfjs-dist** — PDF viewing; **jspdf** — PDF generation
- **papaparse** — CSV parsing/export
- **exceljs** — XLSX generation (Payout Suite payroll)
- **Twilio REST API** — SMS send/receive via direct fetch (no SDK) for Paramount Communications
- **Supabase Realtime** — Live message updates and contact sync (Paramount Communications)

## Architecture

### Routing (`src/app/`)

```
/                          → Landing page (app selector)
/brain-dump                → Project tracker (password gated)
/time-clock                → Employee clock in/out (public)
/time-clock/admin          → Admin panel (password gated)
/signed-to-sealed          → Document management (password gated)
/signed-to-sealed/sign     → Public signing via ?token= param
/payout-suite              → Payroll pipeline (password gated)
/paramount                 → SMS portal (password gated)
/employee-admin            → Staff configuration management (password gated)
/employee                  → Employee login (Supabase Auth)
/employee/onboarding       → First-login onboarding placeholder
/employee/dashboard        → Fee summary dashboard (auth required)
/hospitality                        → Manager dashboard (password gated)
/hospitality/request/[propertyId]   → Public tenant request form (QR code target)
/hospitality/tasks                  → Maintenance staff task board (custom user login)
/hospitality/admin                  → Admin panel (password gated)
```

### Data Layer

Most database access is **client-side via Supabase SDK**. Each micro-app has its own custom hooks file that encapsulates CRUD operations with optimistic UI updates:

- `src/lib/hooks.ts` — Brain Dump (`useProjects`)
- `src/lib/timeClockHooks.ts` — Time Clock (`useEmployees`, `useJobs`, `useTimeEntries`)
- `src/lib/signedToSealedHooks.ts` — Signed to Sealed (`useEnvelopes`, `useRecipients`, `useFields`, `useTemplates`, `useTemplateDocuments`, `useTemplateFields`, `useTemplateDetail`, etc.) + utilities (`createEnvelopeFromTemplate`, `duplicateTemplate`)
- `src/lib/paramountHooks.ts` — Paramount Communications (`useContacts`, `useMessages`, `useSendMessage`, `useBulkSend`, `useScheduledMessages`, `useBroadcastHistory`, `useMessageSearch`) with Supabase Realtime subscriptions
- `src/lib/employeeAdminHooks.ts` — Employee Admin (`useBranches`, `useStaff`, `useNameOverrides`)
- `src/lib/employeeAuthHooks.ts` — Employee Portal (`useEmployeeAuth`)
- `src/lib/employeePortalHooks.ts` — Employee Portal (`useEmployeeFees`)
- `src/lib/hospitalityHooks.ts` — Hospitality Management (`useProperties`, `useRequesterTypes`, `useCategories`, `useHMUsers`, `useUserProperties`, `usePropertyByQrCode`, `useRequests`, `useSubmitRequest`, `useReviewRequest`, `useTasks`, `useTaskDetail`, `useTaskActions`, `useRecurringTasks`)

**Exception — Payout Suite:** Uses a server-side API route (`src/app/api/phorest/payroll/route.ts`) that calls the Phorest API, transforms CSV data, generates XLSX, and uploads to Supabase Storage.

**Exception — Paramount Communications:** Uses server-side API routes for Twilio integration:
- `src/app/api/paramount/send/route.ts` — Send single SMS via Twilio REST API
- `src/app/api/paramount/send-bulk/route.ts` — Bulk SMS with broadcast tracking
- `src/app/api/paramount/webhook/route.ts` — Inbound SMS webhook (creates contacts, stores messages, increments unread)
- `src/app/api/paramount/status/route.ts` — Twilio delivery status callback webhook
- `src/app/api/paramount/schedule/route.ts` — Create/cancel scheduled messages
- `src/app/api/paramount/send-scheduled/route.ts` — Cron endpoint to send due scheduled messages

**Exception — Hospitality Management:** Uses server-side API routes:
- `src/app/api/hospitality/sms/route.ts` — Send SMS via Twilio REST API
- `src/app/api/hospitality/translate/route.ts` — Translate text via Claude Haiku 4.5
- `src/app/api/hospitality/auth/route.ts` — User login and password management (bcrypt)
- `src/app/api/hospitality/recurring/route.ts` — Cron endpoint for recurring task generation

Payout Suite key libs:
- `src/lib/payrollTransform.ts` — Phorest CSV → per-staff payroll data
- `src/lib/payrollExcel.ts` — XLSX generation for NetSuite import
- `src/lib/payrollConfig.ts` — Branch/staff config with NetSuite IDs and fees; `fetchBranchConfigs()` reads from `ea_*` tables at runtime
- `src/lib/colorChargesParser.ts` — Color stylist report CSV parser
- `src/lib/phorestClient.ts` — Phorest API client (CSV export jobs)
- `Salon Exports/MAPPING-DOCUMENTATION.md` — Column-by-column mapping spec

### Type Definitions (`src/types/`)

Separate type files per domain: `database.ts` (Brain Dump), `timeclock.ts`, `signedtosealed.ts`, `paramount.ts`, `employeeadmin.ts`, `employeeportal.ts`, `hospitality.ts`. Insert/Update types are derived from main types using `Omit`.

### Component Structure

Large feature components live in `src/components/`. Brain Dump, Time Clock, and Employee Admin are single-file components (`ProjectTracker.tsx`, `TimeClock.tsx`, `TimeClockAdmin.tsx`, `EmployeeAdmin.tsx`). Signed to Sealed is broken into ~18 components in `src/components/signed-to-sealed/`. Core: `SignedToSealed.tsx` (orchestrator), `Dashboard.tsx`, `EnvelopeWizard.tsx`, `EnvelopeDetail.tsx`, `DocumentViewer.tsx`, `FieldPalette.tsx`, `RecipientManager.tsx`, `SigningView.tsx`, `SignatureModal.tsx`, `AuditTrail.tsx`. Templates: `TemplateManager.tsx`, `TemplateBuilder.tsx` (3-step wizard), `TemplatePickerModal.tsx`, `RoleMappingModal.tsx`, `SaveAsTemplateModal.tsx`. Employee Portal has three components in `src/components/employee-portal/` (LoginPage, OnboardingPage, Dashboard). Paramount Communications uses 8 components in `src/components/paramount/`:
- `ParamountComms.tsx` — Main orchestrator (state, view routing, keyboard shortcuts)
- `ConversationList.tsx` — Left sidebar with contacts, search, unread badges
- `MessageThread.tsx` — Chat bubbles, delivery status icons, character counter, schedule picker
- `ContactModal.tsx` — Add/edit contact form with tag management
- `ContactsManager.tsx` — Full contacts table with search, tag filtering, CRUD actions
- `BulkMessageModal.tsx` — Multi-select with tag quick-select, SMS segment counter
- `BroadcastHistory.tsx` — Expandable broadcast list with per-recipient delivery status
- `MessageSearch.tsx` — Cmd+K search overlay with highlighted results

Hospitality Management uses 18 components in `src/components/hospitality/`: `RequestForm.tsx` (public tenant form), `ManagerDashboard.tsx` (orchestrator), `RequestQueue.tsx`, `RequestReviewCard.tsx`, `ApprovalModal.tsx`, `RejectionModal.tsx`, `TaskBoard.tsx` (PWA orchestrator), `TaskList.tsx`, `TaskDetail.tsx`, `TaskStatusBar.tsx`, `TranslateButton.tsx`, `HospitalityAdmin.tsx` (admin orchestrator), `PropertyManager.tsx`, `UserManager.tsx`, `CategoryManager.tsx`, `RequesterTypeManager.tsx`, `RecurringTaskManager.tsx`, `StatsDashboard.tsx`.

### Theming (`src/lib/theme.tsx`)

Dark/light mode via React Context + CSS variables. Theme persists in localStorage. All colors reference CSS variables (`--bg-primary`, `--text-primary`, `--gold`, etc.) defined in `src/app/globals.css`. Gold accent (#d4af37) is the brand color.

### Security Model

No Supabase Auth for most micro-apps — RLS policies are fully permissive (designed for shared tablet use). Sensitive pages use `PasswordGate.tsx` with session-based access (sessionStorage). Public signing uses token-based access via URL parameter. **Exception:** Employee Portal uses Supabase Auth (email+password) — the only micro-app with real authentication. Employee accounts are created manually in the Supabase Dashboard.

### File Storage

Supabase Storage buckets: `attachments` (Brain Dump files), `sts-documents` (Signed to Sealed PDFs — envelope docs at `{envelopeId}/`, template docs at `templates/{templateId}/`), `payroll` (Payout Suite XLSX files), and `hospitality` (request photos at `requests/{requestId}/`, task photos at `tasks/{taskId}/{before|during|after}/`).

### Paramount Communications — Twilio Integration

SMS is sent/received via **Twilio REST API** (direct fetch with Basic Auth, no SDK). Key patterns:
- **Outbound:** API routes send via Twilio and include a `StatusCallback` URL derived from request origin
- **Inbound:** Twilio webhook at `/api/paramount/webhook` receives SMS, finds/creates contacts, stores messages, returns empty TwiML
- **Delivery tracking:** Status webhook at `/api/paramount/status` maps Twilio statuses to DB, updates messages and broadcast recipients
- **Realtime:** Supabase Realtime subscriptions on `pc_messages` (INSERT + UPDATE) and `pc_contacts` for live updates
- **Phone normalization:** All numbers stored in E.164 format (`+1XXXXXXXXXX`) via `normalizePhone()` helper
- **Scheduled messages:** Cron endpoint at `/api/paramount/send-scheduled` protected by `CRON_SECRET` Bearer token
- **Branding:** Avenir (headings) + Open Sans (body), colors: `#f26539` (primary orange), `#42c1c7` (teal), `#c73130` (error red), `#ffcc32` (golden yellow tags)

## Database

Schema files at project root:
- `supabase-schema.sql` — Brain Dump tables (`projects`, `requirements`, `comments`, `attachments`)
- `supabase-timeclock-schema.sql` + `supabase-timeclock-jobs.sql` — Time Clock tables (`tc_employees`, `tc_time_entries`, `tc_jobs`, `tc_settings`)
- `supabase-signedtosealed-schema.sql` — Signed to Sealed tables (`sts_envelopes`, `sts_documents`, `sts_recipients`, `sts_fields`, `sts_signatures`, `sts_audit_log`, `sts_templates`, `sts_template_documents`, `sts_template_fields`)
- `supabase-sts-templates-migration.sql` — Migration for template documents/fields tables + fill_mode/label columns on sts_fields
- `supabase-paramount-schema.sql` — Paramount Communications tables (`pc_contacts`, `pc_messages`, `pc_broadcasts`, `pc_broadcast_recipients`, `pc_scheduled_messages`)
- `supabase-employeeadmin-schema.sql` — Employee Admin tables (`ea_branches`, `ea_staff`, `ea_name_overrides`)
- `supabase-hospitality-schema.sql` — Hospitality Management tables (`hm_properties`, `hm_requester_types`, `hm_categories`, `hm_users`, `hm_user_properties`, `hm_requests`, `hm_request_photos`, `hm_tasks`, `hm_task_notes`, `hm_task_photos`, `hm_task_time_logs`, `hm_task_materials`, `hm_recurring_tasks`)

Time Clock tables use `tc_` prefix. Signed to Sealed tables use `sts_` prefix. Paramount Communications tables use `pc_` prefix. Employee Admin tables use `ea_` prefix. Hospitality Management tables use `hm_` prefix.

## Environment Variables

Required in `.env.local` (see `.env.local.example`):
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
PHOREST_API_KEY=<phorest-api-key>           # Payout Suite
PHOREST_API_SECRET=<phorest-api-secret>     # Payout Suite
TWILIO_ACCOUNT_SID=<twilio-account-sid>     # Paramount Communications
TWILIO_AUTH_TOKEN=<twilio-auth-token>       # Paramount Communications
TWILIO_PHONE_NUMBER=<+1XXXXXXXXXX>          # Paramount Communications
CRON_SECRET=<cron-secret>                   # Paramount Communications (scheduled messages)
ANTHROPIC_API_KEY=<anthropic-api-key>          # Hospitality (Claude Haiku translation)
TWILIO_HM_PHONE_NUMBER=<+1XXXXXXXXXX>          # Hospitality (dedicated Twilio number, optional)
```

The Supabase client (`src/lib/supabase.ts`) creates a placeholder if env vars are missing — the app builds but shows error states at runtime.

## Running Supabase Migrations

Supabase project ref: `sfftouuzdrxfwcqqjjpm` (Preston). Env vars in `.env` (not `.env.local`).
psql at `/opt/homebrew/Cellar/libpq/18.3/bin/psql`. Supabase CLI v2.75 has no `db execute`.
To run SQL against remote DB, use the Management API:
```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w | sed 's/go-keyring-base64://' | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/sfftouuzdrxfwcqqjjpm/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg sql "$(cat migration.sql)" '{query: $sql}')"
```

## Conventions

- **Path alias:** `@/` maps to `src/` (configured in tsconfig.json)
- **Fonts:** Cormorant Garamond (headings) + DM Sans (body) via Google Fonts; Paramount Communications uses Avenir/Nunito Sans (headings) + Open Sans (body) scoped via `.paramount` CSS class
- **Export utilities:** `src/lib/export.ts` (Brain Dump) and `src/lib/timeClockExport.ts` (Time Clock) handle CSV/PDF generation
- **No external state management** — React Context for theme only; custom hooks for all data
