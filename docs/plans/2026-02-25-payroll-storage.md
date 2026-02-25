# Payroll Storage & History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist generated payroll XLSX files to a Supabase storage bucket and provide a per-branch history UI for browsing/downloading past runs.

**Architecture:** XLSX files upload to a `payroll` Supabase bucket server-side after generation. Filenames encode all metadata (run date, pay period, pay date). The frontend lists files per branch via `supabase.storage.list()` and parses filenames for display. No database table.

**Tech Stack:** Supabase Storage SDK, Next.js API route, React (client component)

---

### Task 1: Add slug helper to payrollConfig

**Files:**
- Modify: `src/lib/payrollConfig.ts` (after `isBranchConfigured`, ~line 590)

**Step 1: Add `branchSlug()` function**

Add this exported function at the end of payrollConfig.ts, after `isBranchConfigured`:

```typescript
/** Convert branch name to URL-safe slug for storage paths */
export function branchSlug(branchId: string): string {
  const branch = getBranchConfig(branchId);
  if (!branch) return branchId;
  return branch.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
```

This produces: `william-henry-salon-mount-holly`, `william-henry-salon-mcadenville`, etc.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors

**Step 3: Commit**

```bash
git add src/lib/payrollConfig.ts
git commit -m "feat: add branchSlug helper for storage paths"
```

---

### Task 2: Add storage upload to API route

**Files:**
- Modify: `src/app/api/phorest/payroll/route.ts`

**Step 1: Add Supabase import and slug import**

At the top of the file, add these imports:

```typescript
import { supabase } from "@/lib/supabase";
import { branchSlug } from "@/lib/payrollConfig";
```

Update the existing `payrollConfig` import to include `branchSlug`:

```typescript
import {
  getBranchConfig,
  isBranchConfigured,
  computePayPeriodConfig,
  branchSlug,
} from "@/lib/payrollConfig";
```

**Step 2: Add storage upload between Excel generation and response**

After line 118 (`const excelBase64 = excelBuffer.toString("base64");`) and before the `return NextResponse.json(...)`, insert:

```typescript
    // 6. Upload to Supabase storage (non-blocking — failure is a warning)
    let filePath: string | null = null;
    let storageWarning: string | null = null;
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const slug = branchSlug(branchId);
      filePath = `${slug}/run-${timestamp}_period-${startDate}_to_${endDate}_pay-${payPeriod.payDate}.xlsx`;

      const { error: uploadError } = await supabase.storage
        .from("payroll")
        .upload(filePath, excelBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: false,
        });

      if (uploadError) {
        storageWarning = `Storage upload failed: ${uploadError.message}`;
        filePath = null;
      }
    } catch (uploadErr) {
      storageWarning = `Storage upload error: ${uploadErr instanceof Error ? uploadErr.message : "Unknown"}`;
      filePath = null;
    }
```

**Step 3: Add filePath and storageWarning to the JSON response**

Update the return statement to include the new fields. Add `filePath` and conditionally add the storage warning to the warnings array:

```typescript
    // Merge storage warning into warnings if present
    const allWarnings = [...results.warnings];
    if (storageWarning) allWarnings.push(storageWarning);

    return NextResponse.json({
      branchId: branch.branchId,
      branchName: branch.name,
      abbreviation: branch.abbreviation,
      payPeriod: payPeriod.payPeriodLabel,
      payDate: payPeriod.payDate,
      staffData: results.staffData,
      staffOrder: results.staffOrder,
      staffConfig: branch.staffConfig,
      warnings: allWarnings,
      excelBase64,
      filePath,
      totalRows: completedJob.totalRows,
    });
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors

**Step 5: Commit**

```bash
git add src/app/api/phorest/payroll/route.ts
git commit -m "feat: upload payroll XLSX to Supabase storage after generation"
```

---

### Task 3: Add filename parser utility

**Files:**
- Modify: `src/components/PayoutSuite.tsx` (add near the top helpers section, around line 410)

**Step 1: Add the ParsedRun interface and parser function**

Add these after the existing helper functions (`boothRentRebate`, `fmt`, `fmtNeg`):

```typescript
interface ParsedRun {
  fileName: string;
  runDate: string;      // ISO timestamp e.g. "2026-02-25T14-30-22"
  periodStart: string;  // "2026-02-01"
  periodEnd: string;    // "2026-02-14"
  payDate: string;      // "2026-02-19"
  displayRunDate: string;  // "2/25/2026 2:30 PM"
  displayPeriod: string;   // "Feb 1–14, 2026"
  displayPayDate: string;  // "2/19/2026"
}

function parseRunFilename(fileName: string): ParsedRun | null {
  // Expected: run-2026-02-25T14-30-22_period-2026-02-01_to_2026-02-14_pay-2026-02-19.xlsx
  const match = fileName.match(
    /^run-(\d{4}-\d{2}-\d{2}T[\d-]+)_period-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})_pay-(\d{4}-\d{2}-\d{2})\.xlsx$/
  );
  if (!match) return null;

  const [, runDate, periodStart, periodEnd, payDate] = match;

  // Format run date for display: "2/25/2026 2:30 PM"
  const runParts = runDate.split("T");
  const runD = new Date(runParts[0] + "T" + (runParts[1] || "00-00-00").replace(/-/g, ":"));
  const displayRunDate = runD.toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  // Format period for display: "Feb 1–14, 2026"
  const ps = new Date(periodStart + "T12:00:00");
  const pe = new Date(periodEnd + "T12:00:00");
  const monthName = ps.toLocaleString("en-US", { month: "short" });
  const displayPeriod = ps.getMonth() === pe.getMonth()
    ? `${monthName} ${ps.getDate()}–${pe.getDate()}, ${pe.getFullYear()}`
    : `${monthName} ${ps.getDate()} – ${pe.toLocaleString("en-US", { month: "short" })} ${pe.getDate()}, ${pe.getFullYear()}`;

  // Format pay date: "2/19/2026"
  const pd = new Date(payDate + "T12:00:00");
  const displayPayDate = `${pd.getMonth() + 1}/${pd.getDate()}/${pd.getFullYear()}`;

  return {
    fileName, runDate, periodStart, periodEnd, payDate,
    displayRunDate, displayPeriod, displayPayDate,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors

**Step 3: Commit**

```bash
git add src/components/PayoutSuite.tsx
git commit -m "feat: add payroll filename parser for history display"
```

---

### Task 4: Add PastRuns component

**Files:**
- Modify: `src/components/PayoutSuite.tsx`

**Step 1: Add supabase import**

At the top of PayoutSuite.tsx, add:

```typescript
import { supabase } from "@/lib/supabase";
import { branchSlug } from "@/lib/payrollConfig";
```

Update the existing `payrollConfig` import to include `branchSlug`:

```typescript
import {
  BRANCHES,
  isBranchConfigured,
  computePayDate,
  branchSlug,
} from "@/lib/payrollConfig";
```

**Step 2: Add the PastRuns component**

Add this component after the `BranchResults` component (at the end of the file, before the closing):

```typescript
function PastRuns({ branchId }: { branchId: string }) {
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  // Fetch file list on mount
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const slug = branchSlug(branchId);
    const { data, error } = await supabase.storage
      .from("payroll")
      .list(slug, { sortBy: { column: "name", order: "desc" } });

    if (error || !data) {
      setRuns([]);
      setLoading(false);
      return;
    }

    const parsed = data
      .map((f) => parseRunFilename(f.name))
      .filter((r): r is ParsedRun => r !== null);

    setRuns(parsed);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Filter by run date
  const filtered = filterDate
    ? runs.filter((r) => r.runDate.startsWith(filterDate))
    : runs;

  // Download handler
  const downloadRun = async (run: ParsedRun) => {
    const slug = branchSlug(branchId);
    const { data } = supabase.storage
      .from("payroll")
      .getPublicUrl(`${slug}/${run.fileName}`);
    if (data?.publicUrl) {
      const a = document.createElement("a");
      a.href = data.publicUrl;
      a.download = run.fileName;
      a.click();
    }
  };

  return (
    <div
      className="mt-6 rounded-lg border"
      style={{ borderColor: "var(--border-light)", background: "var(--card-bg)" }}
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-sans tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="font-medium">
          Past Runs {!loading && `(${runs.length})`}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="py-6 text-center">
              <div
                className="inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
              />
            </div>
          ) : runs.length === 0 ? (
            <p className="py-4 text-center text-xs font-sans" style={{ color: "var(--text-muted)" }}>
              No past runs saved for this branch.
            </p>
          ) : (
            <>
              {/* Date Filter */}
              <div className="mb-3 flex items-center gap-2">
                <label
                  className="text-[10px] font-sans tracking-[1.5px] uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  Filter by date
                </label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-2 py-1 rounded border text-xs font-sans"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                />
                {filterDate && (
                  <button
                    onClick={() => setFilterDate("")}
                    className="text-xs font-sans"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Runs List */}
              <div className="space-y-1">
                {filtered.map((run) => (
                  <div
                    key={run.fileName}
                    className="flex items-center justify-between px-3 py-2 rounded-md border"
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <div className="flex items-center gap-4 text-xs font-sans">
                      <span style={{ color: "var(--text-primary)" }}>{run.displayPeriod}</span>
                      <span style={{ color: "var(--text-muted)" }}>Pay: {run.displayPayDate}</span>
                      <span style={{ color: "var(--text-muted)" }}>Run: {run.displayRunDate}</span>
                    </div>
                    <button
                      onClick={() => downloadRun(run)}
                      className="px-3 py-1 rounded text-[10px] font-sans font-medium tracking-wide transition-all"
                      style={{
                        border: "1px solid var(--gold)",
                        color: "var(--gold)",
                        background: "transparent",
                      }}
                    >
                      Download
                    </button>
                  </div>
                ))}
                {filtered.length === 0 && filterDate && (
                  <p className="py-2 text-center text-xs font-sans" style={{ color: "var(--text-muted)" }}>
                    No runs found for {filterDate}.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add `useEffect` to imports**

Update the React import at the top of the file:

```typescript
import { useState, useCallback, useEffect } from "react";
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors

**Step 5: Commit**

```bash
git add src/components/PayoutSuite.tsx
git commit -m "feat: add PastRuns component for payroll history browsing"
```

---

### Task 5: Wire PastRuns into branch tabs

**Files:**
- Modify: `src/components/PayoutSuite.tsx`

**Step 1: Add PastRuns below each branch tab's content**

In the `<main>` section of the `PayoutSuite` component, find the closing `</main>` tag (currently around line 401). Just before it, add the PastRuns component so it appears for every configured branch regardless of run state:

```typescript
        {/* Past Runs — always shown for configured branches */}
        {activeResult?.status !== "unconfigured" && (
          <PastRuns branchId={activeTab} />
        )}
```

This goes right after the `{activeResult?.status === "done" && ...}` block and before `</main>`.

**Step 2: Add refresh trigger after successful run**

The PastRuns component needs to refresh its file list after a new run completes. Add a `key` prop tied to the run result so it re-mounts (and re-fetches) when a new run finishes:

Change the PastRuns usage to:

```typescript
        {activeResult?.status !== "unconfigured" && (
          <PastRuns
            branchId={activeTab}
            key={`${activeTab}-${activeResult?.data?.payPeriod || "idle"}`}
          />
        )}
```

This causes PastRuns to remount (triggering a fresh `fetchRuns`) whenever a new result comes in.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors

**Step 4: Commit**

```bash
git add src/components/PayoutSuite.tsx
git commit -m "feat: wire PastRuns into branch tabs with auto-refresh"
```

---

### Task 6: Create Supabase bucket

**Step 1: Create the `payroll` bucket in Supabase**

This is a manual step in the Supabase dashboard:

1. Go to Supabase dashboard → Storage
2. Create new bucket: `payroll`
3. Set to **Public**
4. Add RLS policy: Allow all operations (matches existing `attachments` and `sts-documents` pattern)

Alternatively, run this SQL in the Supabase SQL editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('payroll', 'payroll', true);

CREATE POLICY "Allow all on payroll"
ON storage.objects FOR ALL
USING (bucket_id = 'payroll')
WITH CHECK (bucket_id = 'payroll');
```

**Step 2: Verify bucket exists**

Test by listing contents (should return empty array):
- In browser console or via Supabase dashboard, confirm the bucket is visible and accessible.

---

### Task 7: End-to-end test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test a payroll run**

1. Open Payout Suite at `http://localhost:3000/payout-suite`
2. Select a date range and click "Run Payroll"
3. After completion, verify:
   - The data displays correctly in the preview table
   - No storage warning appears in the warnings section
   - The "Download XLSX" button still works

**Step 3: Verify file in Supabase**

Check the Supabase dashboard → Storage → `payroll` bucket:
- A file should exist at the expected path (e.g., `william-henry-salon-mount-holly/run-2026-02-25T...xlsx`)

**Step 4: Test Past Runs**

1. The "Past Runs (1)" section should appear below the results
2. Expand it — the run just completed should be listed
3. Click "Download" — the file should download

**Step 5: Test date filter**

1. Enter today's date in the filter — the run should still show
2. Enter a different date — "No runs found" should display
3. Click "Clear" — all runs reappear

**Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: payroll storage & history — complete"
```
