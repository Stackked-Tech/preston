# New Contact Commission Calculator - Design Document

## Overview

A new feature card in the WHB Companies Command Center that calculates commission owed to Preston by stylists for first-time client appointments, using the Phorest salon management API.

**Commission rule:** 20% of the as-billed appointment price for every service performed during a client's first-ever visit, attributed to the stylist who performed the service.

## Architecture

### API Integration (Server-Side)

Next.js API route at `/api/phorest/commissions` proxies requests to the Phorest Third Party API v1.23.0. Phorest Basic Auth credentials are stored as server-only environment variables (not `NEXT_PUBLIC_`).

**Environment variables:**
```
PHOREST_API_URL=https://platform.phorest.com/third-party-api-server
PHOREST_BUSINESS_ID=your-business-id
PHOREST_USERNAME=your-username
PHOREST_PASSWORD=your-password
```

### Data Flow (Appointments-First Approach)

The frontend sends `{ startDate, endDate }` to the API route. The server:

1. Check Supabase cache for this date range. If valid cache exists, return it.
2. On cache miss, fetch from Phorest:
   a. `GET /api/business/{businessId}/branch` — list all branches
   b. For each branch:
      - `GET /branch/{branchId}/staff` — fetch staff (staffId-to-name mapping)
      - `GET /branch/{branchId}/appointment?from_date=start&to_date=end` — paginate through all appointments in the date range
   c. Collect unique `clientId` values from all appointments
   d. `GET /client-batch?client_id=id1&client_id=id2&...` — batch-fetch client details (up to 100 per call)
   e. Filter clients where `firstVisit` falls within [startDate, endDate]
   f. For each qualifying client, their appointments from step (b) are commission-eligible
3. Calculate: `commission = appointment.price * 0.2`
4. Aggregate by stylist within each branch
5. Cache results in Supabase, return to frontend

### Phorest API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/business/{id}/branch` | GET | List all branch locations |
| `/api/business/{id}/branch/{branchId}/staff` | GET | Staff roster per branch |
| `/api/business/{id}/branch/{branchId}/appointment` | GET | Appointments filtered by date range |
| `/api/business/{id}/client-batch` | GET | Batch client lookup (max 100) |

**Pagination:** All list endpoints max 100 per page. Paginate until `page.number >= page.totalPages - 1`.

**Rate limit:** 100 requests per second. Sequential processing stays well under this.

**Authentication:** HTTP Basic Auth with the provided credentials.

### Cache Layer (Supabase)

Single table storing processed commission results as JSONB:

```sql
CREATE TABLE phorest_commission_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_range_key TEXT NOT NULL UNIQUE,
  results JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

- `date_range_key`: `"2026-01-01_2026-01-31"` format
- Cache TTL: 1 hour
- Frontend "Refresh" button bypasses cache
- Upsert on cache miss

### Edge Cases

- **Client with `firstVisit = null`:** Skip (no visit data available)
- **Appointment with `price = 0` or `null`:** Skip (no commission)
- **Canceled/deleted appointments:** Excluded via `activationState !== 'CANCELED'` and `deleted !== true`
- **Archived staff:** Still included (commission was earned)
- **Multi-service first visit:** All services from the first visit are commission-eligible
- **Client visits multiple branches on first visit:** Each branch counts separately
- **Walk-in clients:** Included if they have a `firstVisit` in the range
- **Appointments max 1-month range from Phorest:** If user selects a wider range, split into monthly chunks

## Frontend

### Route

`/new-contact-commission` — password-gated with the existing `PasswordGate` component.

### Landing Page Integration

Added to the `microApps` array in `src/app/page.tsx`:
```ts
{
  name: "New Contact Commission",
  description: "First-visit commission calculator",
  href: "/new-contact-commission",
  icon: "💰",
  color: "#22c55e",
}
```

### Component Structure

```
PasswordGate
  NewContactCommission
    Header (title, back link, theme toggle)
    DateRangeForm (start date, end date, Calculate button, Refresh button)
    LoadingState (spinner + progress text)
    ErrorState (error message + retry button)
    ResultsDisplay
      SummaryCards (total commission, total new clients, branches count)
      BranchSection[] (per branch)
        BranchHeader (branch name, branch total)
        StylistGroup[] (per stylist within branch)
          StylistHeader (stylist name, stylist total)
          ClientRow[] (client name, date, service name, price, commission)
        BranchSummaryRow
```

### Styling

Uses existing CSS variable system. No new design tokens. Matches the app's gold-accent, dark/light theme pattern. Same card borders, hover effects, and typography as other features.

## File Structure

```
src/app/new-contact-commission/page.tsx        # Route (PasswordGate wrapper)
src/components/NewContactCommission.tsx         # Main UI component
src/lib/phorestApi.ts                           # Frontend client for /api/phorest/*
src/app/api/phorest/commissions/route.ts        # Server-side API route
src/types/phorest.ts                            # TypeScript types
```

## Data Types

```ts
interface CommissionResult {
  branches: BranchCommission[];
  totalCommission: number;
  totalNewClients: number;
  fetchedAt: string;
}

interface BranchCommission {
  branchId: string;
  branchName: string;
  stylists: StylistCommission[];
  branchTotal: number;
}

interface StylistCommission {
  staffId: string;
  staffName: string;
  clients: ClientCommission[];
  stylistTotal: number;
}

interface ClientCommission {
  clientId: string;
  clientName: string;
  firstVisitDate: string;
  services: ServiceCommission[];
  clientTotal: number;
}

interface ServiceCommission {
  appointmentId: string;
  serviceName: string;
  appointmentDate: string;
  price: number;
  commission: number;
}
```
