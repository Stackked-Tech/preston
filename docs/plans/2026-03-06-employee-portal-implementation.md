# Employee Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an employee-facing portal where salon staff log in via Supabase Auth, complete placeholder onboarding, and view their assigned fees from `ea_staff`.

**Architecture:** Client-side Supabase Auth (email+password) with route guards in page components. Auth session links to `ea_staff` via email column. Three new routes (`/employee`, `/employee/onboarding`, `/employee/dashboard`), two new hooks, three new components, one schema migration.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase Auth + Supabase JS SDK, Tailwind CSS 3

**Design Doc:** `docs/plans/2026-03-06-employee-portal-design.md`

---

### Task 1: Schema Migration — Add email to ea_staff

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_employee_portal_email.sql`
- Modify: `supabase-employeeadmin-schema.sql` (add email column for documentation)

**Step 1: Create the migration SQL**

```sql
-- Add email column to ea_staff for Employee Portal auth linking
ALTER TABLE ea_staff ADD COLUMN email TEXT;
CREATE INDEX idx_ea_staff_email ON ea_staff(email);
```

- Nullable — not all staff need portal access
- No unique constraint — same email across multiple branches is valid (multi-branch employees)
- Index for lookup performance in `useEmployeeFees`

**Step 2: Update the reference schema file**

Add `email TEXT,` after the `supervisor` line in `supabase-employeeadmin-schema.sql` so it stays in sync with production.

**Step 3: Run migration**

```bash
npx supabase db push --linked --include-all
```

Expected: Migration applies successfully, `email` column appears on `ea_staff`.

**Step 4: Commit**

```bash
git add supabase/migrations/ supabase-employeeadmin-schema.sql
git commit -m "feat: add email column to ea_staff for employee portal"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/employeeportal.ts`
- Modify: `src/types/employeeadmin.ts` (add `email` field to `EAStaff`)

**Step 1: Add email to EAStaff type**

In `src/types/employeeadmin.ts`, add to the `EAStaff` interface after `supervisor: string | null;`:

```typescript
email: string | null;
```

**Step 2: Create employee portal types**

Create `src/types/employeeportal.ts`:

```typescript
// Employee Portal Types

import type { User } from "@supabase/supabase-js";

/** Authenticated employee session state */
export interface EmployeeSession {
  user: User;
  onboardingComplete: boolean;
}

/** Fee data for a single branch assignment */
export interface EmployeeFeeRecord {
  id: string;
  branch_id: string;
  branch_name: string;
  display_name: string;
  station_lease: number;
  financial_services: number;
  phorest_fee: number;
  refreshment: number;
  associate_pay: number | null;
  supervisor: string | null;
}
```

**Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/types/employeeportal.ts src/types/employeeadmin.ts
git commit -m "feat: add employee portal types and email field to EAStaff"
```

---

### Task 3: Auth Hook — useEmployeeAuth

**Files:**
- Create: `src/lib/employeeAuthHooks.ts`

**Step 1: Create the auth hook**

Create `src/lib/employeeAuthHooks.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { User } from "@supabase/supabase-js";

export function useEmployeeAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Listen for auth state changes + check initial session
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setOnboardingComplete(u?.user_metadata?.onboarding_complete === true);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        setOnboardingComplete(u?.user_metadata?.onboarding_complete === true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return null;
    },
    []
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOnboardingComplete(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    const { error } = await supabase.auth.updateUser({
      data: { onboarding_complete: true },
    });
    if (!error) setOnboardingComplete(true);
  }, []);

  return { user, loading, onboardingComplete, login, logout, completeOnboarding };
}
```

Key decisions:
- `login()` returns `string | null` — null on success, error message string on failure
- `onboarding_complete` stored in Supabase Auth `user_metadata` — no extra DB column needed
- `onAuthStateChange` keeps state in sync across tabs and after token refresh
- Session persists via Supabase's built-in localStorage token storage

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/employeeAuthHooks.ts
git commit -m "feat: add useEmployeeAuth hook with Supabase Auth"
```

---

### Task 4: Data Hook — useEmployeeFees

**Files:**
- Create: `src/lib/employeePortalHooks.ts`

**Step 1: Create the fees hook**

Create `src/lib/employeePortalHooks.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { EmployeeFeeRecord } from "@/types/employeeportal";

export function useEmployeeFees(email: string | undefined) {
  const [fees, setFees] = useState<EmployeeFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    if (!email) {
      setFees([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("ea_staff")
        .select("id, branch_id, display_name, station_lease, financial_services, phorest_fee, refreshment, associate_pay, supervisor, ea_branches(name)")
        .eq("email", email)
        .eq("is_active", true);
      if (err) throw err;

      const records: EmployeeFeeRecord[] = (data || []).map((row: Record<string, unknown>) => {
        const branch = row.ea_branches as { name: string } | null;
        return {
          id: row.id as string,
          branch_id: row.branch_id as string,
          branch_name: branch?.name ?? "Unknown",
          display_name: row.display_name as string,
          station_lease: Number(row.station_lease) || 0,
          financial_services: Number(row.financial_services) || 0,
          phorest_fee: Number(row.phorest_fee) || 0,
          refreshment: Number(row.refreshment) || 0,
          associate_pay: row.associate_pay != null ? Number(row.associate_pay) : null,
          supervisor: row.supervisor as string | null,
        };
      });

      setFees(records);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch fee data");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  return { fees, loading, error };
}
```

Key decisions:
- Joins `ea_branches` to get branch name via Supabase's FK relationship syntax
- `Number()` wrapping is critical — Supabase returns `numeric` columns as strings
- Filters by `is_active = true` — inactive assignments are hidden from employees
- Multi-branch support: returns array of `EmployeeFeeRecord` (one per branch)

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/employeePortalHooks.ts
git commit -m "feat: add useEmployeeFees hook for employee portal dashboard"
```

---

### Task 5: LoginPage Component

**Files:**
- Create: `src/components/employee-portal/LoginPage.tsx`

**Step 1: Create LoginPage**

Create `src/components/employee-portal/LoginPage.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function LoginPage() {
  const { user, loading, onboardingComplete, login } = useEmployeeAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  if (!loading && user) {
    router.replace(onboardingComplete ? "/employee/dashboard" : "/employee/onboarding");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const err = await login(email.trim(), password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
    // On success, onAuthStateChange will update user → triggers redirect above
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <p style={{ color: "var(--text-muted)" }} className="font-sans text-sm">
          Loading...
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--input-bg)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "0.375rem",
    padding: "0.75rem 1rem",
    width: "100%",
    outline: "none",
    fontSize: "0.875rem",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8 border"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/whb-legacy-vert-bw.png"
            alt="WHB Legacy"
            width={80}
            height={66}
            className="object-contain"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
          <h1
            className="font-serif text-xl mt-4"
            style={{ color: "var(--gold)" }}
          >
            Employee Portal
          </h1>
          <p
            className="text-xs font-sans mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Sign in to view your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              className="block text-xs font-sans font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              style={inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label
              className="block text-xs font-sans font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-xs font-sans" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            className="w-full py-2.5 rounded-md font-sans text-sm font-medium tracking-wide transition-opacity"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/employee-portal/LoginPage.tsx
git commit -m "feat: add Employee Portal login page"
```

---

### Task 6: OnboardingPage Component

**Files:**
- Create: `src/components/employee-portal/OnboardingPage.tsx`

**Step 1: Create OnboardingPage**

Create `src/components/employee-portal/OnboardingPage.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function OnboardingPage() {
  const { user, loading, onboardingComplete, completeOnboarding } = useEmployeeAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [completing, setCompleting] = useState(false);

  // Redirect: no session → login, already onboarded → dashboard
  if (!loading && !user) {
    router.replace("/employee");
    return null;
  }
  if (!loading && onboardingComplete) {
    router.replace("/employee/dashboard");
    return null;
  }

  const handleContinue = async () => {
    setCompleting(true);
    await completeOnboarding();
    router.replace("/employee/dashboard");
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <p style={{ color: "var(--text-muted)" }} className="font-sans text-sm">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 border text-center"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <Image
          src="/whb-legacy-vert-bw.png"
          alt="WHB Legacy"
          width={80}
          height={66}
          className="object-contain mx-auto"
          style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
        />
        <h1
          className="font-serif text-2xl mt-6"
          style={{ color: "var(--gold)" }}
        >
          Welcome to Preston
        </h1>
        <p
          className="font-sans text-sm mt-3 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          This is your employee portal. Here you can view your station lease,
          fees, and other account details across all your branch assignments.
        </p>

        <button
          onClick={handleContinue}
          disabled={completing}
          className="mt-8 w-full py-2.5 rounded-md font-sans text-sm font-medium tracking-wide transition-opacity"
          style={{
            background: "var(--gold)",
            color: "#0a0b0e",
            opacity: completing ? 0.6 : 1,
            cursor: completing ? "not-allowed" : "pointer",
          }}
        >
          {completing ? "Setting up..." : "Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/employee-portal/OnboardingPage.tsx
git commit -m "feat: add Employee Portal onboarding placeholder page"
```

---

### Task 7: Dashboard Component

**Files:**
- Create: `src/components/employee-portal/Dashboard.tsx`

**Step 1: Create Dashboard**

Create `src/components/employee-portal/Dashboard.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import { useEmployeeFees } from "@/lib/employeePortalHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useEmployeeAuth();
  const { fees, loading: feesLoading, error } = useEmployeeFees(user?.email ?? undefined);
  const router = useRouter();
  const { theme } = useTheme();

  // Redirect if not authenticated
  if (!authLoading && !user) {
    router.replace("/employee");
    return null;
  }

  const loading = authLoading || feesLoading;

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <p style={{ color: "var(--text-muted)" }} className="font-sans text-sm">
          Loading...
        </p>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/employee");
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/whb-legacy-vert-bw.png"
            alt="WHB Legacy"
            width={40}
            height={33}
            className="object-contain"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
          <div>
            <h1 className="font-serif text-lg m-0" style={{ color: "var(--gold)" }}>
              Employee Portal
            </h1>
            <p className="font-sans text-xs m-0" style={{ color: "var(--text-muted)" }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="font-sans text-xs px-3 py-1.5 rounded-md border transition-colors"
          style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          Sign Out
        </button>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2
          className="font-serif text-xl mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Your Fee Summary
        </h2>

        {error && (
          <div
            className="rounded-lg p-4 mb-6 border font-sans text-sm"
            style={{ borderColor: "#f87171", color: "#f87171", background: "rgba(248,113,113,0.08)" }}
          >
            {error}
          </div>
        )}

        {fees.length === 0 && !error ? (
          <div
            className="rounded-lg p-8 border text-center"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
          >
            <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>
              No fee data found. Contact your administrator if you believe this is an error.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {fees.map((fee) => {
              const total =
                fee.station_lease +
                fee.financial_services +
                fee.phorest_fee +
                fee.refreshment;

              return (
                <div
                  key={fee.id}
                  className="rounded-lg border p-6"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="font-serif text-lg m-0"
                      style={{ color: "var(--gold)" }}
                    >
                      {fee.branch_name}
                    </h3>
                    <span
                      className="font-sans text-xs px-2 py-0.5 rounded"
                      style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}
                    >
                      {fee.display_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FeeRow label="Station Lease" value={fee.station_lease} fmt={fmt} />
                    <FeeRow label="Financial Services" value={fee.financial_services} fmt={fmt} />
                    <FeeRow label="Phorest Fee" value={fee.phorest_fee} fmt={fmt} />
                    <FeeRow label="Refreshment" value={fee.refreshment} fmt={fmt} />
                  </div>

                  <div
                    className="mt-4 pt-4 flex justify-between items-center"
                    style={{ borderTop: "1px solid var(--border-light)" }}
                  >
                    <span className="font-sans text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      Total Fees
                    </span>
                    <span className="font-sans text-sm font-semibold" style={{ color: "var(--gold)" }}>
                      {fmt(total)}
                    </span>
                  </div>

                  {fee.associate_pay != null && (
                    <div className="mt-3 flex justify-between items-center">
                      <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>
                        Associate Pay
                      </span>
                      <span className="font-sans text-xs" style={{ color: "var(--text-secondary)" }}>
                        {fmt(fee.associate_pay)} &middot; Supervisor: {fee.supervisor ?? "—"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function FeeRow({
  label,
  value,
  fmt,
}: {
  label: string;
  value: number;
  fmt: (n: number) => string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="font-sans text-sm" style={{ color: "var(--text-primary)" }}>
        {fmt(value)}
      </span>
    </div>
  );
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/employee-portal/Dashboard.tsx
git commit -m "feat: add Employee Portal dashboard with fee cards"
```

---

### Task 8: Page Routes

**Files:**
- Create: `src/app/employee/page.tsx`
- Create: `src/app/employee/onboarding/page.tsx`
- Create: `src/app/employee/dashboard/page.tsx`

**Step 1: Create login route**

Create `src/app/employee/page.tsx`:

```typescript
import type { Metadata } from "next";
import LoginPage from "@/components/employee-portal/LoginPage";

export const metadata: Metadata = {
  title: "Employee Portal | WHB Companies",
};

export default function EmployeeLoginRoute() {
  return <LoginPage />;
}
```

**Step 2: Create onboarding route**

Create `src/app/employee/onboarding/page.tsx`:

```typescript
import type { Metadata } from "next";
import OnboardingPage from "@/components/employee-portal/OnboardingPage";

export const metadata: Metadata = {
  title: "Welcome | Employee Portal",
};

export default function EmployeeOnboardingRoute() {
  return <OnboardingPage />;
}
```

**Step 3: Create dashboard route**

Create `src/app/employee/dashboard/page.tsx`:

```typescript
import type { Metadata } from "next";
import Dashboard from "@/components/employee-portal/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Employee Portal",
};

export default function EmployeeDashboardRoute() {
  return <Dashboard />;
}
```

**Step 4: Verify build**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/employee/
git commit -m "feat: add employee portal page routes"
```

---

### Task 9: Update EmployeeAdmin — Email Field in Edit Modal

**Files:**
- Modify: `src/components/EmployeeAdmin.tsx`

**Step 1: Add email to StaffModal form state**

In `StaffModal`, add to the `form` useState initializer (after `sort_order`):

```typescript
email: staff?.email ?? "",
```

**Step 2: Add email to the form payload**

In `handleSubmit`, add to the `payload` object:

```typescript
email: form.email.trim() || null,
```

**Step 3: Add email input field to the modal**

After the `sort_order` input field and before the button row, add a full-width email field:

```tsx
<div className="col-span-2">
  <label style={labelStyle}>Portal Email</label>
  <input
    style={inputStyle}
    type="email"
    value={form.email}
    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
    placeholder="employee@example.com"
  />
</div>
```

**Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/EmployeeAdmin.tsx
git commit -m "feat: add email field to Employee Admin staff edit modal"
```

---

### Task 10: Landing Page — Employee Portal Card

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add Employee Portal to microApps array**

Add after the Employee Admin entry in the `microApps` array:

```typescript
{
  name: "Employee Portal",
  description: "Staff login for fee summaries & account info",
  href: "/employee",
  icon: "🔑",
  color: "#0ea5e9",
},
```

**Step 2: Verify it renders**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add Employee Portal card to landing page"
```

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update Project Overview**

Add to the numbered list:

```
5. **Employee Portal** (`/employee`) — Employee-facing portal with Supabase Auth login, placeholder onboarding, and read-only fee dashboard
```

**Step 2: Update Routing section**

Add:

```
/employee                  → Employee login (Supabase Auth)
/employee/onboarding       → First-login onboarding placeholder
/employee/dashboard        → Fee summary dashboard (auth required)
```

**Step 3: Update Data Layer section**

Add:

```
- `src/lib/employeeAuthHooks.ts` — Employee Portal (`useEmployeeAuth`)
- `src/lib/employeePortalHooks.ts` — Employee Portal (`useEmployeeFees`)
```

**Step 4: Update Type Definitions section**

Add `employeeportal.ts` to the list.

**Step 5: Update Component Structure section**

Add note: Employee Portal uses three components in `src/components/employee-portal/` (LoginPage, OnboardingPage, Dashboard).

**Step 6: Update Security Model section**

Add note: Employee Portal uses Supabase Auth (email+password) — the only micro-app with real authentication. Employee accounts are created manually in the Supabase Dashboard.

**Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Employee Portal documentation"
```

---

## Supabase Auth Config (Manual — Not Automated)

These steps must be done manually in the Supabase Dashboard before testing:

1. Go to **Authentication > Providers** — ensure Email provider is enabled
2. Go to **Authentication > Settings** — disable "Confirm email" (this is an internal tool)
3. Go to **Authentication > Users > Add User** — create a test employee account
4. In **Employee Admin**, edit that employee's record and set their portal email to match

---

## Task Dependency Graph

```
Task 1 (schema) ──┐
Task 2 (types)  ──┤
                  ├── Task 3 (auth hook) ──┐
                  │                        ├── Task 5 (LoginPage) ──┐
                  │                        ├── Task 6 (Onboarding) ─┤
                  ├── Task 4 (fees hook) ──┼── Task 7 (Dashboard) ──┤
                  │                        │                        ├── Task 8 (routes)
                  ├── Task 9 (admin edit) ─┘                        │
                  ├── Task 10 (landing)                             │
                  └── Task 11 (docs) ───────────────────────────────┘
```

Tasks 1-2 should be done first. Then 3 and 4 can be parallel. Then 5-7 can be parallel. Then 8 ties them together. Tasks 9-11 are independent of each other and can happen any time after Task 2.
