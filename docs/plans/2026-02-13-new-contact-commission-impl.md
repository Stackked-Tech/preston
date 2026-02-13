# New Contact Commission - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a commission calculator that identifies first-time salon clients from the Phorest API and computes 20% commission per appointment, grouped by stylist and branch.

**Architecture:** Next.js API route proxies to Phorest API (Basic Auth, server-only credentials). Appointments-first data flow: fetch appointments in date range, batch-lookup clients, filter by `firstVisit`, calculate commissions. Results cached in Supabase as JSONB with 1-hour TTL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (cache), Phorest Third Party API v1.23.0, Tailwind CSS 3

**Design doc:** `docs/plans/2026-02-13-new-contact-commission-design.md`

---

## Task 1: Add Phorest Environment Variables

**Files:**
- Modify: `.env` (add 4 new variables)
- Modify: `.env.local.example` (add placeholder entries)

**Step 1: Add Phorest credentials to `.env`**

Append to the existing `.env` file:

```
PHOREST_API_URL=https://platform.phorest.com/third-party-api-server
PHOREST_BUSINESS_ID=your-business-id
PHOREST_USERNAME=your-username
PHOREST_PASSWORD=your-password
```

**Important:** These are NOT prefixed with `NEXT_PUBLIC_` — they are server-only.

**Step 2: Update `.env.local.example` with placeholders**

Append:

```
PHOREST_API_URL=https://platform.phorest.com/third-party-api-server
PHOREST_BUSINESS_ID=your-business-id
PHOREST_USERNAME=your-username
PHOREST_PASSWORD=your-password
```

**Step 3: Commit**

```bash
git add .env.local.example
git commit -m "feat: add Phorest API env var placeholders"
```

Note: Do NOT commit `.env` — it should be in `.gitignore` (verify first).

---

## Task 2: Create TypeScript Types

**Files:**
- Create: `src/types/phorest.ts`

**Step 1: Create the types file**

```ts
// Phorest API response types

export interface PhorestBranch {
  branchId: string;
  name: string;
  timeZone?: string;
  city?: string;
  state?: string;
}

export interface PhorestStaff {
  staffId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  archived: boolean;
}

export interface PhorestAppointment {
  appointmentId: string;
  branchId: string;
  clientId: string;
  staffId: string;
  serviceId: string;
  serviceName?: string;
  appointmentDate: string;
  startTime: { hourOfDay: number; minuteOfHour: number } | string;
  price: number;
  state: "BOOKED" | "CHECKED_IN" | "PAID";
  activationState: "RESERVED" | "ACTIVE" | "CANCELED";
  deleted?: boolean;
}

export interface PhorestClient {
  clientId: string;
  firstName: string;
  lastName: string;
  firstVisit?: string | null;
  clientSince?: string;
  archived?: boolean;
  deleted?: boolean;
}

export interface PhorestPageMetadata {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
}

// Commission calculation result types

export interface CommissionResult {
  branches: BranchCommission[];
  totalCommission: number;
  totalNewClients: number;
  fetchedAt: string;
}

export interface BranchCommission {
  branchId: string;
  branchName: string;
  stylists: StylistCommission[];
  branchTotal: number;
}

export interface StylistCommission {
  staffId: string;
  staffName: string;
  clients: ClientCommission[];
  stylistTotal: number;
}

export interface ClientCommission {
  clientId: string;
  clientName: string;
  firstVisitDate: string;
  services: ServiceCommission[];
  clientTotal: number;
}

export interface ServiceCommission {
  appointmentId: string;
  serviceName: string;
  appointmentDate: string;
  price: number;
  commission: number;
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/types/phorest.ts`

If there's a tsconfig issue, just run `npm run build` later — it will catch type errors.

**Step 3: Commit**

```bash
git add src/types/phorest.ts
git commit -m "feat: add Phorest API and commission TypeScript types"
```

---

## Task 3: Create the Supabase Cache Migration

**Files:**
- Create: `supabase-phorest-cache-schema.sql`

**Step 1: Write the migration SQL**

```sql
-- Phorest commission cache table
-- Stores processed commission results as JSONB to avoid repeated API calls

CREATE TABLE IF NOT EXISTS phorest_commission_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_range_key TEXT NOT NULL UNIQUE,
  results JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS (permissive, matching existing app pattern)
ALTER TABLE phorest_commission_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to commission cache"
  ON phorest_commission_cache FOR ALL
  USING (true) WITH CHECK (true);

-- Index for lookups by date range
CREATE INDEX IF NOT EXISTS idx_commission_cache_date_range
  ON phorest_commission_cache (date_range_key);
```

**Step 2: Apply the migration**

Run this SQL in the Supabase dashboard SQL editor (or via CLI if `supabase` CLI is set up).

**Step 3: Commit**

```bash
git add supabase-phorest-cache-schema.sql
git commit -m "feat: add Supabase schema for Phorest commission cache"
```

---

## Task 4: Build the Phorest API Client (Server-Side)

**Files:**
- Create: `src/lib/phorestClient.ts`

This is the server-side Phorest API client used by the API route. It handles authentication, pagination, and all Phorest API calls.

**Step 1: Create the Phorest client**

```ts
import type {
  PhorestBranch,
  PhorestStaff,
  PhorestAppointment,
  PhorestClient,
  PhorestPageMetadata,
} from "@/types/phorest";

const API_URL = process.env.PHOREST_API_URL;
const BUSINESS_ID = process.env.PHOREST_BUSINESS_ID;
const USERNAME = process.env.PHOREST_USERNAME;
const PASSWORD = process.env.PHOREST_PASSWORD;

function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
}

function getBaseUrl(): string {
  return `${API_URL}/api/business/${BUSINESS_ID}`;
}

async function phorestFetch(path: string): Promise<Response> {
  const url = path.startsWith("http") ? path : `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Phorest API error ${res.status}: ${body}`);
  }
  return res;
}

// Generic paginated fetch — collects all pages into a single array
async function fetchAllPages<T>(
  path: string,
  embeddedKey: string
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const separator = path.includes("?") ? "&" : "?";
    const res = await phorestFetch(`${path}${separator}page=${page}&size=100`);
    const data = await res.json();

    const items = data._embedded?.[embeddedKey] ?? [];
    allItems.push(...items);

    const pageMeta: PhorestPageMetadata = data.page;
    totalPages = pageMeta.totalPages;
    page++;
  }

  return allItems;
}

export async function fetchBranches(): Promise<PhorestBranch[]> {
  return fetchAllPages<PhorestBranch>("/branch", "branches");
}

export async function fetchStaff(branchId: string): Promise<PhorestStaff[]> {
  return fetchAllPages<PhorestStaff>(
    `/branch/${branchId}/staff?fetch_archived=true`,
    "staffs"
  );
}

export async function fetchAppointments(
  branchId: string,
  fromDate: string,
  toDate: string
): Promise<PhorestAppointment[]> {
  // Phorest limits appointment queries to 1-month range
  // Split into monthly chunks if needed
  const chunks = splitIntoMonthlyRanges(fromDate, toDate);
  const allAppointments: PhorestAppointment[] = [];

  for (const chunk of chunks) {
    const appointments = await fetchAllPages<PhorestAppointment>(
      `/branch/${branchId}/appointment?from_date=${chunk.from}&to_date=${chunk.to}`,
      "appointments"
    );
    allAppointments.push(...appointments);
  }

  return allAppointments;
}

export async function fetchClientsBatch(
  clientIds: string[]
): Promise<PhorestClient[]> {
  if (clientIds.length === 0) return [];

  const allClients: PhorestClient[] = [];

  // client-batch supports max 100 IDs per call
  for (let i = 0; i < clientIds.length; i += 100) {
    const batch = clientIds.slice(i, i + 100);
    const params = batch.map((id) => `client_id=${id}`).join("&");
    const res = await phorestFetch(`/client-batch?${params}`);
    const data = await res.json();
    const clients = data._embedded?.clients ?? [];
    allClients.push(...clients);
  }

  return allClients;
}

// Helper: split a date range into 1-month chunks for Phorest's appointment API
function splitIntoMonthlyRanges(
  fromDate: string,
  toDate: string
): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);

  let current = new Date(start);

  while (current <= end) {
    const chunkEnd = new Date(current);
    chunkEnd.setMonth(chunkEnd.getMonth() + 1);
    chunkEnd.setDate(chunkEnd.getDate() - 1);

    const actualEnd = chunkEnd > end ? end : chunkEnd;

    ranges.push({
      from: current.toISOString().split("T")[0],
      to: actualEnd.toISOString().split("T")[0],
    });

    current = new Date(actualEnd);
    current.setDate(current.getDate() + 1);
  }

  return ranges;
}
```

**Step 2: Verify it compiles**

Run: `npm run build`

Expected: Build succeeds (the file isn't used yet, but imports should resolve).

**Step 3: Commit**

```bash
git add src/lib/phorestClient.ts
git commit -m "feat: add Phorest API client with pagination and auth"
```

---

## Task 5: Build the Commission Calculation Logic

**Files:**
- Create: `src/lib/commissionCalculator.ts`

This contains the core business logic: given appointments and clients, calculate commissions grouped by branch and stylist.

**Step 1: Create the calculator**

```ts
import type {
  PhorestAppointment,
  PhorestClient,
  PhorestStaff,
  PhorestBranch,
  CommissionResult,
  BranchCommission,
  StylistCommission,
  ClientCommission,
  ServiceCommission,
} from "@/types/phorest";

const COMMISSION_RATE = 0.2;

interface BranchData {
  branch: PhorestBranch;
  staff: PhorestStaff[];
  appointments: PhorestAppointment[];
}

export function calculateCommissions(
  branchDataList: BranchData[],
  clients: PhorestClient[],
  startDate: string,
  endDate: string
): CommissionResult {
  // Build client lookup map
  const clientMap = new Map<string, PhorestClient>();
  for (const client of clients) {
    clientMap.set(client.clientId, client);
  }

  // Filter to first-visit clients within date range
  const firstVisitClientIds = new Set<string>();
  for (const client of clients) {
    if (
      client.firstVisit &&
      client.firstVisit >= startDate &&
      client.firstVisit <= endDate &&
      !client.deleted
    ) {
      firstVisitClientIds.add(client.clientId);
    }
  }

  const branches: BranchCommission[] = [];
  let totalCommission = 0;
  const allNewClientIds = new Set<string>();

  for (const { branch, staff, appointments } of branchDataList) {
    // Build staff lookup
    const staffMap = new Map<string, string>();
    for (const s of staff) {
      staffMap.set(s.staffId, `${s.firstName} ${s.lastName}`.trim());
    }

    // Filter appointments to first-visit clients, active/non-deleted, with price
    const eligibleAppointments = appointments.filter(
      (appt) =>
        firstVisitClientIds.has(appt.clientId) &&
        appt.activationState !== "CANCELED" &&
        !appt.deleted &&
        appt.price != null &&
        appt.price > 0
    );

    if (eligibleAppointments.length === 0) continue;

    // Group by stylist
    const stylistGroups = new Map<string, PhorestAppointment[]>();
    for (const appt of eligibleAppointments) {
      const key = appt.staffId;
      if (!stylistGroups.has(key)) stylistGroups.set(key, []);
      stylistGroups.get(key)!.push(appt);
    }

    const stylists: StylistCommission[] = [];
    let branchTotal = 0;

    for (const [staffId, appts] of stylistGroups) {
      // Group by client within stylist
      const clientGroups = new Map<string, PhorestAppointment[]>();
      for (const appt of appts) {
        if (!clientGroups.has(appt.clientId)) clientGroups.set(appt.clientId, []);
        clientGroups.get(appt.clientId)!.push(appt);
      }

      const clientCommissions: ClientCommission[] = [];
      let stylistTotal = 0;

      for (const [clientId, clientAppts] of clientGroups) {
        const client = clientMap.get(clientId);
        if (!client) continue;

        allNewClientIds.add(clientId);

        const services: ServiceCommission[] = clientAppts.map((appt) => {
          const commission = Math.round(appt.price * COMMISSION_RATE * 100) / 100;
          return {
            appointmentId: appt.appointmentId,
            serviceName: appt.serviceName || "Service",
            appointmentDate: appt.appointmentDate,
            price: appt.price,
            commission,
          };
        });

        const clientTotal = services.reduce((sum, s) => sum + s.commission, 0);
        const clientTotalRounded = Math.round(clientTotal * 100) / 100;

        clientCommissions.push({
          clientId,
          clientName: `${client.firstName} ${client.lastName}`.trim(),
          firstVisitDate: client.firstVisit!,
          services,
          clientTotal: clientTotalRounded,
        });

        stylistTotal += clientTotalRounded;
      }

      stylistTotal = Math.round(stylistTotal * 100) / 100;

      stylists.push({
        staffId,
        staffName: staffMap.get(staffId) || "Unknown Stylist",
        clients: clientCommissions,
        stylistTotal,
      });

      branchTotal += stylistTotal;
    }

    branchTotal = Math.round(branchTotal * 100) / 100;
    totalCommission += branchTotal;

    branches.push({
      branchId: branch.branchId,
      branchName: branch.name,
      stylists,
      branchTotal,
    });
  }

  totalCommission = Math.round(totalCommission * 100) / 100;

  return {
    branches,
    totalCommission,
    totalNewClients: allNewClientIds.size,
    fetchedAt: new Date().toISOString(),
  };
}
```

**Step 2: Verify it compiles**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/lib/commissionCalculator.ts
git commit -m "feat: add commission calculation logic with stylist/branch aggregation"
```

---

## Task 6: Build the API Route

**Files:**
- Create: `src/app/api/phorest/commissions/route.ts`

This is the server-side API route the frontend calls. It orchestrates the Phorest API calls, uses the cache, and returns commission results.

**Step 1: Create the API route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchBranches,
  fetchStaff,
  fetchAppointments,
  fetchClientsBatch,
} from "@/lib/phorestClient";
import { calculateCommissions } from "@/lib/commissionCalculator";
import type { CommissionResult } from "@/types/phorest";

const CACHE_TTL_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, forceRefresh } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    const dateRangeKey = `${startDate}_${endDate}`;

    // Check cache (if Supabase is configured)
    if (isSupabaseConfigured && !forceRefresh) {
      const { data: cached } = await supabase
        .from("phorest_commission_cache")
        .select("results, expires_at")
        .eq("date_range_key", dateRangeKey)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return NextResponse.json(cached.results as CommissionResult);
      }
    }

    // Fetch from Phorest API
    const branches = await fetchBranches();

    const branchDataList = [];

    for (const branch of branches) {
      const [staff, appointments] = await Promise.all([
        fetchStaff(branch.branchId),
        fetchAppointments(branch.branchId, startDate, endDate),
      ]);

      branchDataList.push({ branch, staff, appointments });
    }

    // Collect unique client IDs from all appointments
    const allClientIds = new Set<string>();
    for (const { appointments } of branchDataList) {
      for (const appt of appointments) {
        if (appt.clientId) {
          allClientIds.add(appt.clientId);
        }
      }
    }

    // Batch-fetch client details
    const clients = await fetchClientsBatch(Array.from(allClientIds));

    // Calculate commissions
    const results = calculateCommissions(
      branchDataList,
      clients,
      startDate,
      endDate
    );

    // Cache results in Supabase
    if (isSupabaseConfigured) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

      await supabase.from("phorest_commission_cache").upsert(
        {
          date_range_key: dateRangeKey,
          results,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "date_range_key" }
      );
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Commission calculation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate commissions",
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the route works**

Start the dev server: `npm run dev`

Test with curl:

```bash
curl -X POST http://localhost:3000/api/phorest/commissions \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-01-01","endDate":"2026-01-31"}'
```

Expected: JSON response with commission results (may be empty if no first-visit clients exist in that range, but should not error).

**Step 3: Commit**

```bash
git add src/app/api/phorest/commissions/route.ts
git commit -m "feat: add API route for Phorest commission calculation"
```

---

## Task 7: Create the Frontend API Client

**Files:**
- Create: `src/lib/phorestApi.ts`

This is the client-side helper that calls our own API route (not Phorest directly).

**Step 1: Create the frontend client**

```ts
import type { CommissionResult } from "@/types/phorest";

export async function fetchCommissions(
  startDate: string,
  endDate: string,
  forceRefresh = false
): Promise<CommissionResult> {
  const res = await fetch("/api/phorest/commissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, forceRefresh }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }

  return res.json();
}
```

**Step 2: Commit**

```bash
git add src/lib/phorestApi.ts
git commit -m "feat: add frontend API client for commission endpoint"
```

---

## Task 8: Build the NewContactCommission Component

**Files:**
- Create: `src/components/NewContactCommission.tsx`

This is the main UI component. It contains the date range form, loading state, error state, and results display.

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { fetchCommissions } from "@/lib/phorestApi";
import type { CommissionResult } from "@/types/phorest";

export default function NewContactCommission() {
  const { theme, toggleTheme } = useTheme();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [results, setResults] = useState<CommissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (forceRefresh = false) => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommissions(startDate, endDate, forceRefresh);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-10 py-6 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-sans no-underline transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            &larr; Back
          </Link>
          <div>
            <h1
              className="text-[22px] font-light tracking-[3px] uppercase m-0"
              style={{ color: "var(--gold)" }}
            >
              New Contact Commission
            </h1>
            <p
              className="text-[10px] font-sans tracking-[2px] uppercase mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              First-visit commission calculator
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="border px-3 py-1.5 rounded-md text-xs font-sans tracking-[1px] uppercase transition-all"
          style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
        >
          {theme === "dark" ? "\u2600 Light" : "\u25CF Dark"}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-10 py-8 font-sans">
        {/* Date Range Form */}
        <div
          className="rounded-xl border p-6 mb-8"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                className="block text-xs uppercase tracking-[1px] mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border px-4 py-2 text-sm outline-none"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs uppercase tracking-[1px] mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border px-4 py-2 text-sm outline-none"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <button
              onClick={() => handleCalculate(false)}
              disabled={loading || !startDate || !endDate}
              className="rounded-lg px-6 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--gold)", color: "#0a0b0e" }}
            >
              {loading ? "Calculating..." : "Calculate"}
            </button>
            {results && (
              <button
                onClick={() => handleCalculate(true)}
                disabled={loading}
                className="rounded-lg border px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4"
              style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
            />
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Fetching appointments from Phorest...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div
            className="rounded-xl border p-6 text-center"
            style={{
              borderColor: "#ef4444",
              background: "rgba(239, 68, 68, 0.05)",
            }}
          >
            <p className="text-sm mb-3" style={{ color: "#ef4444" }}>
              {error}
            </p>
            <button
              onClick={() => handleCalculate(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                {
                  label: "Total Commission",
                  value: `$${results.totalCommission.toFixed(2)}`,
                },
                {
                  label: "New Clients",
                  value: results.totalNewClients.toString(),
                },
                {
                  label: "Branches",
                  value: results.branches.length.toString(),
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border p-5"
                  style={{
                    background: "var(--bg-secondary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[1px] mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {card.label}
                  </p>
                  <p
                    className="text-2xl font-light"
                    style={{ color: "var(--gold)" }}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {/* No results message */}
            {results.branches.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No first-time client appointments found in this date range.
                </p>
              </div>
            )}

            {/* Per-Branch Results */}
            {results.branches.map((branch) => (
              <div
                key={branch.branchId}
                className="rounded-xl border mb-6 overflow-hidden"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                }}
              >
                {/* Branch Header */}
                <div
                  className="flex items-center justify-between px-6 py-4 border-b"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <h2
                    className="text-base font-medium tracking-wide"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {branch.branchName}
                  </h2>
                  <span
                    className="text-lg font-light"
                    style={{ color: "var(--gold)" }}
                  >
                    ${branch.branchTotal.toFixed(2)}
                  </span>
                </div>

                {/* Per-Stylist Sections */}
                {branch.stylists.map((stylist) => (
                  <div key={stylist.staffId}>
                    {/* Stylist Header */}
                    <div
                      className="flex items-center justify-between px-6 py-3 border-b"
                      style={{
                        borderColor: "var(--border-light)",
                        background: "var(--card-bg)",
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {stylist.staffName}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: "var(--gold)" }}
                      >
                        ${stylist.stylistTotal.toFixed(2)}
                      </span>
                    </div>

                    {/* Client Rows */}
                    {stylist.clients.map((client) =>
                      client.services.map((service) => (
                        <div
                          key={service.appointmentId}
                          className="flex items-center justify-between px-6 py-2.5 border-b text-sm"
                          style={{ borderColor: "var(--border-light)" }}
                        >
                          <div className="flex items-center gap-6 flex-1">
                            <span
                              className="w-40 truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {client.clientName}
                            </span>
                            <span
                              className="w-28"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {service.appointmentDate}
                            </span>
                            <span
                              className="flex-1 truncate"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {service.serviceName}
                            </span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span
                              className="w-20 text-right"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              ${service.price.toFixed(2)}
                            </span>
                            <span
                              className="w-20 text-right font-medium"
                              style={{ color: "var(--gold)" }}
                            >
                              ${service.commission.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Fetched timestamp */}
            <p
              className="text-[10px] text-right mt-2"
              style={{ color: "var(--text-muted)" }}
            >
              Data fetched: {new Date(results.fetchedAt).toLocaleString()}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/NewContactCommission.tsx
git commit -m "feat: add NewContactCommission UI component"
```

---

## Task 9: Create the Route Page and Add to Landing

**Files:**
- Create: `src/app/new-contact-commission/page.tsx`
- Modify: `src/app/page.tsx` (add to `microApps` array)

**Step 1: Create the route page**

```tsx
import NewContactCommission from "@/components/NewContactCommission";
import PasswordGate from "@/components/PasswordGate";

export default function NewContactCommissionPage() {
  return (
    <PasswordGate>
      <NewContactCommission />
    </PasswordGate>
  );
}
```

**Step 2: Add card to landing page**

In `src/app/page.tsx`, add a new entry to the `microApps` array after the "Signed to Sealed" entry:

```ts
{
  name: "New Contact Commission",
  description: "First-visit commission calculator",
  href: "/new-contact-commission",
  icon: "💰",
  color: "#22c55e",
},
```

**Step 3: Verify in browser**

Run: `npm run dev`

1. Visit `http://localhost:3000` — verify the new card appears in the grid
2. Click the card — verify the password gate appears
3. Enter password `BT28012!` — verify the commission calculator loads
4. Select a date range and click Calculate — verify results load (or show "no results" if the date range has no first-visit clients)

**Step 4: Commit**

```bash
git add src/app/new-contact-commission/page.tsx src/app/page.tsx
git commit -m "feat: add New Contact Commission route and landing page card"
```

---

## Task 10: Build Verification and Polish

**Files:**
- Possibly modify: `src/components/NewContactCommission.tsx` (if fixes needed)
- Possibly modify: `src/app/api/phorest/commissions/route.ts` (if fixes needed)

**Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors (fix any that appear).

**Step 3: End-to-end manual test**

1. Start dev server: `npm run dev`
2. Navigate to the landing page — verify 4 cards show
3. Click "New Contact Commission" — enter password
4. Select a date range (try last 30 days)
5. Click "Calculate" — verify loading spinner appears
6. Verify results display correctly (or "no results" message)
7. Click "Refresh" — verify fresh data loads
8. Toggle dark/light mode — verify styling works in both
9. Try invalid date range (end before start) — verify error handling

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete New Contact Commission feature"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Environment variables | `.env`, `.env.local.example` |
| 2 | TypeScript types | `src/types/phorest.ts` |
| 3 | Supabase cache schema | `supabase-phorest-cache-schema.sql` |
| 4 | Phorest API client | `src/lib/phorestClient.ts` |
| 5 | Commission calculator | `src/lib/commissionCalculator.ts` |
| 6 | API route | `src/app/api/phorest/commissions/route.ts` |
| 7 | Frontend API client | `src/lib/phorestApi.ts` |
| 8 | UI component | `src/components/NewContactCommission.tsx` |
| 9 | Route + landing page | `src/app/new-contact-commission/page.tsx`, `src/app/page.tsx` |
| 10 | Build verification | All files (lint, build, manual test) |
