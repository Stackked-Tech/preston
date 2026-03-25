"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  fetchBranchConfigs,
  computePayDate,
  branchSlug,
} from "@/lib/payrollConfig";
import type { BranchConfig, StaffMember } from "@/lib/payrollConfig";
import type { StaffPayrollData } from "@/lib/payrollTransform";
import { generatePayrollExcelFromRows } from "@/lib/payrollExcel";
import type { FinalPayrollRow } from "@/lib/payrollExcel";

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
    tipsSource: "looker" | "supabase-cache" | "csv-gc-fallback";
    excelBase64: string;
    totalRows: number;
    subsidiaryId: number;
    account: number;
    postingPeriod: string;
  };
}

/** Fields that Rachel can edit in the results table before downloading */
interface PayrollOverrides {
  productWk1?: number;
  productWk2?: number;
  tips?: number;
  contractorService?: number;
  associatePay?: number;
  newGuests?: number;
  employeePurchases?: number;
  colorCharges?: number;
  creditCardAmount?: number;
  stationLease?: number;
  financialServices?: number;
  phorestFee?: number;
  refreshment?: number;
  miscFees?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PayoutSuite() {
  const { theme, toggleTheme } = useTheme();

  // Branch configs from DB
  const [BRANCHES, setBranches] = useState<BranchConfig[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  // Date inputs
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Per-branch results
  const [results, setResults] = useState<Record<string, BranchResult>>({});

  // Active tab
  const [activeTab, setActiveTab] = useState("");

  // Fetch branch configs on mount
  useEffect(() => {
    fetchBranchConfigs()
      .then((configs) => {
        setBranches(configs);
        setBranchesLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch branch configs:", err);
        setBranchesLoading(false);
      });
  }, []);

  // Initialize results and active tab once branches load
  useEffect(() => {
    if (BRANCHES.length > 0 && !activeTab) {
      setActiveTab(BRANCHES[0].branchId);
    }
    if (BRANCHES.length > 0 && Object.keys(results).length === 0) {
      const initial: Record<string, BranchResult> = {};
      for (const b of BRANCHES) {
        initial[b.branchId] = {
          status: Object.keys(b.staffConfig).length > 0 ? "idle" : "unconfigured",
        };
      }
      setResults(initial);
    }
  }, [BRANCHES, activeTab, results]);

  // Local helper to replace the imported isBranchConfigured
  const isBranchConfigured = useCallback(
    (branchId: string) => {
      const branch = BRANCHES.find((b) => b.branchId === branchId);
      return !!branch && Object.keys(branch.staffConfig).length > 0;
    },
    [BRANCHES]
  );

  // Which branches to include in next payroll run
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set()
  );

  // Auto-select configured branches when they load
  useEffect(() => {
    if (BRANCHES.length > 0 && selectedBranches.size === 0) {
      const configured = BRANCHES.filter((b) =>
        Object.keys(b.staffConfig).length > 0
      ).map((b) => b.branchId);
      setSelectedBranches(new Set(configured));
    }
  }, [BRANCHES]);

  const toggleBranch = useCallback((branchId: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }, []);

  // Color charges CSV per branch (keyed by branchId)
  const [colorChargesCsvs, setColorChargesCsvs] = useState<
    Record<string, string>
  >({});

  // Running state
  const isRunning = Object.values(results).some((r) => r.status === "running");

  // Fetch Tips state
  const [fetchingTips, setFetchingTips] = useState(false);
  const [tipsMessage, setTipsMessage] = useState<string | null>(null);

  // Computed pay date
  const payDate = endDate ? computePayDate(endDate) : "";
  const payDateFormatted = payDate
    ? (() => {
        const d = new Date(payDate + "T12:00:00");
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      })()
    : "";

  // ── Handle color charges CSV upload ──
  const handleColorChargesUpload = useCallback(
    (branchId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setColorChargesCsvs((prev) => ({ ...prev, [branchId]: text }));
        }
      };
      reader.readAsText(file);
    },
    []
  );

  const clearColorCharges = useCallback((branchId: string) => {
    setColorChargesCsvs((prev) => {
      const next = { ...prev };
      delete next[branchId];
      return next;
    });
  }, []);

  // ── Run payroll for selected branches ──
  const runPayroll = useCallback(async () => {
    if (!startDate || !endDate || selectedBranches.size === 0) return;

    // Reset selected branches to running
    setResults((prev) => {
      const next = { ...prev };
      for (const b of BRANCHES) {
        if (selectedBranches.has(b.branchId)) {
          next[b.branchId] = { status: "running" };
        }
      }
      return next;
    });

    // Fire selected branches in parallel
    const promises = BRANCHES.filter((b) =>
      selectedBranches.has(b.branchId)
    ).map(async (branch) => {
      try {
        const res = await fetch("/api/phorest/payroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: branch.branchId,
            startDate,
            endDate,
            colorChargesCsv: colorChargesCsvs[branch.branchId] || null,
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
  }, [startDate, endDate, colorChargesCsvs, selectedBranches, BRANCHES]);

  // ── Auto-poll for tips when branches are missing them ──
  const tipsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Find branches that finished but don't have tips yet
    const needsTips = Object.entries(results).filter(
      ([, r]) => r.status === "done" && r.data?.tipsSource === "csv-gc-fallback"
    );

    if (needsTips.length === 0 || !startDate || !endDate) {
      // No branches need tips — clear any existing poll
      if (tipsPollingRef.current) {
        clearInterval(tipsPollingRef.current);
        tipsPollingRef.current = null;
      }
      return;
    }

    // Already polling
    if (tipsPollingRef.current) return;

    let attempts = 0;
    const maxAttempts = 20; // ~100s at 5s intervals

    tipsPollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (tipsPollingRef.current) {
          clearInterval(tipsPollingRef.current);
          tipsPollingRef.current = null;
        }
        return;
      }

      for (const [branchId, result] of needsTips) {
        if (result.status !== "done" || result.data?.tipsSource !== "csv-gc-fallback") continue;

        try {
          const res = await fetch(
            `/api/phorest/tips-status?branchId=${branchId}&startDate=${startDate}&endDate=${endDate}`
          );
          const json = await res.json();

          if (json.ready && json.tips) {
            // Update staffData with tips in-place
            setResults((prev) => {
              const branchResult = prev[branchId];
              if (branchResult?.status !== "done" || !branchResult.data) return prev;

              const updatedStaffData = { ...branchResult.data.staffData };
              for (const [name, tip] of Object.entries(json.tips as Record<string, number>)) {
                if (updatedStaffData[name]) {
                  updatedStaffData[name] = { ...updatedStaffData[name], tips: tip };
                }
              }

              // Remove the tips warning
              const updatedWarnings = branchResult.data.warnings.filter(
                (w) => !w.includes("Tips are still being fetched") && !w.includes("re-run payroll")
              );

              return {
                ...prev,
                [branchId]: {
                  ...branchResult,
                  data: {
                    ...branchResult.data,
                    staffData: updatedStaffData,
                    tipsSource: "supabase-cache" as const,
                    warnings: updatedWarnings,
                  },
                },
              };
            });
          }
        } catch {
          // Non-fatal — will retry next interval
        }
      }
    }, 5_000);

    return () => {
      if (tipsPollingRef.current) {
        clearInterval(tipsPollingRef.current);
        tipsPollingRef.current = null;
      }
    };
  }, [results, startDate, endDate]);

  // ── Fetch Tips (trigger GitHub Action → Supabase) ──
  const fetchTips = useCallback(async () => {
    if (!startDate || !endDate || !activeTab) return;
    setFetchingTips(true);
    setTipsMessage(null);
    try {
      const res = await fetch("/api/phorest/fetch-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeTab,
          startDate,
          endDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTipsMessage(`Error: ${json.error}`);
      } else {
        setTipsMessage(
          "Tips fetch started — re-run payroll in ~60 seconds to see updated tips."
        );
      }
    } catch (err) {
      setTipsMessage(
        `Failed: ${err instanceof Error ? err.message : "Network error"}`
      );
    } finally {
      setFetchingTips(false);
    }
  }, [startDate, endDate, activeTab]);

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

  // Loading guard while branches are fetching
  if (branchesLoading || BRANCHES.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}
      >
        <p className="text-sm font-sans">Loading branches...</p>
      </div>
    );
  }

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
          disabled={!startDate || !endDate || isRunning || selectedBranches.size === 0}
          className="px-6 py-2 rounded-md text-sm font-sans font-medium tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "var(--gold)",
            color: "#0a0b0e",
          }}
        >
          {isRunning
            ? "Processing..."
            : selectedBranches.size === 1
              ? `Run Payroll (1 location)`
              : `Run Payroll (${selectedBranches.size} locations)`}
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
          const isSelected = selectedBranches.has(branch.branchId);

          return (
            <div
              key={branch.branchId}
              className="flex items-center relative"
              style={{
                borderBottom: isActive
                  ? "2px solid var(--gold)"
                  : "2px solid transparent",
              }}
            >
              {configured && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleBranch(branch.branchId)}
                  className="ml-3 accent-[var(--gold)] cursor-pointer"
                  style={{ width: 14, height: 14 }}
                  title={isSelected ? `Exclude ${branch.name}` : `Include ${branch.name}`}
                />
              )}
              <button
                onClick={() => setActiveTab(branch.branchId)}
                className="px-4 py-3 text-xs font-sans tracking-wide whitespace-nowrap transition-all"
                style={{
                  color: isActive
                    ? "var(--gold)"
                    : configured
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                  opacity: configured ? 1 : 0.5,
                  paddingLeft: configured ? "0.5rem" : "1.25rem",
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
            </div>
          );
        })}
      </div>

      {/* Tab Content */}
      <main className="flex-1 px-6 py-6 overflow-auto">
        {/* Color Report CSV upload — per branch, shown for all configured branches */}
        {activeResult?.status !== "unconfigured" && (
          <div
            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              borderColor: colorChargesCsvs[activeTab]
                ? "var(--gold)"
                : "var(--border-light)",
              background: colorChargesCsvs[activeTab]
                ? "rgba(212, 175, 55, 0.04)"
                : "var(--card-bg)",
            }}
          >
            <span
              className="text-xs font-sans"
              style={{ color: "var(--text-muted)" }}
            >
              Color Report
            </span>
            <label
              className="px-3 py-1.5 rounded-md border text-xs font-sans cursor-pointer transition-all"
              style={{
                background: "var(--input-bg)",
                borderColor: colorChargesCsvs[activeTab]
                  ? "var(--gold)"
                  : "var(--border-light)",
                color: colorChargesCsvs[activeTab]
                  ? "var(--gold)"
                  : "var(--text-secondary)",
              }}
            >
              {colorChargesCsvs[activeTab] ? "Loaded ✓" : "Upload CSV"}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleColorChargesUpload(activeTab, file);
                  e.target.value = "";
                }}
              />
            </label>
            {colorChargesCsvs[activeTab] && (
              <button
                onClick={() => clearColorCharges(activeTab)}
                className="text-xs font-sans"
                style={{ color: "var(--text-muted)" }}
              >
                Clear
              </button>
            )}
            {!colorChargesCsvs[activeTab] && (
              <span
                className="text-[10px] font-sans"
                style={{ color: "var(--text-muted)" }}
              >
                Upload the Phorest color stylist list report to auto-fill Column P
              </span>
            )}
          </div>
        )}

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
            onFetchTips={fetchTips}
            fetchingTips={fetchingTips}
            tipsMessage={tipsMessage}
            canFetchTips={!!startDate && !!endDate}
          />
        )}

        {/* Past Runs — always shown for configured branches */}
        {activeResult?.status !== "unconfigured" && (
          <PastRuns
            branchId={activeTab}
            branches={BRANCHES}
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
// EDITABLE CELL
// ═══════════════════════════════════════════════════════════════════════════════

/** Inline-editable number cell. Shows formatted value; click to edit. */
function EditableCell({
  value,
  originalValue,
  onChange,
  color,
  style,
}: {
  value: number;
  originalValue: number;
  onChange: (val: number) => void;
  color?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const isOverridden = value !== originalValue;

  if (editing) {
    return (
      <td className="px-1 py-0.5" style={style}>
        <input
          autoFocus
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(draft);
            if (!isNaN(parsed)) onChange(parsed);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const parsed = parseFloat(draft);
              if (!isNaN(parsed)) onChange(parsed);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full text-right text-[11px] font-sans px-1 py-0.5 rounded border outline-none"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--gold)",
            color: "var(--text-primary)",
          }}
        />
      </td>
    );
  }

  return (
    <td
      className="px-2 py-1.5 whitespace-nowrap text-right cursor-pointer hover:opacity-80"
      style={{
        color: color || "var(--text-secondary)",
        background: isOverridden ? "rgba(212, 175, 55, 0.08)" : undefined,
        borderBottom: isOverridden ? "2px solid var(--gold)" : undefined,
        ...style,
      }}
      onClick={() => {
        setDraft(value ? value.toString() : "0");
        setEditing(true);
      }}
      title={isOverridden ? `Original: ${fmt(originalValue)}` : "Click to edit"}
    >
      {fmt(value)}
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRANCH RESULTS VIEW — mirrors XLSX columns A–AF exactly
// ═══════════════════════════════════════════════════════════════════════════════

function BranchResults({
  data,
  onDownload,
  onFetchTips,
  fetchingTips,
  tipsMessage,
  canFetchTips,
}: {
  data: NonNullable<BranchResult["data"]>;
  onDownload: () => void;
  onFetchTips: () => void;
  fetchingTips: boolean;
  tipsMessage: string | null;
  canFetchTips: boolean;
}) {
  const { staffData, staffOrder, staffConfig, warnings } = data;

  const [overrides, setOverrides] = useState<Record<string, PayrollOverrides>>({});
  const [subsidiaryOverride, setSubsidiaryOverride] = useState<number | null>(null);
  const effectiveSubsidiaryId = subsidiaryOverride ?? data.subsidiaryId;

  const setOverride = useCallback((staffName: string, field: keyof PayrollOverrides, value: number) => {
    setOverrides((prev) => ({
      ...prev,
      [staffName]: { ...prev[staffName], [field]: value },
    }));
  }, []);

  // Compute associate fees using OVERRIDDEN associatePay values
  const associateFees: Record<string, number> = {};
  for (const [name, cfg] of Object.entries(staffConfig)) {
    const raw = staffData[name]?.associatePay || 0;
    const o = overrides[name] || {};
    const assocPayData = o.associatePay ?? raw;
    if (cfg.supervisor && assocPayData && staffConfig[cfg.supervisor]) {
      associateFees[cfg.supervisor] = (associateFees[cfg.supervisor] || 0) + -assocPayData;
    }
  }

  const rows = staffOrder.map((name) => {
    const raw = staffData[name] || { productWk1: 0, productWk2: 0, contractorService: 0, associatePay: 0, tips: 0, newGuests: 0, employeePurchases: 0, creditCardAmount: 0, colorCharges: 0 };
    const cfg = staffConfig[name];
    const o = overrides[name] || {};

    const productWk1 = o.productWk1 ?? raw.productWk1;
    const productWk2 = o.productWk2 ?? raw.productWk2;
    const tips = o.tips ?? raw.tips;
    const contractorService = o.contractorService ?? raw.contractorService;
    const associatePay = o.associatePay ?? raw.associatePay;
    const newGuests = o.newGuests ?? raw.newGuests;
    const employeePurchases = o.employeePurchases ?? raw.employeePurchases;
    const colorCharges = o.colorCharges ?? (raw.colorCharges ? -raw.colorCharges : 0);
    const creditCardAmount = o.creditCardAmount ?? (raw.creditCardAmount || 0);
    const stationLease = o.stationLease ?? cfg.stationLease;
    const financialServices = o.financialServices ?? cfg.financialServices;
    const phorestFee = o.phorestFee ?? cfg.phorestFee;
    const refreshment = o.refreshment ?? cfg.refreshment;
    const miscFees = o.miscFees ?? 0;

    const rebateWk1 = boothRentRebate(productWk1);
    const rebateWk2 = boothRentRebate(productWk2);
    const rebateTotal = rebateWk1 + rebateWk2;
    const totalEarned = rebateTotal + tips + contractorService + associatePay;
    const ccCharges = 0.03 * -creditCardAmount;
    const findersFee = 0.2 * -(newGuests || 0);
    const empPurch = employeePurchases ? -employeePurchases : 0;
    const assocFee = associateFees[name] || 0;
    const totalCheck = totalEarned + (stationLease + financialServices + colorCharges + ccCharges + findersFee + empPurch + phorestFee + refreshment + assocFee + miscFees);

    return {
      name, cfg, productWk1, productWk2, tips, contractorService, associatePay,
      newGuests, employeePurchases, colorCharges, creditCardAmount,
      stationLease, financialServices, phorestFee, refreshment, miscFees,
      rebateWk1, rebateWk2, rebateTotal, totalEarned, ccCharges, findersFee,
      empPurch, assocFee, totalCheck,
    };
  });

  const handleDownload = useCallback(async () => {
    if (Object.keys(overrides).length === 0 && subsidiaryOverride === null) {
      onDownload();
      return;
    }

    const finalRows: FinalPayrollRow[] = rows.map((r) => ({
      subsidiaryId: effectiveSubsidiaryId,
      internalId: r.cfg.internalId,
      targetFirst: r.cfg.targetFirst,
      targetLast: r.cfg.targetLast,
      productWk1: r.productWk1,
      productWk2: r.productWk2,
      tips: r.tips,
      contractorService: r.contractorService,
      associatePay: r.associatePay,
      stationLease: r.stationLease,
      financialServices: r.financialServices,
      colorCharges: r.colorCharges,
      creditCardAmount: r.creditCardAmount,
      newGuests: r.newGuests,
      employeePurchases: r.empPurch,
      phorestFee: r.phorestFee,
      refreshment: r.refreshment,
      associateFee: r.assocFee,
      miscFees: r.miscFees,
    }));

    const xlsxBytes = await generatePayrollExcelFromRows(finalRows, {
      abbreviation: data.abbreviation,
      payPeriodLabel: data.payPeriod,
      payDate: data.payDate,
      postingPeriod: data.postingPeriod,
      account: data.account,
      subsidiaryId: effectiveSubsidiaryId,
    });

    const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.abbreviation}_payroll_edited.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [overrides, rows, data, onDownload]);

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
            className="text-xs font-sans m-0 mt-1 flex items-center gap-1 flex-wrap"
            style={{ color: "var(--text-muted)" }}
          >
            Pay Period: {data.payPeriod} &middot; Pay Date: {data.payDate}{" "}
            &middot; {data.totalRows} transactions processed
            &middot; Subsidiary:{" "}
            <input
              type="number"
              value={effectiveSubsidiaryId}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) setSubsidiaryOverride(v);
              }}
              className="w-12 text-center text-xs font-sans rounded border outline-none"
              style={{
                background: subsidiaryOverride !== null ? "rgba(212, 175, 55, 0.08)" : "transparent",
                borderColor: subsidiaryOverride !== null ? "var(--gold)" : "var(--border-light)",
                color: "var(--text-primary)",
              }}
              title={subsidiaryOverride !== null ? `DB value: ${data.subsidiaryId} (overridden)` : "Click to edit"}
            />
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(overrides).length > 0 || subsidiaryOverride !== null) && (
            <button
              onClick={() => { setOverrides({}); setSubsidiaryOverride(null); }}
              className="px-3 py-2 rounded-md text-xs font-sans font-medium tracking-wide transition-all border"
              style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}
            >
              Reset Edits
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-md text-xs font-sans font-medium tracking-wide transition-all"
            style={{ background: "var(--gold)", color: "#0a0b0e" }}
          >
            {Object.keys(overrides).length > 0 ? "Download Edited XLSX" : "Download XLSX"}
          </button>
        </div>
      </div>

      {/* Warnings + Fetch Tips */}
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

      {/* Tips source indicator + Fetch Tips button */}
      <div className="mb-4 flex items-center gap-3 text-xs font-sans" style={{ color: "var(--text-muted)" }}>
        <span>
          Tips source: <strong style={{ color: data.tipsSource === "supabase-cache" ? "#22c55e" : data.tipsSource === "looker" ? "#22c55e" : "#fbbf24" }}>
            {data.tipsSource === "supabase-cache" ? "Phorest (cached)" : data.tipsSource === "looker" ? "Phorest (live)" : "Manual entry needed"}
          </strong>
        </span>
        <button
          onClick={onFetchTips}
          disabled={fetchingTips || !canFetchTips}
          className="px-3 py-1 rounded text-xs font-medium transition-all disabled:opacity-40"
          style={{
            border: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
          }}
        >
          {fetchingTips ? "Fetching..." : "Fetch Tips from Phorest"}
        </button>
        {tipsMessage && (
          <span style={{ color: tipsMessage.startsWith("Error") ? "#ef4444" : "#22c55e" }}>
            {tipsMessage}
          </span>
        )}
      </div>

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

              return (
                <tr
                  key={r.name}
                  className="border-t"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  {/* A: Subsidiary ID */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{effectiveSubsidiaryId}</td>
                  {/* B: Internal ID */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{r.cfg.internalId || ""}</td>
                  {/* C: First Names */}
                  <td className={dc} style={{ color: "var(--text-primary)" }}>{r.cfg.targetFirst}</td>
                  {/* D: Last Name */}
                  <td className={dc} style={{ color: "var(--text-primary)" }}>{r.cfg.targetLast}</td>
                  {/* E: Product Sales (wk 1) — editable */}
                  <EditableCell value={r.productWk1} originalValue={(staffData[r.name]?.productWk1) || 0} onChange={(v) => setOverride(r.name, "productWk1", v)} color="var(--text-secondary)" />
                  {/* F: Booth Rent Rebate (wk 1) — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.rebateWk1)}</td>
                  {/* G: Product Sales (wk 2) — editable */}
                  <EditableCell value={r.productWk2} originalValue={(staffData[r.name]?.productWk2) || 0} onChange={(v) => setOverride(r.name, "productWk2", v)} color="var(--text-secondary)" />
                  {/* H: Booth Rent Rebate (wk 2) — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.rebateWk2)}</td>
                  {/* I: Booth Rent Rebate Total — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-secondary)" }}>{fmt(r.rebateTotal)}</td>
                  {/* J: Tips — editable */}
                  <EditableCell value={r.tips} originalValue={(staffData[r.name]?.tips) || 0} onChange={(v) => setOverride(r.name, "tips", v)} color="var(--text-secondary)" />
                  {/* K: Contractor Service — editable */}
                  <EditableCell value={r.contractorService} originalValue={(staffData[r.name]?.contractorService) || 0} onChange={(v) => setOverride(r.name, "contractorService", v)} color="var(--gold)" />
                  {/* L: Associate Pay — editable */}
                  <EditableCell value={r.associatePay} originalValue={(staffData[r.name]?.associatePay) || 0} onChange={(v) => setOverride(r.name, "associatePay", v)} color="var(--gold)" />
                  {/* M: Total Earned — formula */}
                  <td className={`${dc} text-right font-medium`} style={{ color: "var(--text-primary)" }}>{fmt(r.totalEarned)}</td>
                  {/* N: Station Lease — editable */}
                  <EditableCell value={r.stationLease} originalValue={r.cfg.stationLease} onChange={(v) => setOverride(r.name, "stationLease", v)} color={r.stationLease ? "#f87171" : "var(--text-muted)"} />
                  {/* O: Financial Services — editable */}
                  <EditableCell value={r.financialServices} originalValue={r.cfg.financialServices} onChange={(v) => setOverride(r.name, "financialServices", v)} color={r.financialServices ? "#f87171" : "var(--text-muted)"} />
                  {/* P: Color Charges — editable */}
                  <EditableCell value={r.colorCharges} originalValue={staffData[r.name]?.colorCharges ? -staffData[r.name].colorCharges : 0} onChange={(v) => setOverride(r.name, "colorCharges", v)} color={r.colorCharges ? "#f87171" : "var(--text-muted)"} />
                  {/* Q: Credit Card Amount — editable */}
                  <EditableCell value={r.creditCardAmount} originalValue={(staffData[r.name]?.creditCardAmount) || 0} onChange={(v) => setOverride(r.name, "creditCardAmount", v)} color="var(--text-secondary)" />
                  {/* R: CC Charges 3% — formula */}
                  <td className={`${dc} text-right`} style={{ color: "var(--text-muted)" }}>{fmt(r.ccCharges)}</td>
                  {/* S: New Guests — editable */}
                  <EditableCell value={r.newGuests} originalValue={(staffData[r.name]?.newGuests) || 0} onChange={(v) => setOverride(r.name, "newGuests", v)} color="var(--text-secondary)" />
                  {/* T: Finders Fee 20% — formula */}
                  <td className={`${dc} text-right`} style={{ color: r.findersFee ? "#f87171" : "var(--text-muted)" }}>{fmt(r.findersFee)}</td>
                  {/* U: Employee Purchases — editable */}
                  <EditableCell value={r.employeePurchases} originalValue={(staffData[r.name]?.employeePurchases) || 0} onChange={(v) => setOverride(r.name, "employeePurchases", v)} color={r.empPurch ? "#f87171" : "var(--text-muted)"} />
                  {/* V: Phorest — editable */}
                  <EditableCell value={r.phorestFee} originalValue={r.cfg.phorestFee} onChange={(v) => setOverride(r.name, "phorestFee", v)} color={r.phorestFee ? "#f87171" : "var(--text-muted)"} />
                  {/* W: Refreshment — editable */}
                  <EditableCell value={r.refreshment} originalValue={r.cfg.refreshment} onChange={(v) => setOverride(r.name, "refreshment", v)} color={r.refreshment ? "#f87171" : "var(--text-muted)"} />
                  {/* X: Associate Fee — formula */}
                  <td className={`${dc} text-right`} style={{ color: r.assocFee ? "#f87171" : "var(--text-muted)" }}>{fmt(r.assocFee)}</td>
                  {/* Y: Misc Fees — editable */}
                  <EditableCell value={r.miscFees} originalValue={0} onChange={(v) => setOverride(r.name, "miscFees", v)} color={r.miscFees ? "#f87171" : "var(--text-muted)"} />
                  {/* Z: Total Check — formula */}
                  <td className={`${dc} text-right font-medium`} style={{ color: r.totalCheck > 0 ? "#4ade80" : r.totalCheck < 0 ? "#f87171" : "var(--text-muted)" }}>{fmt(r.totalCheck)}</td>
                  {/* AA: Account */}
                  <td className={dc} style={{ color: "var(--text-muted)" }}>{data.account}</td>
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

      {/* Legend */}
      <div
        className="mt-4 p-3 rounded-lg text-xs font-sans"
        style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}
      >
        <span>
          Click any data cell to edit. <strong style={{ color: "var(--gold)" }}>Gold-highlighted cells</strong> have been modified from computed values.
          Hover to see the original value. Formula columns (rebates, totals, CC charges, finders fee) recalculate automatically.
        </span>
      </div>
    </div>
  );
}

function PastRuns({ branchId, branches }: { branchId: string; branches: BranchConfig[] }) {
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const slug = branchSlug(branchId, branches);
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
  }, [branchId, branches]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const filtered = filterDate
    ? runs.filter((r) => r.runDate.startsWith(filterDate))
    : runs;

  // Sort by name desc works because filenames start with ISO timestamp (run-YYYY-MM-DD...)
  const downloadRun = (run: ParsedRun) => {
    const slug = branchSlug(branchId, branches);
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
