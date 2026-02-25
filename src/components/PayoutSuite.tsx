"use client";

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  BRANCHES,
  isBranchConfigured,
  computePayDate,
  branchSlug,
} from "@/lib/payrollConfig";
import type { StaffMember } from "@/lib/payrollConfig";
import type { StaffPayrollData } from "@/lib/payrollTransform";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BranchResult {
  status: "idle" | "running" | "done" | "error" | "unconfigured";
  error?: string;
  data?: {
    branchName: string;
    abbreviation: string;
    payPeriod: string;
    payDate: string;
    staffData: Record<string, StaffPayrollData>;
    staffOrder: string[];
    staffConfig: Record<string, StaffMember>;
    warnings: string[];
    excelBase64: string;
    totalRows: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PayoutSuite() {
  const { theme, toggleTheme } = useTheme();

  // Date inputs
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Per-branch results
  const [results, setResults] = useState<Record<string, BranchResult>>(() => {
    const initial: Record<string, BranchResult> = {};
    for (const b of BRANCHES) {
      initial[b.branchId] = {
        status: isBranchConfigured(b.branchId) ? "idle" : "unconfigured",
      };
    }
    return initial;
  });

  // Active tab
  const [activeTab, setActiveTab] = useState(BRANCHES[0].branchId);

  // Running state
  const isRunning = Object.values(results).some((r) => r.status === "running");

  // Computed pay date
  const payDate = endDate ? computePayDate(endDate) : "";
  const payDateFormatted = payDate
    ? (() => {
        const d = new Date(payDate + "T12:00:00");
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      })()
    : "";

  // ── Run payroll for all configured branches ──
  const runPayroll = useCallback(async () => {
    if (!startDate || !endDate) return;

    // Reset all configured branches to running
    setResults((prev) => {
      const next = { ...prev };
      for (const b of BRANCHES) {
        if (isBranchConfigured(b.branchId)) {
          next[b.branchId] = { status: "running" };
        }
      }
      return next;
    });

    // Fire all configured branches in parallel
    const promises = BRANCHES.filter((b) =>
      isBranchConfigured(b.branchId)
    ).map(async (branch) => {
      try {
        const res = await fetch("/api/phorest/payroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: branch.branchId,
            startDate,
            endDate,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          setResults((prev) => ({
            ...prev,
            [branch.branchId]: {
              status: "error",
              error: json.error || `HTTP ${res.status}`,
            },
          }));
          return;
        }

        setResults((prev) => ({
          ...prev,
          [branch.branchId]: { status: "done", data: json },
        }));
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [branch.branchId]: {
            status: "error",
            error: err instanceof Error ? err.message : "Network error",
          },
        }));
      }
    });

    await Promise.allSettled(promises);
  }, [startDate, endDate]);

  // ── Download XLSX ──
  const downloadExcel = useCallback(
    (branchId: string) => {
      const result = results[branchId];
      if (result?.status !== "done" || !result.data?.excelBase64) return;

      const binaryStr = atob(result.data.excelBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NetSuite_Payroll_${result.data.abbreviation.replace(/ /g, "_")}_${result.data.payPeriod.replace(/\//g, "-")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [results]
  );

  const activeBranch = BRANCHES.find((b) => b.branchId === activeTab);
  const activeResult = results[activeTab];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="no-underline">
            <Image
              src="/whb-legacy-vert-bw.png"
              alt="WHB Legacy"
              width={48}
              height={40}
              className="object-contain"
              style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
            />
          </Link>
          <div>
            <h1
              className="text-lg font-sans font-medium tracking-wide m-0"
              style={{ color: "var(--text-primary)" }}
            >
              Payout Suite
            </h1>
            <p
              className="text-[10px] font-sans tracking-[1.5px] uppercase m-0"
              style={{ color: "var(--text-muted)" }}
            >
              Payroll Processing
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="border px-3 py-1.5 rounded-md text-xs font-sans tracking-[1px] uppercase transition-all"
          style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
        >
          {theme === "dark" ? "☀ Light" : "● Dark"}
        </button>
      </header>

      {/* Controls Bar */}
      <div
        className="px-6 py-4 border-b flex flex-wrap items-end gap-4"
        style={{
          borderColor: "var(--border-color)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-sans tracking-[1.5px] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Period Start
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-md border text-sm font-sans"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-sans tracking-[1.5px] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Period End
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-md border text-sm font-sans"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {payDate && (
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] font-sans tracking-[1.5px] uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              Pay Date (auto)
            </label>
            <div
              className="px-3 py-2 rounded-md border text-sm font-sans"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-secondary)",
              }}
            >
              {payDateFormatted}
            </div>
          </div>
        )}

        <button
          onClick={runPayroll}
          disabled={!startDate || !endDate || isRunning}
          className="px-6 py-2 rounded-md text-sm font-sans font-medium tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "var(--gold)",
            color: "#0a0b0e",
          }}
        >
          {isRunning ? "Processing..." : "Run Payroll"}
        </button>
      </div>

      {/* Branch Tabs */}
      <div
        className="flex border-b overflow-x-auto"
        style={{ borderColor: "var(--border-color)" }}
      >
        {BRANCHES.map((branch) => {
          const result = results[branch.branchId];
          const isActive = activeTab === branch.branchId;
          const configured = isBranchConfigured(branch.branchId);

          return (
            <button
              key={branch.branchId}
              onClick={() => setActiveTab(branch.branchId)}
              className="px-5 py-3 text-xs font-sans tracking-wide whitespace-nowrap transition-all relative"
              style={{
                color: isActive
                  ? "var(--gold)"
                  : configured
                    ? "var(--text-secondary)"
                    : "var(--text-muted)",
                borderBottom: isActive
                  ? "2px solid var(--gold)"
                  : "2px solid transparent",
                opacity: configured ? 1 : 0.5,
              }}
            >
              {branch.name}
              {result?.status === "running" && (
                <span className="ml-2 inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--gold)" }} />
              )}
              {result?.status === "done" && (
                <span className="ml-2" style={{ color: "#4ade80" }}>
                  ✓
                </span>
              )}
              {result?.status === "error" && (
                <span className="ml-2" style={{ color: "#f87171" }}>
                  ✗
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <main className="flex-1 px-6 py-6 overflow-auto">
        {activeResult?.status === "unconfigured" && (
          <div
            className="text-center py-16"
            style={{ color: "var(--text-muted)" }}
          >
            <p className="text-sm font-sans">
              {activeBranch?.name} is not yet configured with staff data.
            </p>
            <p className="text-xs font-sans mt-2">
              Add staff configuration in{" "}
              <code
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: "var(--input-bg)" }}
              >
                payrollConfig.ts
              </code>{" "}
              to enable payroll processing for this location.
            </p>
          </div>
        )}

        {activeResult?.status === "idle" && (
          <div
            className="text-center py-16"
            style={{ color: "var(--text-muted)" }}
          >
            <p className="text-sm font-sans">
              Select a date range and click <strong>Run Payroll</strong> to
              begin.
            </p>
          </div>
        )}

        {activeResult?.status === "running" && (
          <div
            className="text-center py-16"
            style={{ color: "var(--text-secondary)" }}
          >
            <div
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4"
              style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
            />
            <p className="text-sm font-sans">
              Fetching and processing {activeBranch?.name}...
            </p>
            <p className="text-xs font-sans mt-1" style={{ color: "var(--text-muted)" }}>
              This may take a minute while Phorest generates the export.
            </p>
          </div>
        )}

        {activeResult?.status === "error" && (
          <div className="text-center py-16">
            <p className="text-sm font-sans" style={{ color: "#f87171" }}>
              Error: {activeResult.error}
            </p>
          </div>
        )}

        {activeResult?.status === "done" && activeResult.data && (
          <BranchResults
            data={activeResult.data}
            onDownload={() => downloadExcel(activeTab)}
          />
        )}

        {/* Past Runs — always shown for configured branches */}
        {activeResult?.status !== "unconfigured" && (
          <PastRuns
            branchId={activeTab}
            key={`${activeTab}-${activeResult?.data?.payPeriod || "idle"}`}
          />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Booth rent rebate tier formula — matches XLSX =IF(E>250,0.2,IF(E>149,0.15,IF(E>49,0.1,0)))*E */
function boothRentRebate(productSales: number): number {
  if (productSales > 250) return 0.2 * productSales;
  if (productSales > 149) return 0.15 * productSales;
  if (productSales > 49) return 0.1 * productSales;
  return 0;
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return "";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNeg(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return "";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface ParsedRun {
  fileName: string;
  runDate: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  displayRunDate: string;
  displayPeriod: string;
  displayPayDate: string;
}

function parseRunFilename(fileName: string): ParsedRun | null {
  const match = fileName.match(
    /^run-(\d{4}-\d{2}-\d{2}T[\d-]+)_period-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})_pay-(\d{4}-\d{2}-\d{2})\.xlsx$/
  );
  if (!match) return null;

  const [, runDate, periodStart, periodEnd, payDate] = match;

  const runParts = runDate.split("T");
  const runD = new Date(runParts[0] + "T" + (runParts[1] || "00-00-00").replace(/-/g, ":"));
  const displayRunDate = runD.toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const ps = new Date(periodStart + "T12:00:00");
  const pe = new Date(periodEnd + "T12:00:00");
  const monthName = ps.toLocaleString("en-US", { month: "short" });
  const displayPeriod = ps.getMonth() === pe.getMonth()
    ? `${monthName} ${ps.getDate()}–${pe.getDate()}, ${pe.getFullYear()}`
    : `${monthName} ${ps.getDate()} – ${pe.toLocaleString("en-US", { month: "short" })} ${pe.getDate()}, ${pe.getFullYear()}`;

  const pd = new Date(payDate + "T12:00:00");
  const displayPayDate = `${pd.getMonth() + 1}/${pd.getDate()}/${pd.getFullYear()}`;

  return {
    fileName, runDate, periodStart, periodEnd, payDate,
    displayRunDate, displayPeriod, displayPayDate,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRANCH RESULTS VIEW — mirrors XLSX columns A–AF exactly
// ═══════════════════════════════════════════════════════════════════════════════

function BranchResults({
  data,
  onDownload,
}: {
  data: NonNullable<BranchResult["data"]>;
  onDownload: () => void;
}) {
  const { staffData, staffOrder, staffConfig, warnings } = data;

  // Compute associate fees for supervisors (same logic as XLSX Col X)
  // Uses computed associatePay from data, not the config value
  const associateFees: Record<string, number> = {};
  for (const [name, cfg] of Object.entries(staffConfig)) {
    const assocPayData = staffData[name]?.associatePay || 0;
    if (cfg.supervisor && assocPayData && staffConfig[cfg.supervisor]) {
      associateFees[cfg.supervisor] = (associateFees[cfg.supervisor] || 0) + -assocPayData;
    }
  }

  // Build computed rows
  const rows = staffOrder.map((name) => {
    const d = staffData[name] || { productWk1: 0, productWk2: 0, contractorService: 0, associatePay: 0, tips: 0, newGuests: 0, employeePurchases: 0 };
    const cfg = staffConfig[name];
    const rebateWk1 = boothRentRebate(d.productWk1);
    const rebateWk2 = boothRentRebate(d.productWk2);
    const rebateTotal = rebateWk1 + rebateWk2;
    const totalEarned = rebateTotal + d.tips + d.contractorService + d.associatePay;
    const colorCharges = 0; // manual
    const ccAmount = 0; // manual
    const ccCharges = 0.03 * -ccAmount;
    const findersFee = 0.2 * -(d.newGuests || 0);
    const empPurch = d.employeePurchases ? -d.employeePurchases : 0;
    const assocFee = associateFees[name] || 0;
    const miscFees = 0;
    const totalCheck = totalEarned + (cfg.stationLease + cfg.financialServices + colorCharges + ccCharges + findersFee + empPurch + cfg.phorestFee + cfg.refreshment + assocFee + miscFees);

    return {
      name,
      cfg,
      d,
      rebateWk1,
      rebateWk2,
      rebateTotal,
      totalEarned,
      colorCharges,
      ccAmount,
      ccCharges,
      findersFee,
      empPurch,
      assocFee,
      miscFees,
      totalCheck,
    };
  });

  const totalPayroll = rows.reduce((sum, r) => sum + r.totalCheck, 0);

  // Header cell styling
  const hc = "px-2 py-1 font-medium whitespace-nowrap";
  const dc = "px-2 py-1.5 whitespace-nowrap";
  const manualBg = "rgba(251, 191, 36, 0.06)";

  return (
    <div>
      {/* Summary + Download */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-sm font-sans font-medium m-0"
            style={{ color: "var(--text-primary)" }}
          >
            {data.branchName}
          </h2>
          <p
            className="text-xs font-sans m-0 mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Pay Period: {data.payPeriod} &middot; Pay Date: {data.payDate}{" "}
            &middot; {data.totalRows} transactions processed
          </p>
        </div>
        <button
          onClick={onDownload}
          className="px-4 py-2 rounded-md text-xs font-sans font-medium tracking-wide transition-all"
          style={{
            background: "var(--gold)",
            color: "#0a0b0e",
          }}
        >
          Download XLSX
        </button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div
          className="mb-4 p-3 rounded-lg border text-xs font-sans"
          style={{
            borderColor: "rgba(251, 191, 36, 0.3)",
            background: "rgba(251, 191, 36, 0.05)",
            color: "#fbbf24",
          }}
        >
          {warnings.map((w, i) => (
            <p key={i} className="m-0">{w}</p>
          ))}
        </div>
      )}

      {/* Spreadsheet-style table — matches XLSX columns A through AF */}
      <div
        className="rounded-lg border overflow-x-auto"
        style={{ borderColor: "var(--border-light)" }}
      >
        <table
          className="text-[11px] font-sans border-collapse"
          style={{ minWidth: 2800 }}
        >
          {/* ── Header Row 1 ── */}
          <thead>
            <tr style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
              <th className={hc}></th>{/* A */}
              <th className={hc}></th>{/* B */}
              <th className={hc}></th>{/* C */}
              <th className={hc}></th>{/* D */}
              <th className={hc}>Product Sales</th>{/* E */}
              <th className={hc}></th>{/* F */}
              <th className={hc}>Product Sales</th>{/* G */}
              <th className={hc}>Booth Rent</th>{/* H */}
              <th className={hc}>(GL 7140)</th>{/* I */}
              <th className={hc}>(GL 7150)</th>{/* J */}
              <th className={hc}>(GL 7170)</th>{/* K */}
              <th className={hc}>(GL 7180)</th>{/* L */}
              <th className={hc}>Total</th>{/* M */}
              <th className={hc}>(GL 4020)</th>{/* N */}
              <th className={hc}>(GL 4030)</th>{/* O */}
              <th className={hc}>(GL 4045)</th>{/* P */}
              <th className={hc}>Credit Card</th>{/* Q */}
              <th className={hc}>(GL 4040)</th>{/* R */}
              <th className={hc}>New Guests</th>{/* S */}
              <th className={hc}>(GL 4060)</th>{/* T */}
              <th className={hc}>(GL 4070)</th>{/* U */}
              <th className={hc}>(GL 4080)</th>{/* V */}
              <th className={hc}>(GL 4090)</th>{/* W */}
              <th className={hc}>(GL 4120)</th>{/* X */}
              <th className={hc}>Misc.</th>{/* Y */}
              <th className={hc}>Total</th>{/* Z */}
              <th className={hc}>Account</th>{/* AA */}
              <th className={hc}>Posting</th>{/* AB */}
              <th className={hc}>Reference</th>{/* AC */}
              <th className={hc}>Due</th>{/* AD */}
              <th className={hc}>Approval</th>{/* AE */}
              <th className={hc}>Pay</th>{/* AF */}
            </tr>
            {/* ── Header Row 2 ── */}
            <tr style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}>(wk 1)</th>
              <th className={hc}>Booth Rent</th>
              <th className={hc}>(wk 2)</th>
              <th className={hc}>Rebate (wk 2)</th>
              <th className={hc}>Booth Rent</th>
              <th className={hc}>Tips</th>
              <th className={hc}>Contractor</th>
              <th className={hc}>Associate</th>
              <th className={hc}>Earned</th>
              <th className={hc}>Station</th>
              <th className={hc}>Financial</th>
              <th className={hc}>Color</th>
              <th className={hc}>Amount</th>
              <th className={hc}>Credit Card</th>
              <th className={hc}></th>
              <th className={hc}>Finders</th>
              <th className={hc}>Employee</th>
              <th className={hc}>Phorest</th>
              <th className={hc}>Refreshment</th>
              <th className={hc}>Associate</th>
              <th className={hc}>Fees</th>
              <th className={hc}>check</th>
              <th className={hc}></th>
              <th className={hc}>Period</th>
              <th className={hc}>#</th>
              <th className={hc}>Date</th>
              <th className={hc}>Status</th>
              <th className={hc}>Period</th>
            </tr>
            {/* ── Header Row 3 ── */}
            <tr style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", borderBottom: "2px solid var(--border-color)" }}>
              <th className={hc}>Sub. ID</th>
              <th className={hc}>Internal ID</th>
              <th className={hc}>First Names</th>
              <th className={hc}>Last Name</th>
              <th className={hc}></th>
              <th className={hc}>Rebate (wk 1)</th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}>Rebate Total</th>
              <th className={hc}></th>
              <th className={hc}>Service</th>
              <th className={hc}>Pay</th>
              <th className={hc}></th>
              <th className={hc}>Lease</th>
              <th className={hc}>Services</th>
              <th className={hc}>Charges</th>
              <th className={hc}></th>
              <th className={hc}>Charges 3%</th>
              <th className={hc}></th>
              <th className={hc}>Fee 20%</th>
              <th className={hc}>Purchases</th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}>Fee</th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}></th>
              <th className={hc}>Pay Period</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const payDateObj = new Date(data.payDate + "T12:00:00");
              const payDateRef = `ACH ${payDateObj.getMonth() + 1}.${payDateObj.getDate()}.${payDateObj.getFullYear()}`;
              const postingPeriod = data.payPeriod; // simplified display

              return (
                <tr
                  key={r.name}
                  className="border-t"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  {/* A: Subsidiary ID */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>5</td>
                  {/* B: Internal ID */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{r.cfg.internalId || ""}</td>
                  {/* C: First Names */}
                  <td className={dc} style={{ color: "var(--text-primary)" }}>{r.cfg.targetFirst}</td>
                  {/* D: Last Name */}
                  <td className={dc} style={{ color: "var(--text-primary)" }}>{r.cfg.targetLast}</td>
                  {/* E: Product Sales (wk 1) */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.d.productWk1)}</td>
                  {/* F: Booth Rent Rebate (wk 1) — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.rebateWk1)}</td>
                  {/* G: Product Sales (wk 2) */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.d.productWk2)}</td>
                  {/* H: Booth Rent Rebate (wk 2) — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.rebateWk2)}</td>
                  {/* I: Booth Rent Rebate Total — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.rebateTotal)}</td>
                  {/* J: Tips */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.d.tips)}</td>
                  {/* K: Contractor Service */}
                  <td className={`${dc} text-right`} style={{ color: "var(--gold)" }}>{fmt(r.d.contractorService)}</td>
                  {/* L: Associate Pay */}
                  <td className={`${dc} text-right`} style={{ color: "var(--gold)" }}>{fmt(r.d.associatePay)}</td>
                  {/* M: Total Earned — formula */}
                  <td className={`${dc} text-right font-medium`} style={{ color: "var(--text-primary)" }}>{fmt(r.totalEarned)}</td>
                  {/* N: Station Lease */}
                  <td className={`${dc} text-right`} style={{ color: r.cfg.stationLease ? "#f87171" : "var(--text-muted)" }}>{fmtNeg(r.cfg.stationLease)}</td>
                  {/* O: Financial Services */}
                  <td className={`${dc} text-right`} style={{ color: r.cfg.financialServices ? "#f87171" : "var(--text-muted)" }}>{fmtNeg(r.cfg.financialServices)}</td>
                  {/* P: Color Charges — manual */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-muted)", background: manualBg }}></td>
                  {/* Q: Credit Card Amount — manual */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-muted)", background: manualBg }}></td>
                  {/* R: CC Charges 3% — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-muted)" }}>{fmt(r.ccCharges)}</td>
                  {/* S: New Guests */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.d.newGuests)}</td>
                  {/* T: Finders Fee 20% — formula */}
                  <td className={`${dc} text-right`} style={{ color: r.findersFee ? "#f87171" : "var(--text-muted)" }}>{fmt(r.findersFee)}</td>
                  {/* U: Employee Purchases */}
                  <td className={`${dc} text-right`} style={{ color: r.empPurch ? "#f87171" : "var(--text-muted)" }}>{fmtNeg(r.empPurch)}</td>
                  {/* V: Phorest */}
                  <td className={`${dc} text-right`} style={{ color: r.cfg.phorestFee ? "#f87171" : "var(--text-muted)" }}>{fmtNeg(r.cfg.phorestFee)}</td>
                  {/* W: Refreshment */}
                  <td className={`${dc} text-right`} style={{ color: r.cfg.refreshment ? "#f87171" : "var(--text-muted)" }}>{fmtNeg(r.cfg.refreshment)}</td>
                  {/* X: Associate Fee */}
                  <td className={`${dc} text-right`} style={{ color: r.assocFee ? "#f87171" : "var(--text-muted)" }}>{fmtNeg(r.assocFee)}</td>
                  {/* Y: Misc Fees */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-muted)" }}></td>
                  {/* Z: Total Check — formula */}
                  <td className={`${dc} text-right font-medium`} style={{ color: r.totalCheck > 0 ? "#4ade80" : r.totalCheck < 0 ? "#f87171" : "var(--text-muted)" }}>{fmt(r.totalCheck)}</td>
                  {/* AA: Account */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>111</td>
                  {/* AB: Posting Period */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{data.payPeriod.split("-")[0]?.split("/")[0]}/1</td>
                  {/* AC: Reference # */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{payDateRef}</td>
                  {/* AD: Due Date */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{data.payDate}</td>
                  {/* AE: Approval Status */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>Approved</td>
                  {/* AF: Pay Period */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{data.payPeriod}</td>
                </tr>
              );
            })}
            {/* ── Footer Row 1: TOTAL PAYROLL ── */}
            <tr style={{ borderTop: "2px solid var(--border-color)" }}>
              <td className={dc} colSpan={24}></td>
              <td className={`${dc} text-right font-medium`} style={{ color: "var(--text-secondary)" }}>TOTAL PAYROLL:</td>
              <td className={`${dc} text-right font-medium`} style={{ color: "#4ade80" }}>{fmt(totalPayroll)}</td>
              <td className={dc} colSpan={6}></td>
            </tr>
            {/* ── Footer Row 2: TOTAL EMP. W/DRAWL ── */}
            <tr>
              <td className={dc} colSpan={2}></td>
              <td className={dc} style={{ color: "var(--text-muted)" }}>Pay Period:</td>
              <td className={dc} style={{ color: "var(--text-muted)" }}>{data.payPeriod}</td>
              <td className={dc} colSpan={20}></td>
              <td className={`${dc} text-right font-medium`} style={{ color: "var(--text-secondary)" }}>TOTAL EMP. W/DRAWL:</td>
              <td className={`${dc} text-right`} style={{ color: "var(--text-muted)", background: manualBg }}></td>
              <td className={dc} colSpan={6}></td>
            </tr>
            {/* ── Footer Row 3: TOTAL ACH ── */}
            <tr>
              <td className={dc} colSpan={2}></td>
              <td className={dc} style={{ color: "var(--text-muted)" }}>Pay Date:</td>
              <td className={dc} style={{ color: "var(--text-muted)" }}>{data.payDate}</td>
              <td className={dc} colSpan={20}></td>
              <td className={`${dc} text-right font-medium`} style={{ color: "var(--text-secondary)" }}>TOTAL ACH:</td>
              <td className={`${dc} text-right font-medium`} style={{ color: "#4ade80" }}>{fmt(totalPayroll)}</td>
              <td className={dc} colSpan={6}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Manual Entry Legend */}
      <div
        className="mt-4 p-3 rounded-lg text-xs font-sans flex items-center gap-3"
        style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}
      >
        <span
          className="inline-block w-4 h-3 rounded-sm border"
          style={{ background: manualBg, borderColor: "var(--border-light)" }}
        />
        <span>
          <strong style={{ color: "var(--text-secondary)" }}>Highlighted cells</strong> require manual entry in the downloaded XLSX:
          Color Charges (P), Credit Card Amount (Q), Total Emp. Withdrawal (footer).
          Tips are GC-only — add cash tips manually.
        </span>
      </div>
    </div>
  );
}

function PastRuns({ branchId }: { branchId: string }) {
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filterDate, setFilterDate] = useState("");

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

  const filtered = filterDate
    ? runs.filter((r) => r.runDate.startsWith(filterDate))
    : runs;

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
