# WHB Construction Scheduler — Product Demo

> **Built for WHB Companies by Stackked** | A focused construction scheduling platform that replaces the complexity of Buildertrend with exactly what you need: schedules, dependencies, and subcontractor notifications.

---

## The Problem

*"I am way too bogged down with what I have in my head with schedules for me and everyone else."*

Preston needs a scheduling platform that:
- Manages project timelines across multiple PMs and subcontractors
- Automatically cascades schedule changes through dependencies
- Notifies subs when their dates shift
- Doesn't force daily photos or project management bloat

**The Construction Scheduler solves all of this.**

---

## Dashboard Overview

The scheduler lives inside the WHB Command Center alongside the other micro-apps. The main dashboard shows:

- **Project sidebar** with search, status filters (Active, Planning, On Hold, Completed), and quick-create
- **Quick stats** showing active project count and total subs at a glance
- **Navigation tabs** for Schedule, Workload, Subs, Templates, and Alerts
- **Dark/light mode** toggle

Each project card shows:
- Project name and job site address
- Assigned Project Manager
- Color-coded status badge with glowing indicator dot
- Relative timestamp ("2h ago")

---

## Project Detail — Timeline View

When you select a project, the detail view opens with:

### Stats Dashboard
Five stat cards across the top:
- **Total** tasks
- **Pending** (gray)
- **In Progress** (blue)
- **Completed** (green)
- **Delayed** (red)

Plus an animated progress bar showing overall project completion.

### Interactive Gantt Chart
The timeline view is a custom-built Gantt chart with:

- **Phase groupings** — Tasks organized under color-coded phases (Site Work, Foundation, Framing & Dry-In, Rough-Ins, etc.)
- **Task bars** — Gradient-colored by status with labels
- **Dependency arrows** — Dashed gold bezier curves connecting dependent tasks
- **Today line** — Golden vertical line showing the current date
- **Weekend shading** — Subtle background on non-working days
- **Hover tooltips** — Shows task name, dates, duration, and assigned sub

### Drag-to-Reschedule
The Gantt supports smooth, real-time drag and drop:
- **Grab any task bar** and drag it to a new position
- The bar follows your cursor pixel-by-pixel at 60fps
- A **floating date label** shows the new date range as you drag
- Label turns **green** (moving forward) or **red** (moving backward)
- On drop, all dependent tasks **automatically cascade** — every downstream task shifts to maintain the dependency chain

### Notification Review
After a drag causes cascading changes:
- A **review modal** appears showing all affected subcontractors
- Each sub's changes listed with old dates → new dates
- **Checkboxes** to select which subs to notify
- **"Send"** to notify via SMS + email, or **"Skip"** to save without notifying
- Prevents accidental notification spam during schedule planning

---

## Project Detail — List View

Toggle to List view for a clean, scannable task list:
- Color-coded status indicators (green bar = completed, blue = in progress, gray = pending, red = delayed)
- Phase badges with matching colors
- Assigned sub name with 👷 icon
- Dependency indicator (🔗 Has dependency)
- **Acknowledgment status** — green ✓ when a sub has confirmed their schedule
- Date range and duration on the right

---

## Task Editor

Click any task or "Add Task" to open the task editor modal:

### Grouped Sections
- **Task Details** — Name, phase assignment, status selector with emoji indicators
- **Schedule** — Start date picker, duration in days, calculated end date, dependency selector
- **Assignment** — Dropdown of all subs organized by trade
- **Notes** — Free-text field for task-specific details

### Smart Features
- **Circular dependency prevention** — Can't select dependencies that would create loops
- **Auto-calculated end date** — Changes in real-time as you adjust start date or duration
- **Backdrop blur** modal with gold accent styling

---

## Phase Management

Organize tasks into construction phases:
- **Color-coded phases** (orange for Site Work, gray for Foundation, blue for Framing, etc.)
- Create, rename, and delete phases
- **Color picker** with 9 preset colors and glowing selection indicator
- Tasks automatically group under their assigned phase in both Gantt and List views

---

## Subcontractor Directory

A complete sub contact database:
- **Avatar initials** with trade-colored backgrounds
- **Trade badges** — Cabinetry, Plumbing, Roofing, Foundation, Flooring, Framing, Landscaping, Drywall, Excavation, Insulation, Painting, Tile, HVAC, Windows & Doors, Electrical (20 trades supported)
- Contact details: company, phone, email
- **Search** by name, trade, or company
- **Portal link generation** — One-click copy of magic link URL for sub access

### Sub Portal
Each sub gets a unique, shareable URL (`/scheduler/sub/[token]`) that:
- Requires **no login** — magic link access
- Shows **only their assigned tasks** across all projects
- Displays start/end dates, duration, project name and address
- Status badges (Pending, In Progress, Delayed)
- **Acknowledge button** — subs can confirm they've seen their schedule
- Professional dark-themed WHB branding

---

## Sub Workload View

The bird's-eye view Preston needs to manage sub availability:

- **Cross-project timeline** showing every sub's tasks from ALL active projects
- Tasks **color-coded by project** (blue = Lakewood, green = Tavares, etc.)
- Project legend at the top
- **Trade filter** dropdown
- Each sub row shows: name, trade, task count
- **Available subs** listed at the bottom (those with no current assignments)
- Click any task bar to **navigate directly** to that project

---

## Schedule Templates

Reusable schedule blueprints:
- **Standard New Build** — 25 tasks, 7 phases, ~16 weeks
- **Kitchen & Bath Renovation** — 11 tasks, 3 phases, ~5 weeks
- **Commercial Tenant Improvement** — Office buildout template

### Applying Templates
1. Select a project
2. Open Templates and click "Apply"
3. Choose a start date
4. All phases and tasks are created with calculated dates
5. **Subs are auto-assigned by trade** — if a template task specifies "Plumbing", it matches to your first plumber alphabetically

---

## Notifications

### SMS Notifications (Twilio)
When schedule changes affect a sub:
- Batched message with ALL their affected tasks
- Old dates → new dates comparison
- "Reply to this message" prompt for questions

### Email Notifications (Resend)
If a sub has an email on file:
- Professional HTML email with WHB branding
- Table of schedule changes with Previous vs New dates
- Sent alongside SMS for dual-channel reach

### Notification Log
Full history of all sent notifications:
- Status indicators (sent/failed)
- Channel (SMS/Email)
- Timestamp
- Full message preview

---

## Technical Details

| Aspect | Details |
|--------|---------|
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript |
| **Database** | Supabase (PostgreSQL) — 9 tables with `cs_` prefix |
| **SMS** | Twilio REST API (same infrastructure as Paramount Communications) |
| **Email** | Resend (same infrastructure as Signed to Sealed) |
| **Styling** | Tailwind CSS with WHB theme (Cormorant Garamond + DM Sans, gold #d4af37 accent) |
| **Gantt Chart** | Custom-built with CSS grid + SVG dependency arrows |
| **Auth** | Password gate (same pattern as all WHB Command Center apps) |
| **Deployment** | Vercel |
| **Components** | 12 React components in `src/components/scheduler/` |
| **New Dependencies** | Zero — uses existing project stack |

---

## Why Not Buildertrend?

| Feature | Buildertrend | WHB Construction Scheduler |
|---------|-------------|---------------------------|
| Monthly cost | $499–$899/mo | $0 (custom-built) |
| Learning curve | Weeks | Minutes |
| Daily photo uploads | Required | Not included (by design) |
| Sub notifications | Manual | Automatic on schedule change |
| Cascading dependencies | Limited | Full recursive cascade |
| Sub portal | Requires login | Magic link, no account needed |
| Customization | None | Fully customizable |
| Integration | Separate system | Built into WHB Command Center |

---

*Built by Stackked for WHB Companies — focused on what matters, nothing that doesn't.*
