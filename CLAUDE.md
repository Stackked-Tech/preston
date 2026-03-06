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

**WHB Companies Command Center** — A Next.js App Router application hosting six micro-apps:

1. **Brain Dump** (`/brain-dump`) — Project portfolio tracker with drag-and-drop requirements, tags, comments, attachments, and CSV/PDF export
2. **R Alexander Time Clock** (`/time-clock`) — Employee time tracking with job assignments, overtime calculation, and reporting
3. **Signed to Sealed** (`/signed-to-sealed`) — Document signature platform with PDF rendering, field placement, multi-recipient workflows, and audit trails
4. **Payout Suite** (`/payout-suite`) — Phorest CSV → NetSuite payroll pipeline with per-branch staff config, XLSX generation, and Supabase storage
5. **Paramount Communications** (`/paramount`) — SMS messaging portal with Twilio integration, 1:1 and bulk messaging, contact management with tags, scheduled messages, delivery tracking, broadcast history, and message search

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
```

### Data Layer

Most database access is **client-side via Supabase SDK**. Each micro-app has its own custom hooks file that encapsulates CRUD operations with optimistic UI updates:

- `src/lib/hooks.ts` — Brain Dump (`useProjects`)
- `src/lib/timeClockHooks.ts` — Time Clock (`useEmployees`, `useJobs`, `useTimeEntries`)
- `src/lib/signedToSealedHooks.ts` — Signed to Sealed (`useEnvelopes`, `useRecipients`, `useFields`, etc.)
- `src/lib/paramountHooks.ts` — Paramount Communications (`useContacts`, `useMessages`, `useSendMessage`, `useBulkSend`, `useScheduledMessages`, `useBroadcastHistory`, `useMessageSearch`) with Supabase Realtime subscriptions

**Exception — Payout Suite:** Uses a server-side API route (`src/app/api/phorest/payroll/route.ts`) that calls the Phorest API, transforms CSV data, generates XLSX, and uploads to Supabase Storage.

**Exception — Paramount Communications:** Uses server-side API routes for Twilio integration:
- `src/app/api/paramount/send/route.ts` — Send single SMS via Twilio REST API
- `src/app/api/paramount/send-bulk/route.ts` — Bulk SMS with broadcast tracking
- `src/app/api/paramount/webhook/route.ts` — Inbound SMS webhook (creates contacts, stores messages, increments unread)
- `src/app/api/paramount/status/route.ts` — Twilio delivery status callback webhook
- `src/app/api/paramount/schedule/route.ts` — Create/cancel scheduled messages
- `src/app/api/paramount/send-scheduled/route.ts` — Cron endpoint to send due scheduled messages

Payout Suite key libs:
- `src/lib/payrollTransform.ts` — Phorest CSV → per-staff payroll data
- `src/lib/payrollExcel.ts` — XLSX generation for NetSuite import
- `src/lib/payrollConfig.ts` — Branch/staff config with NetSuite IDs and fees
- `src/lib/colorChargesParser.ts` — Color stylist report CSV parser
- `src/lib/phorestClient.ts` — Phorest API client (CSV export jobs)
- `Salon Exports/MAPPING-DOCUMENTATION.md` — Column-by-column mapping spec

### Type Definitions (`src/types/`)

Separate type files per domain: `database.ts` (Brain Dump), `timeclock.ts`, `signedtosealed.ts`, `paramount.ts`. Insert/Update types are derived from main types using `Omit`.

### Component Structure

Large feature components live in `src/components/`. Brain Dump and Time Clock are single-file components (`ProjectTracker.tsx`, `TimeClock.tsx`, `TimeClockAdmin.tsx`). Signed to Sealed is broken into ~13 smaller components in `src/components/signed-to-sealed/`. Paramount Communications uses 8 components in `src/components/paramount/`:
- `ParamountComms.tsx` — Main orchestrator (state, view routing, keyboard shortcuts)
- `ConversationList.tsx` — Left sidebar with contacts, search, unread badges
- `MessageThread.tsx` — Chat bubbles, delivery status icons, character counter, schedule picker
- `ContactModal.tsx` — Add/edit contact form with tag management
- `ContactsManager.tsx` — Full contacts table with search, tag filtering, CRUD actions
- `BulkMessageModal.tsx` — Multi-select with tag quick-select, SMS segment counter
- `BroadcastHistory.tsx` — Expandable broadcast list with per-recipient delivery status
- `MessageSearch.tsx` — Cmd+K search overlay with highlighted results

### Theming (`src/lib/theme.tsx`)

Dark/light mode via React Context + CSS variables. Theme persists in localStorage. All colors reference CSS variables (`--bg-primary`, `--text-primary`, `--gold`, etc.) defined in `src/app/globals.css`. Gold accent (#d4af37) is the brand color.

### Security Model

No Supabase Auth — RLS policies are fully permissive (designed for shared tablet use). Sensitive pages use `PasswordGate.tsx` with session-based access (sessionStorage). Public signing uses token-based access via URL parameter.

### File Storage

Supabase Storage buckets: `attachments` (Brain Dump files), `sts-documents` (Signed to Sealed PDFs), and `payroll` (Payout Suite XLSX files).

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
- `supabase-signedtosealed-schema.sql` — Signed to Sealed tables (`sts_envelopes`, `sts_documents`, `sts_recipients`, `sts_fields`, `sts_signatures`, `sts_audit_log`, `sts_templates`)
- `supabase-paramount-schema.sql` — Paramount Communications tables (`pc_contacts`, `pc_messages`, `pc_broadcasts`, `pc_broadcast_recipients`, `pc_scheduled_messages`)

Time Clock tables use `tc_` prefix. Signed to Sealed tables use `sts_` prefix. Paramount Communications tables use `pc_` prefix.

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
```

The Supabase client (`src/lib/supabase.ts`) creates a placeholder if env vars are missing — the app builds but shows error states at runtime.

## Conventions

- **Path alias:** `@/` maps to `src/` (configured in tsconfig.json)
- **Fonts:** Cormorant Garamond (headings) + DM Sans (body) via Google Fonts; Paramount Communications uses Avenir/Nunito Sans (headings) + Open Sans (body) scoped via `.paramount` CSS class
- **Export utilities:** `src/lib/export.ts` (Brain Dump) and `src/lib/timeClockExport.ts` (Time Clock) handle CSV/PDF generation
- **No external state management** — React Context for theme only; custom hooks for all data
