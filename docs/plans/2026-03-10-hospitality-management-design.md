# Hospitality Management — Design Document

**Date:** 2026-03-10
**Status:** Approved
**App Route:** `/hospitality`
**Table Prefix:** `hm_`

---

## Overview

QR-code-driven maintenance request pipeline for multi-property management. Tenants scan a QR code at their location, submit a service request, and it flows through manager approval into a full-featured task management system for maintenance staff.

**Key user flows:**
1. Tenant scans QR → submits request via public form
2. Location manager reviews → approves, approves with edits, or rejects with notes
3. Maintenance staff fulfills tasks via mobile-optimized PWA task board
4. Admin configures properties, users, categories, and recurring tasks

---

## Route Structure

```
/hospitality                        → Manager dashboard (password-gated)
/hospitality/request/[propertyId]   → Public tenant form (QR code target, no auth)
/hospitality/tasks                  → Maintenance staff task board (user login)
/hospitality/admin                  → Admin panel (password-gated, shared Preston admin password)
```

---

## Database Schema

All tables use `hm_` prefix. Supabase PostgreSQL with permissive RLS (consistent with other micro-apps).

### Configuration Tables

#### `hm_properties`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| name | text NOT NULL | Property display name |
| address | text | Street address |
| city | text | |
| state | text | |
| zip | text | |
| lat | decimal(10,7) | Latitude for future map |
| lng | decimal(10,7) | Longitude for future map |
| notes | text | Internal notes |
| qr_code_id | uuid UNIQUE | UUID used in QR code URL |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

#### `hm_requester_types`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| label | text NOT NULL | e.g., "Property Owner", "Property Manager", "Guest" |
| sort_order | integer | Display order in dropdown |
| is_active | boolean | default true |

#### `hm_categories`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| label | text NOT NULL | e.g., "Plumbing", "Electrical", "HVAC" |
| sort_order | integer | Display order in dropdown |
| is_active | boolean | default true |

#### `hm_users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| email | text | |
| phone | text | E.164 format for SMS |
| role | text NOT NULL | 'manager' or 'staff' |
| password_hash | text NOT NULL | bcrypt hashed |
| must_reset_password | boolean | default true (first-login prompt) |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

#### `hm_user_properties`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → hm_users | |
| property_id | uuid FK → hm_properties | |

Many-to-many: assigns managers and staff to properties.

### Request Tables

#### `hm_requests`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| property_id | uuid FK → hm_properties | |
| requester_type_id | uuid FK → hm_requester_types | |
| contact_phone | text | Requester's phone for SMS updates |
| category_id | uuid FK → hm_categories | |
| description | text NOT NULL | Free-text issue description |
| urgency | text NOT NULL | 'routine', 'urgent', 'emergency' |
| status | text NOT NULL | 'pending', 'approved', 'rejected' (default 'pending') |
| manager_notes | text | Notes on approval/rejection |
| reviewed_by | uuid FK → hm_users | Manager who reviewed |
| reviewed_at | timestamptz | |
| created_at | timestamptz | default now() |

#### `hm_request_photos`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| request_id | uuid FK → hm_requests | |
| storage_path | text NOT NULL | Supabase Storage path |
| created_at | timestamptz | default now() |

### Task Tables

#### `hm_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| request_id | uuid FK → hm_requests | NULL for recurring-generated tasks |
| recurring_task_id | uuid FK → hm_recurring_tasks | NULL for request-generated tasks |
| property_id | uuid FK → hm_properties | Denormalized for query convenience |
| title | text | Auto-generated or from recurring template |
| description | text | Copied from request or recurring template |
| assigned_to | uuid FK → hm_users | |
| status | text NOT NULL | 'new', 'acknowledged', 'in_progress', 'on_hold', 'completed' |
| priority | text NOT NULL | 'low', 'medium', 'high', 'critical' |
| due_date | date | |
| completed_at | timestamptz | |
| created_at | timestamptz | default now() |

#### `hm_task_notes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK → hm_tasks | |
| user_id | uuid FK → hm_users | |
| note | text NOT NULL | |
| created_at | timestamptz | default now() |

#### `hm_task_photos`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK → hm_tasks | |
| user_id | uuid FK → hm_users | |
| storage_path | text NOT NULL | Supabase Storage path |
| photo_type | text NOT NULL | 'before', 'during', 'after' |
| created_at | timestamptz | default now() |

#### `hm_task_time_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK → hm_tasks | |
| user_id | uuid FK → hm_users | |
| started_at | timestamptz NOT NULL | |
| ended_at | timestamptz | NULL if timer still running |
| duration_minutes | integer | Calculated on end, or manual entry |
| notes | text | |

#### `hm_task_materials`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK → hm_tasks | |
| name | text NOT NULL | Part/material name |
| quantity | decimal | |
| cost | decimal(10,2) | |
| notes | text | |
| created_at | timestamptz | default now() |

#### `hm_recurring_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| property_id | uuid FK → hm_properties | |
| category_id | uuid FK → hm_categories | |
| title | text NOT NULL | |
| description | text | |
| priority | text NOT NULL | 'low', 'medium', 'high', 'critical' |
| frequency | text NOT NULL | 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly' |
| next_due_date | date NOT NULL | |
| assigned_to | uuid FK → hm_users | |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### Storage

Supabase Storage bucket: `hospitality`
- Request photos: `requests/{requestId}/{filename}`
- Task photos: `tasks/{taskId}/{before|during|after}/{filename}`

---

## User Flows

### Flow 1: Tenant Submits Request

```
Scan QR code at property
  → GET /hospitality/request/[qr_code_id]
  → Page loads property name (auto-filled, read-only)
  → Form fields:
      - Requester type (dropdown from hm_requester_types)
      - Contact phone number
      - Category (dropdown from hm_categories)
      - Description (textarea)
      - Photos (multi-file upload)
      - Urgency (routine / urgent / emergency)
  → Submit → INSERT hm_requests (status: 'pending')
  → Upload photos → INSERT hm_request_photos
  → SMS to manager(s) assigned to this property:
      "New [urgency] maintenance request at [Property Name]: [Category]"
  → Success screen shown to tenant
```

### Flow 2: Manager Reviews Request

```
Manager opens /hospitality → password gate
  → Sees pending requests filtered to their assigned properties
  → Each request card shows: property, category, urgency, description, photos, timestamp
  → Three actions:

  REJECT WITH NOTES:
    → Modal: enter rejection notes
    → UPDATE hm_requests SET status='rejected', manager_notes, reviewed_by, reviewed_at
    → SMS to requester: "Your request at [Property] was not approved: [notes]"

  APPROVE:
    → INSERT hm_tasks (status: 'new', priority mapped from urgency)
    → UPDATE hm_requests SET status='approved', reviewed_by, reviewed_at
    → SMS to assigned staff: "New task at [Property]: [Category]"

  APPROVE WITH EDITS:
    → Modal: edit priority, due date, category, notes, assign to specific staff
    → INSERT hm_tasks with edited values
    → UPDATE hm_requests SET status='approved', manager_notes, reviewed_by, reviewed_at
    → SMS to assigned staff: "New task at [Property]: [Category] — Due [date]"
```

### Flow 3: Maintenance Staff Fulfills Task

```
Staff opens /hospitality/tasks → user login (first-login password reset)
  → Task queue sorted by: priority (desc), due date (asc)
  → Filterable by: status, property, priority, date range
  → Tap task → TaskDetail view with tabs:

  DETAILS TAB:
    - Description, request photos, property info
    - "Translate to Spanish" button (Claude Haiku 4.5)

  ACTIVITY TAB:
    - Timestamped note log
    - Add note form

  PHOTOS TAB:
    - Before / during / after sections
    - Camera capture + upload

  TIME TAB:
    - Start/stop timer
    - Manual time entry
    - Total hours logged

  MATERIALS TAB:
    - Add parts: name, quantity, cost
    - Running total

  STATUS UPDATES:
    New → Acknowledged → In Progress → On Hold → Completed
    - Visual status pipeline at top of task
    - On "Completed": SMS to requester "Your request has been completed"
```

### Flow 4: Admin Configuration

```
/hospitality/admin → password gate (shared Preston admin password)
  → Tabbed interface:

  PROPERTIES:
    - CRUD with address, lat/lng
    - Generate QR code (downloadable PNG)
    - Assign managers/staff

  USERS:
    - CRUD for managers and staff
    - Set role, phone, email
    - Multi-select property assignments
    - Reset password / force password reset

  CATEGORIES:
    - Add/edit/deactivate issue categories
    - Drag to reorder

  REQUESTER TYPES:
    - Add/edit/deactivate requester types
    - Drag to reorder

  RECURRING TASKS:
    - Create scheduled maintenance templates
    - Set frequency, property, category, priority, assignment
    - View next due dates

  DASHBOARD:
    - Open tasks by status
    - Avg completion time
    - Tasks per property
    - Tasks per staff member
    - Requests by category breakdown
```

---

## Component Architecture

### Public Form
- `src/components/hospitality/RequestForm.tsx` — mobile-first submission form

### Manager Dashboard
- `src/components/hospitality/ManagerDashboard.tsx` — orchestrator
- `src/components/hospitality/RequestQueue.tsx` — filterable pending request list
- `src/components/hospitality/RequestReviewCard.tsx` — expandable request card
- `src/components/hospitality/ApprovalModal.tsx` — edit fields before approving
- `src/components/hospitality/RejectionModal.tsx` — rejection notes + SMS preview

### Maintenance Task Board
- `src/components/hospitality/TaskBoard.tsx` — orchestrator, PWA-optimized
- `src/components/hospitality/TaskList.tsx` — sortable/filterable task queue
- `src/components/hospitality/TaskDetail.tsx` — full task view with tabbed sections
- `src/components/hospitality/TaskStatusBar.tsx` — visual status pipeline
- `src/components/hospitality/TranslateButton.tsx` — Claude Haiku 4.5 translation

### Admin Panel
- `src/components/hospitality/HospitalityAdmin.tsx` — tab-based admin
- `src/components/hospitality/PropertyManager.tsx` — CRUD + QR generation
- `src/components/hospitality/UserManager.tsx` — CRUD + property assignments
- `src/components/hospitality/CategoryManager.tsx` — sortable CRUD list
- `src/components/hospitality/RequesterTypeManager.tsx` — sortable CRUD list
- `src/components/hospitality/RecurringTaskManager.tsx` — scheduled maintenance CRUD
- `src/components/hospitality/StatsDashboard.tsx` — metrics and charts

### Data Layer
- `src/lib/hospitalityHooks.ts` — all Supabase CRUD hooks with optimistic UI
- `src/types/hospitality.ts` — TypeScript type definitions

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/hospitality/sms` | POST | Send SMS via Twilio (notifications) |
| `/api/hospitality/translate` | POST | Translate text to Spanish via Claude Haiku 4.5 |
| `/api/hospitality/recurring` | POST | Cron endpoint: generate tasks from recurring templates |
| `/api/hospitality/auth` | POST | User login + password reset |

---

## PWA Configuration

- `public/manifest.json` — app name "WHB Maintenance", gold (#d4af37) theme color, standalone display
- Service worker for app shell caching (fast load from home screen)
- Mobile-optimized: large touch targets, swipe gestures, bottom navigation
- Fullscreen experience (no browser chrome when launched from home screen)

---

## SMS Integration

Reuses existing Twilio infrastructure. New env var `TWILIO_HM_PHONE_NUMBER` (falls back to existing `TWILIO_PHONE_NUMBER` until dedicated number is approved).

**Notification triggers:**
1. Request submitted → SMS to assigned manager(s)
2. Request rejected → SMS to requester with rejection notes
3. Request approved → SMS to assigned maintenance staff
4. Task completed → SMS to requester

---

## Translation

- API route: `/api/hospitality/translate`
- Model: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- System prompt: "Translate the following maintenance request to Spanish. Preserve technical terms."
- New env var: `ANTHROPIC_API_KEY`
- UI: Single "Translate to Spanish" button on task detail view, toggles between English/Spanish

---

## Environment Variables (New)

```
ANTHROPIC_API_KEY=<anthropic-api-key>          # Claude Haiku translation
TWILIO_HM_PHONE_NUMBER=<+1XXXXXXXXXX>          # Dedicated HM Twilio number (optional)
```

---

## Future Enhancements (Not in Initial Build)

- **Mapbox integration** — view all requests/tasks on a map by property location
- **Route optimization** — optimal driving route for maintenance staff across properties
- **Offline support** — queue task updates when offline, sync when back online
- **Web push notifications** — supplement SMS with browser push
- **Tenant portal** — let tenants check request status via QR code + phone number lookup
