# Time Clock Admin Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the R Alexander Time Clock into a multi-company contractor management system with approval workflows, crew batch entry, and NetSuite-ready export.

**Architecture:** Evolve the existing time clock in place. Add `tc_companies` table, extend `tc_employees`/`tc_jobs`/`tc_time_entries` with new columns, update all hooks and UI components. The admin grows from 6 tabs to 9 tabs. New Approval Queue and Crew Entry tabs are extracted into separate component files to keep `TimeClockAdmin.tsx` manageable.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (client-side SDK), Tailwind CSS, papaparse (CSV export)

---

### Task 1: Database Migration SQL

**Files:**
- Create: `supabase-timeclock-overhaul.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Time Clock Overhaul Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Companies table
CREATE TABLE IF NOT EXISTS tc_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE tc_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tc_companies" ON tc_companies
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Add company_id + billable_rate to tc_employees
ALTER TABLE tc_employees
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES tc_companies(id),
  ADD COLUMN IF NOT EXISTS billable_rate DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tc_employees_company_id ON tc_employees(company_id);

-- 3. Add company_id to tc_jobs
ALTER TABLE tc_jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES tc_companies(id);

CREATE INDEX IF NOT EXISTS idx_tc_jobs_company_id ON tc_jobs(company_id);

-- 4. Add approval fields to tc_time_entries
ALTER TABLE tc_time_entries
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flag_note TEXT;

CREATE INDEX IF NOT EXISTS idx_tc_time_entries_approval ON tc_time_entries(approval_status);
```

**Step 2: Verify the file was written correctly**

Run: `cat supabase-timeclock-overhaul.sql | head -5`
Expected: The CREATE TABLE statement header

**Step 3: Commit**

```bash
git add supabase-timeclock-overhaul.sql
git commit -m "feat: add time clock overhaul migration SQL"
```

---

### Task 2: Update Type Definitions

**Files:**
- Modify: `src/types/timeclock.ts`

**Step 1: Add TCCompany type and update existing types**

Add after line 1 (before TCEmployee):

```typescript
export interface TCCompany {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export type TCCompanyInsert = Omit<TCCompany, "id" | "created_at">;
```

Update `TCEmployee` to add `company_id` and `billable_rate`:

```typescript
export interface TCEmployee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  company_id: string | null;
  billable_rate: number;
  created_at: string;
}
```

Update `TCJob` to add `company_id`:

```typescript
export interface TCJob {
  id: string;
  name: string;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
}
```

Update `TCTimeEntry` to add approval fields:

```typescript
export interface TCTimeEntry {
  id: string;
  employee_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  notes: string;
  approval_status: "pending" | "approved" | "flagged";
  approved_by: string | null;
  approved_at: string | null;
  flag_note: string | null;
  created_at: string;
}
```

Update `TCDailyEntry` — remove `isOvertime`:

```typescript
export interface TCDailyEntry {
  employee: TCEmployee;
  entry: TCTimeEntry;
  hours: number;
  isStale: boolean;
  jobName: string | null;
}
```

Update `TCWeeklySummary` — remove overtime fields:

```typescript
export interface TCWeeklySummary {
  employee: TCEmployee;
  dailyHours: number[];
  weeklyTotal: number;
}
```

Remove `TCOvertimeSettings` interface entirely.

**Step 2: Build check**

Run: `cd /Users/johnlohr/StackkedDev/PrestonProjects/preston && npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in hooks and components that reference removed overtime types (this is expected — we'll fix in subsequent tasks)

**Step 3: Commit**

```bash
git add src/types/timeclock.ts
git commit -m "feat: update time clock types for multi-company + approval"
```

---

### Task 3: Add useCompanies Hook

**Files:**
- Modify: `src/lib/timeClockHooks.ts` (add new hook at top, after imports)

**Step 1: Add TCCompany import**

Update the import at line 6 to include `TCCompany` and `TCCompanyInsert`:

```typescript
import type {
  TCCompany,
  TCCompanyInsert,
  TCEmployee,
  TCEmployeeInsert,
  TCTimeEntry,
  TCLocationSettings,
  TCJob,
} from "@/types/timeclock";
```

Note: Remove `TCOvertimeSettings` from the import — it no longer exists.

**Step 2: Add useCompanies hook after imports (before useEmployees)**

```typescript
// ─── Companies ──────────────────────────────────────────

export function useCompanies() {
  const [companies, setCompanies] = useState<TCCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("tc_companies")
        .select("*")
        .order("name", { ascending: true });
      if (err) throw err;
      setCompanies((data || []) as TCCompany[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const addCompany = async (name: string): Promise<TCCompany> => {
    const insert: TCCompanyInsert = { name, is_active: true };
    const { data, error } = await supabase
      .from("tc_companies")
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    const created = data as TCCompany;
    setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from("tc_companies")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: isActive } : c))
    );
  };

  const activeCompanies = companies.filter((c) => c.is_active);

  return { companies, activeCompanies, loading, error, refetch: fetchCompanies, addCompany, toggleActive };
}
```

**Step 3: Commit**

```bash
git add src/lib/timeClockHooks.ts
git commit -m "feat: add useCompanies hook"
```

---

### Task 4: Update useEmployees Hook (company_id + billable_rate)

**Files:**
- Modify: `src/lib/timeClockHooks.ts` — `useEmployees` function (lines 16-93)

**Step 1: Update addEmployee to accept company_id and billable_rate**

Change the `addEmployee` function signature and insert object:

```typescript
const addEmployee = async (firstName: string, lastName: string, companyId: string, billableRate: number): Promise<TCEmployee> => {
  const { data: maxRow } = await supabase
    .from("tc_employees")
    .select("employee_number")
    .order("employee_number", { ascending: false })
    .limit(1);

  const maxNum = maxRow && maxRow.length > 0 ? parseInt(maxRow[0].employee_number, 10) : 1000;
  const nextNum = (isNaN(maxNum) ? 1000 : maxNum) + 1;

  const insert: TCEmployeeInsert = {
    employee_number: String(nextNum),
    first_name: firstName,
    last_name: lastName,
    is_active: true,
    company_id: companyId,
    billable_rate: billableRate,
  };

  const { data, error } = await supabase
    .from("tc_employees")
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  const created = data as TCEmployee;
  setEmployees((prev) => [...prev, created]);
  return created;
};
```

**Step 2: Add updateEmployee for editing billable rate**

Add after `toggleActive`:

```typescript
const updateEmployee = async (id: string, updates: { billable_rate?: number; company_id?: string }): Promise<void> => {
  const { error } = await supabase
    .from("tc_employees")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
  setEmployees((prev) =>
    prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
  );
};
```

**Step 3: Update return statement**

```typescript
return { employees, loading, error, refetch: fetchEmployees, addEmployee, toggleActive, updateEmployee, findByNumber };
```

**Step 4: Commit**

```bash
git add src/lib/timeClockHooks.ts
git commit -m "feat: update useEmployees for company_id and billable_rate"
```

---

### Task 5: Update useJobs Hook (company scoping)

**Files:**
- Modify: `src/lib/timeClockHooks.ts` — `useJobs` function (lines 97-154)

**Step 1: Update addJob to accept companyId**

```typescript
const addJob = async (name: string, companyId: string): Promise<TCJob> => {
  const { data, error } = await supabase
    .from("tc_jobs")
    .insert({ name, is_active: true, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  const created = data as TCJob;
  setJobs((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  return created;
};
```

**Step 2: Add helper to get jobs by company**

```typescript
const getJobsByCompany = (companyId: string) => jobs.filter((j) => j.company_id === companyId && j.is_active);
```

**Step 3: Update return statement**

```typescript
return { jobs, activeJobs, loading, error, refetch: fetchJobs, addJob, toggleActive, getJobsByCompany };
```

**Step 4: Commit**

```bash
git add src/lib/timeClockHooks.ts
git commit -m "feat: scope jobs to companies"
```

---

### Task 6: Update useTimeEntries Hook (approval + batch create)

**Files:**
- Modify: `src/lib/timeClockHooks.ts` — `useTimeEntries` function (lines 158-231)

**Step 1: Add approval methods**

Add after `updateEntry`:

```typescript
const approveEntry = async (entryId: string, approvedBy: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tc_time_entries")
    .update({ approval_status: "approved", approved_by: approvedBy, approved_at: now })
    .eq("id", entryId);
  if (error) throw error;
  setEntries((prev) =>
    prev.map((e) => (e.id === entryId ? { ...e, approval_status: "approved" as const, approved_by: approvedBy, approved_at: now } : e))
  );
};

const flagEntry = async (entryId: string, flagNote: string): Promise<void> => {
  const { error } = await supabase
    .from("tc_time_entries")
    .update({ approval_status: "flagged", flag_note: flagNote })
    .eq("id", entryId);
  if (error) throw error;
  setEntries((prev) =>
    prev.map((e) => (e.id === entryId ? { ...e, approval_status: "flagged" as const, flag_note: flagNote } : e))
  );
};

const bulkApprove = async (entryIds: string[], approvedBy: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tc_time_entries")
    .update({ approval_status: "approved", approved_by: approvedBy, approved_at: now })
    .in("id", entryIds);
  if (error) throw error;
  setEntries((prev) =>
    prev.map((e) =>
      entryIds.includes(e.id) ? { ...e, approval_status: "approved" as const, approved_by: approvedBy, approved_at: now } : e
    )
  );
};

const batchClockIn = async (
  employeeIds: string[],
  jobId: string,
  clockIn: string,
  clockOut: string
): Promise<void> => {
  const inserts = employeeIds.map((eid) => ({
    employee_id: eid,
    job_id: jobId,
    clock_in: clockIn,
    clock_out: clockOut,
    approval_status: "pending",
  }));
  const { data, error } = await supabase
    .from("tc_time_entries")
    .insert(inserts)
    .select();
  if (error) throw error;
  setEntries((prev) => [...(data as TCTimeEntry[]), ...prev]);
};
```

**Step 2: Update return statement**

```typescript
return {
  entries, loading, error, refetch: fetchEntries,
  getOpenEntry, clockIn, clockOut, updateEntry,
  approveEntry, flagEntry, bulkApprove, batchClockIn,
};
```

**Step 3: Commit**

```bash
git add src/lib/timeClockHooks.ts
git commit -m "feat: add approval and batch clock-in to useTimeEntries"
```

---

### Task 7: Update useTimeClockReports (remove overtime)

**Files:**
- Modify: `src/lib/timeClockHooks.ts` — `useTimeClockReports` function (lines 283-441)

**Step 1: Remove overtime parameter and logic**

Update the function signature — remove `overtime` param:

```typescript
export function useTimeClockReports(
  employees: TCEmployee[],
  entries: TCTimeEntry[],
  jobs?: TCJob[]
) {
```

**Step 2: Update getDailyEntries — remove isOvertime**

In the `getDailyEntries` return mapping, remove the overtime calculation block (the `employeeDayEntries` filter and `totalDayHours` sum). The return object becomes:

```typescript
return {
  employee,
  entry,
  hours,
  isStale: isStale(entry),
  jobName: job ? job.name : null,
};
```

Return type annotation:

```typescript
.filter(Boolean) as Array<{
  employee: TCEmployee;
  entry: TCTimeEntry;
  hours: number;
  isStale: boolean;
  jobName: string | null;
}>;
```

**Step 3: Update getWeeklySummary — remove overtime flags**

Remove `dailyOvertimeFlags` array and `isWeeklyOvertime`. Return becomes:

```typescript
return {
  employee,
  dailyHours,
  weeklyTotal: Math.round(weeklyTotal * 100) / 100,
};
```

**Step 4: Commit**

```bash
git add src/lib/timeClockHooks.ts
git commit -m "refactor: remove overtime logic from reports"
```

---

### Task 8: Update useTimeClockSettings (remove overtime)

**Files:**
- Modify: `src/lib/timeClockHooks.ts` — `useTimeClockSettings` function (lines 235-279)

**Step 1: Remove overtime state, fetch, and update**

Remove `overtime` state, `setOvertime`, the overtime branch in `fetchSettings`, and the `updateOvertime` function. Keep only location settings:

```typescript
export function useTimeClockSettings() {
  const [location, setLocation] = useState<TCLocationSettings>({ name: "R Alexander Barn", lat: null, lng: null, radius_meters: null });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data } = await supabase.from("tc_settings").select("*");
      if (data) {
        for (const row of data) {
          if (row.setting_key === "location") setLocation(row.setting_value as unknown as TCLocationSettings);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateLocation = async (settings: TCLocationSettings): Promise<void> => {
    const { error } = await supabase
      .from("tc_settings")
      .update({ setting_value: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq("setting_key", "location");
    if (error) throw error;
    setLocation(settings);
  };

  return { location, loading, refetch: fetchSettings, updateLocation };
}
```

**Step 2: Commit**

```bash
git add src/lib/timeClockHooks.ts
git commit -m "refactor: remove overtime from settings hook"
```

---

### Task 9: Update TimeClockAdmin — Imports, State, Tab Structure

**Files:**
- Modify: `src/components/TimeClockAdmin.tsx` (lines 1-56, 128-201)

This task restructures the admin shell — imports, state, and tab bar. Subsequent tasks handle each tab's content.

**Step 1: Update imports**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import {
  useCompanies,
  useEmployees,
  useTimeEntries,
  useTimeClockSettings,
  useTimeClockReports,
  useJobs,
} from "@/lib/timeClockHooks";
import { exportDailyCSV, exportWeeklyCSV, exportMonthlyCSV, exportApprovedCSV } from "@/lib/timeClockExport";
import type { TCCompany } from "@/types/timeclock";
```

**Step 2: Update Tab type**

```typescript
type Tab = "companies" | "contractors" | "jobs" | "approval" | "daily" | "weekly" | "monthly" | "crew" | "settings";
```

**Step 3: Update hook calls and state**

Replace the hook calls (lines 18-23) with:

```typescript
const { theme, toggleTheme } = useTheme();
const { companies, activeCompanies, loading: compLoading, addCompany, toggleActive: toggleCompanyActive } = useCompanies();
const { employees, loading: empLoading, addEmployee, toggleActive, updateEmployee } = useEmployees();
const { entries, loading: entLoading, updateEntry, refetch: refetchEntries, approveEntry, flagEntry, bulkApprove, batchClockIn } = useTimeEntries();
const { location, loading: settLoading, updateLocation } = useTimeClockSettings();
const { jobs, loading: jobsLoading, addJob, toggleActive: toggleJobActive, getJobsByCompany } = useJobs();
const reports = useTimeClockReports(employees, entries, jobs);
```

Replace initial tab state:

```typescript
const [activeTab, setActiveTab] = useState<Tab>("approval");
```

Add company filter state and new form state:

```typescript
// Company filter for reports
const [filterCompanyId, setFilterCompanyId] = useState<string | "all">("all");

// Company form
const [companyName, setCompanyName] = useState("");

// Contractor form (replaces employee form)
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [contractorCompanyId, setContractorCompanyId] = useState("");
const [contractorRate, setContractorRate] = useState("");

// Job form
const [jobName, setJobName] = useState("");
const [jobCompanyId, setJobCompanyId] = useState("");
```

Remove overtime-related state variables (`settDailyThreshold`, `settWeeklyThreshold`).

**Step 4: Update loading check**

```typescript
const loading = compLoading || empLoading || entLoading || settLoading || jobsLoading;
```

**Step 5: Update handleAddEmployee → handleAddContractor**

```typescript
const handleAddContractor = async () => {
  if (!firstName.trim() || !lastName.trim() || !contractorCompanyId) return;
  try {
    await addEmployee(firstName.trim(), lastName.trim(), contractorCompanyId, parseFloat(contractorRate) || 0);
    setFirstName("");
    setLastName("");
    setContractorRate("");
  } catch (err) {
    console.error("Failed to add contractor:", err);
  }
};
```

**Step 6: Update handleAddJob**

```typescript
const handleAddJob = async () => {
  if (!jobName.trim() || !jobCompanyId) return;
  try {
    await addJob(jobName.trim(), jobCompanyId);
    setJobName("");
  } catch (err) {
    console.error("Failed to add job:", err);
  }
};
```

**Step 7: Add handleAddCompany**

```typescript
const handleAddCompany = async () => {
  if (!companyName.trim()) return;
  try {
    await addCompany(companyName.trim());
    setCompanyName("");
  } catch (err) {
    console.error("Failed to add company:", err);
  }
};
```

**Step 8: Update handleSaveSettings — remove overtime**

```typescript
const handleSaveSettings = async () => {
  try {
    await updateLocation({
      name: settLocationName,
      lat: settLat ? parseFloat(settLat) : null,
      lng: settLng ? parseFloat(settLng) : null,
      radius_meters: settRadius ? parseFloat(settRadius) : null,
    });
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
};
```

**Step 9: Update tab bar**

Replace the tabs array (lines 181-188) with:

```typescript
{([
  { key: "approval", label: "Approval Queue" },
  { key: "companies", label: "Companies" },
  { key: "contractors", label: "Contractors" },
  { key: "jobs", label: "Jobs" },
  { key: "daily", label: "Daily Log" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "crew", label: "Crew Entry" },
  { key: "settings", label: "Settings" },
] as const).map((tab) => (
```

**Step 10: Update report calls — remove overtime param**

```typescript
const dailyEntries = reports.getDailyEntries(new Date(dailyDate + "T00:00:00"));
const weeklySummary = reports.getWeeklySummary(weekDate);
const monthlySummary = reports.getMonthlySummary(monthYear, monthMonth);
```

**Step 11: Commit**

```bash
git add src/components/TimeClockAdmin.tsx
git commit -m "refactor: restructure admin shell for multi-company + approval"
```

---

### Task 10: Admin — Companies Tab

**Files:**
- Modify: `src/components/TimeClockAdmin.tsx` — add new tab content block

**Step 1: Add Companies tab content**

Add before the contractors (formerly employees) tab block. This follows the same visual pattern as the existing Employees tab — an add form card at top and a table below:

```tsx
{/* ─── COMPANIES TAB ─── */}
{activeTab === "companies" && (
  <div className="max-w-4xl">
    <div className="p-4 rounded-lg border mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
      <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-3 font-medium" style={{ color: "var(--text-muted)" }}>
        Add Company
      </h3>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCompany()}
          className="flex-1 px-3 py-2 border rounded text-sm font-sans outline-none"
          style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
        />
        <button
          onClick={handleAddCompany}
          disabled={!companyName.trim()}
          className="px-5 py-2 text-xs font-sans font-medium rounded border transition-all disabled:opacity-40"
          style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
        >
          Add
        </button>
      </div>
    </div>

    <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
          {["Company Name", "Status", "Actions"].map((h) => (
            <th key={h} className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {companies.map((company) => (
          <tr key={company.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
            <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>{company.name}</td>
            <td className="py-3 px-3">
              <span
                className="text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded"
                style={{
                  color: company.is_active ? "#66bb6a" : "#78909c",
                  background: company.is_active ? "rgba(102,187,106,0.1)" : "rgba(120,144,156,0.1)",
                  border: `1px solid ${company.is_active ? "rgba(102,187,106,0.2)" : "rgba(120,144,156,0.2)"}`,
                }}
              >
                {company.is_active ? "Active" : "Inactive"}
              </span>
            </td>
            <td className="py-3 px-3">
              <button
                onClick={() => toggleCompanyActive(company.id, !company.is_active)}
                className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
              >
                {company.is_active ? "Deactivate" : "Activate"}
              </button>
            </td>
          </tr>
        ))}
        {companies.length === 0 && (
          <tr>
            <td colSpan={3} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No companies added yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/TimeClockAdmin.tsx
git commit -m "feat: add Companies admin tab"
```

---

### Task 11: Admin — Contractors Tab (replaces Employees)

**Files:**
- Modify: `src/components/TimeClockAdmin.tsx` — replace the employees tab content

**Step 1: Replace the employees tab block**

Change `activeTab === "employees"` to `activeTab === "contractors"`. Update the form to include company selector and billable rate. Update all "Employee" labels to "Contractor" and "Resource Number":

```tsx
{/* ─── CONTRACTORS TAB ─── */}
{activeTab === "contractors" && (
  <div className="max-w-4xl">
    <div className="p-4 rounded-lg border mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
      <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-3 font-medium" style={{ color: "var(--text-muted)" }}>
        Add Contractor
      </h3>
      <div className="flex gap-3 flex-wrap">
        <select
          value={contractorCompanyId}
          onChange={(e) => setContractorCompanyId(e.target.value)}
          className="px-3 py-2 border rounded text-sm font-sans outline-none min-w-[160px]"
          style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
        >
          <option value="">Select Company</option>
          {activeCompanies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="flex-1 px-3 py-2 border rounded text-sm font-sans outline-none min-w-[120px]"
          style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="flex-1 px-3 py-2 border rounded text-sm font-sans outline-none min-w-[120px]"
          style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
        />
        <input
          type="number"
          placeholder="Billable Rate ($/hr)"
          value={contractorRate}
          onChange={(e) => setContractorRate(e.target.value)}
          className="px-3 py-2 border rounded text-sm font-sans outline-none w-[160px]"
          style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
        />
        <button
          onClick={handleAddContractor}
          disabled={!firstName.trim() || !lastName.trim() || !contractorCompanyId}
          className="px-5 py-2 text-xs font-sans font-medium rounded border transition-all disabled:opacity-40"
          style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
        >
          Add
        </button>
      </div>
      <p className="text-[10px] font-sans mt-2" style={{ color: "var(--text-muted)" }}>
        Resource number will be auto-generated
      </p>
    </div>

    <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
          {["Resource #", "Name", "Company", "Rate", "Status", "Actions"].map((h) => (
            <th key={h} className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {employees.map((emp) => {
          const company = companies.find((c) => c.id === emp.company_id);
          return (
            <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
              <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>
                {emp.employee_number}
              </td>
              <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
                {emp.first_name} {emp.last_name}
              </td>
              <td className="py-3 px-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                {company?.name || "—"}
              </td>
              <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                ${emp.billable_rate?.toFixed(2) || "0.00"}/hr
              </td>
              <td className="py-3 px-3">
                <span
                  className="text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded"
                  style={{
                    color: emp.is_active ? "#66bb6a" : "#78909c",
                    background: emp.is_active ? "rgba(102,187,106,0.1)" : "rgba(120,144,156,0.1)",
                    border: `1px solid ${emp.is_active ? "rgba(102,187,106,0.2)" : "rgba(120,144,156,0.2)"}`,
                  }}
                >
                  {emp.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="py-3 px-3">
                <button
                  onClick={() => toggleActive(emp.id, !emp.is_active)}
                  className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                  style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                >
                  {emp.is_active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/TimeClockAdmin.tsx
git commit -m "feat: replace Employees tab with Contractors tab"
```

---

### Task 12: Admin — Jobs Tab (company scoped)

**Files:**
- Modify: `src/components/TimeClockAdmin.tsx` — update the jobs tab

**Step 1: Add company selector to jobs form**

Update the jobs add form to include a company dropdown before the job name input. Add company column to the jobs table. Same pattern as the contractors tab.

The add form gains a company `<select>` using `activeCompanies`, and `handleAddJob` now passes `jobCompanyId`.

The table gains a "Company" column showing `companies.find(c => c.id === job.company_id)?.name`.

**Step 2: Commit**

```bash
git add src/components/TimeClockAdmin.tsx
git commit -m "feat: scope jobs tab to companies"
```

---

### Task 13: Admin — Approval Queue Tab

**Files:**
- Create: `src/components/time-clock/ApprovalQueue.tsx`
- Modify: `src/components/TimeClockAdmin.tsx` — import and render new component

**Step 1: Create ApprovalQueue component**

This is Brian's morning workflow. Shows yesterday's entries by default, grouped by company, with approve/flag actions.

```tsx
"use client";

import { useState } from "react";
import type { TCEmployee, TCTimeEntry, TCJob, TCCompany } from "@/types/timeclock";

interface Props {
  entries: TCTimeEntry[];
  employees: TCEmployee[];
  companies: TCCompany[];
  jobs: TCJob[];
  onApprove: (entryId: string, approvedBy: string) => Promise<void>;
  onFlag: (entryId: string, flagNote: string) => Promise<void>;
  onBulkApprove: (entryIds: string[], approvedBy: string) => Promise<void>;
  onExportApproved: (entries: TCTimeEntry[], employees: TCEmployee[], companies: TCCompany[], jobs: TCJob[], dateRange: { start: Date; end: Date }) => void;
}

export default function ApprovalQueue({
  entries, employees, companies, jobs,
  onApprove, onFlag, onBulkApprove, onExportApproved,
}: Props) {
  // Default to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [selectedDate, setSelectedDate] = useState(yesterday.toISOString().slice(0, 10));
  const [flaggingEntryId, setFlaggingEntryId] = useState<string | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [approverName] = useState("Brian"); // Could be configurable later

  // Filter entries for selected date
  const dayStart = new Date(selectedDate + "T00:00:00");
  const dayEnd = new Date(selectedDate + "T23:59:59.999");
  const dayEntries = entries.filter((e) => {
    const ci = new Date(e.clock_in);
    return ci >= dayStart && ci <= dayEnd;
  });

  const pendingEntries = dayEntries.filter((e) => e.approval_status === "pending");
  const flaggedEntries = dayEntries.filter((e) => e.approval_status === "flagged");

  // Group pending by company
  const groupedByCompany = new Map<string, TCTimeEntry[]>();
  for (const entry of pendingEntries) {
    const emp = employees.find((e) => e.id === entry.employee_id);
    const companyId = emp?.company_id || "unassigned";
    if (!groupedByCompany.has(companyId)) groupedByCompany.set(companyId, []);
    groupedByCompany.get(companyId)!.push(entry);
  }

  const getHours = (entry: TCTimeEntry) => {
    const start = new Date(entry.clock_in).getTime();
    const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
    return (end - start) / (1000 * 60 * 60);
  };

  const handleFlag = async () => {
    if (!flaggingEntryId || !flagNote.trim()) return;
    await onFlag(flaggingEntryId, flagNote.trim());
    setFlaggingEntryId(null);
    setFlagNote("");
  };

  const handleBulkApprove = async (companyEntryIds: string[]) => {
    await onBulkApprove(companyEntryIds, approverName);
  };

  // Render entry row (reused for pending and flagged sections)
  // Full JSX to be implemented — shows Resource #, Name, Job, Clock In/Out, Hours, Billable Amount, action buttons
  // ... (implementation follows same visual pattern as daily log table)

  return (
    <div className="max-w-5xl">
      {/* Header with date picker and counts */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded text-sm font-sans outline-none"
            style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
          />
          <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>
            {pendingEntries.length} pending, {flaggedEntries.length} flagged
          </span>
        </div>
        <button
          onClick={() => onExportApproved(entries, employees, companies, jobs, { start: dayStart, end: dayEnd })}
          className="px-4 py-1.5 text-[10px] font-sans font-medium rounded border transition-all uppercase tracking-[1px]"
          style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
        >
          Export Approved
        </button>
      </div>

      {/* Pending entries grouped by company */}
      {Array.from(groupedByCompany.entries()).map(([companyId, companyEntries]) => {
        const company = companies.find((c) => c.id === companyId);
        return (
          <div key={companyId} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-sans font-medium uppercase tracking-[1.5px]" style={{ color: "var(--gold)" }}>
                {company?.name || "Unassigned"}
              </h3>
              <button
                onClick={() => handleBulkApprove(companyEntries.map((e) => e.id))}
                className="text-[10px] font-sans uppercase tracking-[1px] px-3 py-1 rounded border transition-all"
                style={{ borderColor: "rgba(102,187,106,0.3)", color: "#66bb6a", background: "rgba(102,187,106,0.08)" }}
              >
                Approve All
              </button>
            </div>
            <table className="w-full text-sm font-sans mb-2" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Resource #", "Name", "Job", "Clock In", "Clock Out", "Hours", "Amount", "Actions"].map((h) => (
                    <th key={h} className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companyEntries.map((entry) => {
                  const emp = employees.find((e) => e.id === entry.employee_id);
                  if (!emp) return null;
                  const hours = getHours(entry);
                  const job = entry.job_id ? jobs.find((j) => j.id === entry.job_id) : null;
                  const amount = hours * (emp.billable_rate || 0);
                  return (
                    <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>{emp.employee_number}</td>
                      <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>{emp.first_name} {emp.last_name}</td>
                      <td className="py-3 px-3 text-xs" style={{ color: "var(--text-secondary)" }}>{job?.name || "—"}</td>
                      <td className="py-3 px-3" style={{ color: "var(--text-secondary)" }}>
                        {new Date(entry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-3" style={{ color: "var(--text-secondary)" }}>
                        {entry.clock_out
                          ? new Date(entry.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : <span style={{ color: "#66bb6a" }}>Active</span>}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">{hours.toFixed(2)}h</td>
                      <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>${amount.toFixed(2)}</td>
                      <td className="py-3 px-3 flex gap-2">
                        <button
                          onClick={() => onApprove(entry.id, approverName)}
                          className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                          style={{ borderColor: "rgba(102,187,106,0.3)", color: "#66bb6a" }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setFlaggingEntryId(entry.id)}
                          className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                          style={{ borderColor: "rgba(255,183,77,0.3)", color: "#ffb74d" }}
                        >
                          Flag
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {pendingEntries.length === 0 && (
        <div className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
          No pending entries for this date.
        </div>
      )}

      {/* Flagged entries section */}
      {flaggedEntries.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-sans font-medium uppercase tracking-[1.5px] mb-3" style={{ color: "#ffb74d" }}>
            Flagged Entries
          </h3>
          <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                {["Resource #", "Name", "Job", "Hours", "Flag Note", "Actions"].map((h) => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flaggedEntries.map((entry) => {
                const emp = employees.find((e) => e.id === entry.employee_id);
                if (!emp) return null;
                const job = entry.job_id ? jobs.find((j) => j.id === entry.job_id) : null;
                return (
                  <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>{emp.employee_number}</td>
                    <td className="py-3 px-3">{emp.first_name} {emp.last_name}</td>
                    <td className="py-3 px-3 text-xs">{job?.name || "—"}</td>
                    <td className="py-3 px-3 font-mono text-xs">{getHours(entry).toFixed(2)}h</td>
                    <td className="py-3 px-3 text-xs" style={{ color: "#ffb74d" }}>{entry.flag_note}</td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => onApprove(entry.id, approverName)}
                        className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                        style={{ borderColor: "rgba(102,187,106,0.3)", color: "#66bb6a" }}
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Flag Note Modal */}
      {flaggingEntryId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="border rounded-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
            <h2 className="text-lg font-light mb-4" style={{ color: "#ffb74d" }}>Flag Entry</h2>
            <textarea
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
              placeholder="Reason for flagging..."
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm font-sans outline-none mb-4 resize-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleFlag}
                disabled={!flagNote.trim()}
                className="flex-1 px-4 py-2 text-sm font-sans font-medium rounded-lg border transition-all disabled:opacity-40"
                style={{ borderColor: "#ffb74d", background: "rgba(255,183,77,0.15)", color: "#ffb74d" }}
              >
                Flag
              </button>
              <button
                onClick={() => { setFlaggingEntryId(null); setFlagNote(""); }}
                className="px-4 py-2 text-sm font-sans font-medium rounded-lg border transition-all"
                style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Import and render in TimeClockAdmin**

Add import at top of `TimeClockAdmin.tsx`:

```typescript
import ApprovalQueue from "@/components/time-clock/ApprovalQueue";
```

Add in the content area:

```tsx
{activeTab === "approval" && (
  <ApprovalQueue
    entries={entries}
    employees={employees}
    companies={companies}
    jobs={jobs}
    onApprove={approveEntry}
    onFlag={flagEntry}
    onBulkApprove={bulkApprove}
    onExportApproved={(entries, employees, companies, jobs, dateRange) =>
      exportApprovedCSV(entries, employees, companies, jobs, dateRange)
    }
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/time-clock/ApprovalQueue.tsx src/components/TimeClockAdmin.tsx
git commit -m "feat: add Approval Queue tab"
```

---

### Task 14: Admin — Crew Entry Tab

**Files:**
- Create: `src/components/time-clock/CrewEntry.tsx`
- Modify: `src/components/TimeClockAdmin.tsx` — import and render

**Step 1: Create CrewEntry component**

Julian's batch entry screen. Select company → job → date → check contractors → enter clock in/out → submit.

```tsx
"use client";

import { useState } from "react";
import type { TCEmployee, TCJob, TCCompany } from "@/types/timeclock";

interface Props {
  employees: TCEmployee[];
  companies: TCCompany[];
  jobs: TCJob[];
  getJobsByCompany: (companyId: string) => TCJob[];
  onBatchClockIn: (employeeIds: string[], jobId: string, clockIn: string, clockOut: string) => Promise<void>;
}

export default function CrewEntry({ employees, companies, jobs, getJobsByCompany, onBatchClockIn }: Props) {
  const [companyId, setCompanyId] = useState("");
  const [jobId, setJobId] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [clockInTime, setClockInTime] = useState("07:00");
  const [clockOutTime, setClockOutTime] = useState("17:00");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const activeCompanies = companies.filter((c) => c.is_active);
  const companyJobs = companyId ? getJobsByCompany(companyId) : [];
  const companyContractors = employees.filter((e) => e.company_id === companyId && e.is_active);

  const toggleContractor = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(companyContractors.map((c) => c.id)));
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || !jobId) return;
    setSubmitting(true);
    try {
      const clockIn = new Date(`${entryDate}T${clockInTime}:00`).toISOString();
      const clockOut = new Date(`${entryDate}T${clockOutTime}:00`).toISOString();
      await onBatchClockIn(Array.from(selectedIds), jobId, clockIn, clockOut);
      setMessage({ text: `${selectedIds.size} entries submitted successfully`, type: "success" });
      setSelectedIds(new Set());
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage({ text: "Failed to submit entries", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {message && (
        <div className="mb-4 p-3 rounded-lg text-center text-sm font-sans"
          style={{
            background: message.type === "success" ? "rgba(102,187,106,0.15)" : "rgba(239,83,80,0.15)",
            border: `1px solid ${message.type === "success" ? "rgba(102,187,106,0.3)" : "rgba(239,83,80,0.3)"}`,
            color: message.type === "success" ? "#66bb6a" : "#ef5350",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Setup row */}
      <div className="p-4 rounded-lg border mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
        <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-3 font-medium" style={{ color: "var(--text-muted)" }}>
          Crew Time Entry
        </h3>
        <div className="flex gap-3 flex-wrap">
          <select
            value={companyId}
            onChange={(e) => { setCompanyId(e.target.value); setJobId(""); setSelectedIds(new Set()); }}
            className="px-3 py-2 border rounded text-sm font-sans outline-none min-w-[160px]"
            style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
          >
            <option value="">Select Company</option>
            {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={!companyId}
            className="px-3 py-2 border rounded text-sm font-sans outline-none min-w-[160px] disabled:opacity-40"
            style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
          >
            <option value="">Select Job</option>
            {companyJobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="px-3 py-2 border rounded text-sm font-sans outline-none"
            style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="flex gap-3 mt-3">
          <div>
            <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block" style={{ color: "var(--text-muted)" }}>Clock In</label>
            <input type="time" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)}
              className="px-3 py-2 border rounded text-sm font-sans outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block" style={{ color: "var(--text-muted)" }}>Clock Out</label>
            <input type="time" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)}
              className="px-3 py-2 border rounded text-sm font-sans outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }} />
          </div>
        </div>
      </div>

      {/* Contractor selection */}
      {companyId && companyContractors.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-sans uppercase tracking-[2px] font-medium" style={{ color: "var(--text-muted)" }}>
              Select Crew Members ({selectedIds.size}/{companyContractors.length})
            </h3>
            <button onClick={selectAll} className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
              style={{ borderColor: "var(--border-light)", color: "var(--gold)" }}>
              Select All
            </button>
          </div>
          <div className="space-y-2">
            {companyContractors.map((emp) => (
              <label key={emp.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                style={{
                  background: selectedIds.has(emp.id) ? "rgba(212,175,55,0.08)" : "var(--card-bg)",
                  borderColor: selectedIds.has(emp.id) ? "var(--gold)" : "var(--border-light)",
                }}
              >
                <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleContractor(emp.id)}
                  className="accent-[#d4af37]" />
                <span className="font-mono text-xs" style={{ color: "var(--gold)" }}>{emp.employee_number}</span>
                <span className="text-sm font-sans" style={{ color: "var(--text-primary)" }}>{emp.first_name} {emp.last_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={selectedIds.size === 0 || !jobId || submitting}
        className="w-full py-3 rounded-lg text-sm font-sans font-medium uppercase tracking-[2px] transition-all disabled:opacity-40"
        style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)", border: "1px solid var(--gold)" }}
      >
        {submitting ? "Submitting..." : `Submit ${selectedIds.size} Entries`}
      </button>
    </div>
  );
}
```

**Step 2: Import and render in TimeClockAdmin**

```typescript
import CrewEntry from "@/components/time-clock/CrewEntry";
```

```tsx
{activeTab === "crew" && (
  <CrewEntry
    employees={employees}
    companies={companies}
    jobs={jobs}
    getJobsByCompany={getJobsByCompany}
    onBatchClockIn={batchClockIn}
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/time-clock/CrewEntry.tsx src/components/TimeClockAdmin.tsx
git commit -m "feat: add Crew Entry tab for batch time submission"
```

---

### Task 15: Admin — Update Daily/Weekly/Monthly Reports

**Files:**
- Modify: `src/components/TimeClockAdmin.tsx` — daily, weekly, monthly tab sections

**Step 1: Update Daily Log tab**

- Change "Employee" header to "Contractor"
- Remove `isOvertime` references and the OT badge
- Add company name column
- Add approval status badge (pending/approved/flagged)
- Add company filter dropdown above the table

**Step 2: Update Weekly tab**

- Change "Employee" header to "Contractor"
- Remove `isWeeklyOvertime`, `dailyOvertimeFlags` references
- Remove OT badge and orange overtime coloring
- Add company filter dropdown
- Filter `weeklySummary` by `filterCompanyId`

**Step 3: Update Monthly tab**

- Change "Employee" header to "Contractor"
- Add company filter dropdown
- Filter `monthlySummary` by `filterCompanyId`
- Change empty state text from "No active employees" to "No active contractors"

**Step 4: Commit**

```bash
git add src/components/TimeClockAdmin.tsx
git commit -m "refactor: update reports - remove overtime, add company filter"
```

---

### Task 16: Admin — Simplify Settings Tab

**Files:**
- Modify: `src/components/TimeClockAdmin.tsx` — settings tab section (lines 653-757)

**Step 1: Remove Overtime Thresholds section**

Delete the entire overtime thresholds card (the first `<div className="p-5 rounded-lg border mb-6">` in settings). Keep only the Location card and Save button.

**Step 2: Commit**

```bash
git add src/components/TimeClockAdmin.tsx
git commit -m "refactor: remove overtime settings from admin"
```

---

### Task 17: Update Kiosk Clock-In Flow (TimeClock.tsx)

**Files:**
- Modify: `src/components/TimeClock.tsx`

**Step 1: Add company display to confirm screen**

Import `useCompanies` from hooks. In the confirm screen, look up the contractor's company and display "Welcome, [Name] — [Company]" with "Resource #[number]" below.

**Step 2: Filter jobs by company on job select screen**

Replace `activeJobs` with filtered list: `activeJobs.filter(j => j.company_id === matchedEmployee?.company_id)`.

**Step 3: Update terminology**

- Header subtitle: "Employee Clock In / Out" → "Contractor Clock In / Out"
- Input screen: "Enter your employee number" → "Enter your resource number"
- Confirm screen: "Employee #" → "Resource #"
- Error messages: "Employee not found" → "Resource number not found"

**Step 4: Commit**

```bash
git add src/components/TimeClock.tsx
git commit -m "feat: update kiosk flow with company display and contractor terminology"
```

---

### Task 18: Update CSV Exports

**Files:**
- Modify: `src/lib/timeClockExport.ts`

**Step 1: Update terminology in existing exports**

Change "Employee #" to "Resource #" in `exportDailyCSV`, `exportWeeklyCSV`, and `exportMonthlyCSV`.

**Step 2: Add exportApprovedCSV function**

```typescript
import type { TCEmployee, TCTimeEntry, TCCompany, TCJob } from "@/types/timeclock";

export async function exportApprovedCSV(
  entries: TCTimeEntry[],
  employees: TCEmployee[],
  companies: TCCompany[],
  jobs: TCJob[],
  dateRange: { start: Date; end: Date }
) {
  const Papa = (await import("papaparse")).default;

  const approved = entries.filter((e) => {
    const ci = new Date(e.clock_in);
    return e.approval_status === "approved" && ci >= dateRange.start && ci <= dateRange.end;
  });

  const rows = approved.map((entry) => {
    const emp = employees.find((e) => e.id === entry.employee_id);
    const company = emp ? companies.find((c) => c.id === emp.company_id) : null;
    const job = entry.job_id ? jobs.find((j) => j.id === entry.job_id) : null;
    const hours = entry.clock_out
      ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60)
      : 0;
    const rate = emp?.billable_rate || 0;

    return {
      "Company": company?.name || "",
      "Resource #": emp?.employee_number || "",
      "Contractor Name": emp ? `${emp.first_name} ${emp.last_name}` : "",
      "Job": job?.name || "",
      "Date": new Date(entry.clock_in).toLocaleDateString(),
      "Clock In": new Date(entry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Clock Out": entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      "Hours": hours.toFixed(2),
      "Billable Rate": rate.toFixed(2),
      "Total": (hours * rate).toFixed(2),
      "Approved By": entry.approved_by || "",
      "Approved At": entry.approved_at ? new Date(entry.approved_at).toLocaleString() : "",
    };
  });

  const csv = Papa.unparse(rows);
  const dateStr = dateRange.start.toISOString().slice(0, 10);
  downloadCSV(csv, `approved-time-entries-${dateStr}.csv`);
}
```

**Step 3: Commit**

```bash
git add src/lib/timeClockExport.ts
git commit -m "feat: add approved entries CSV export, update terminology"
```

---

### Task 19: Build Verification & Final Cleanup

**Files:**
- All modified files

**Step 1: Run TypeScript check**

Run: `cd /Users/johnlohr/StackkedDev/PrestonProjects/preston && npx tsc --noEmit`
Expected: No errors

**Step 2: Run ESLint**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings)

**Step 3: Run dev server smoke test**

Run: `npm run dev`
Verify: App builds and starts without errors. Navigate to `/time-clock` and `/time-clock/admin` to confirm pages load.

**Step 4: Run production build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "fix: resolve build issues from time clock overhaul"
```

---

## File Summary

| File | Action | Task |
|------|--------|------|
| `supabase-timeclock-overhaul.sql` | Create | 1 |
| `src/types/timeclock.ts` | Modify | 2 |
| `src/lib/timeClockHooks.ts` | Modify | 3-8 |
| `src/components/TimeClockAdmin.tsx` | Modify | 9-12, 15-16 |
| `src/components/time-clock/ApprovalQueue.tsx` | Create | 13 |
| `src/components/time-clock/CrewEntry.tsx` | Create | 14 |
| `src/components/TimeClock.tsx` | Modify | 17 |
| `src/lib/timeClockExport.ts` | Modify | 18 |

## Dependencies

- Tasks 3-8 depend on Task 2 (types)
- Tasks 9-16 depend on Tasks 3-8 (hooks)
- Task 17 depends on Task 3 (useCompanies hook)
- Task 18 depends on Task 2 (types)
- Task 19 depends on all other tasks
- Task 1 (SQL) is independent — must be run in Supabase SQL Editor before testing

## Notes

- **No test framework** is configured in this project. Verification is via `tsc --noEmit`, `npm run lint`, and `npm run build`.
- The SQL migration (Task 1) must be executed manually in the Supabase SQL Editor before the app can be tested end-to-end.
- All DB column names stay the same (`employee_number`, `employee_id`, etc.) — only UI labels change.
- The `approval_status` column defaults to `'pending'`, so existing entries will automatically appear in the approval queue.
