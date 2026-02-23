"use client";

import { useState, useMemo } from "react";
import type { TCEmployee, TCTimeEntry, TCJob, TCCompany } from "@/types/timeclock";

interface Props {
  entries: TCTimeEntry[];
  employees: TCEmployee[];
  companies: TCCompany[];
  jobs: TCJob[];
  onApprove: (entryId: string, approvedBy: string) => Promise<void>;
  onFlag: (entryId: string, flagNote: string) => Promise<void>;
  onBulkApprove: (entryIds: string[], approvedBy: string) => Promise<void>;
}

function getHours(clockIn: string, clockOut: string | null): number {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  return (end - start) / (1000 * 60 * 60);
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function ApprovalQueue({
  entries,
  employees,
  companies,
  jobs,
  onApprove,
  onFlag,
  onBulkApprove,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(getYesterdayDate);
  const [approverName] = useState("Brian");
  const [flagModalEntryId, setFlagModalEntryId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Build lookup maps
  const employeeMap = useMemo(() => {
    const map = new Map<string, TCEmployee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const companyMap = useMemo(() => {
    const map = new Map<string, TCCompany>();
    companies.forEach((c) => map.set(c.id, c));
    return map;
  }, [companies]);

  const jobMap = useMemo(() => {
    const map = new Map<string, TCJob>();
    jobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [jobs]);

  // Filter entries for selected date
  const dateEntries = useMemo(() => {
    return entries.filter((e) => {
      const entryDate = new Date(e.clock_in).toISOString().slice(0, 10);
      return entryDate === selectedDate;
    });
  }, [entries, selectedDate]);

  const pendingEntries = useMemo(
    () => dateEntries.filter((e) => e.approval_status === "pending"),
    [dateEntries]
  );

  const flaggedEntries = useMemo(
    () => dateEntries.filter((e) => e.approval_status === "flagged"),
    [dateEntries]
  );

  // Group pending by company
  const pendingByCompany = useMemo(() => {
    const groups = new Map<string, { company: TCCompany | null; entries: TCTimeEntry[] }>();
    pendingEntries.forEach((entry) => {
      const emp = employeeMap.get(entry.employee_id);
      const companyId = emp?.company_id || "unknown";
      const company = companyId !== "unknown" ? companyMap.get(companyId) || null : null;
      if (!groups.has(companyId)) {
        groups.set(companyId, { company, entries: [] });
      }
      groups.get(companyId)!.entries.push(entry);
    });
    return Array.from(groups.values());
  }, [pendingEntries, employeeMap, companyMap]);

  const handleApprove = async (entryId: string) => {
    setLoadingIds((prev) => new Set(prev).add(entryId));
    try {
      await onApprove(entryId, approverName);
    } catch (err) {
      console.error("Failed to approve entry:", err);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  const handleFlag = async () => {
    if (!flagModalEntryId || !flagReason.trim()) return;
    setLoadingIds((prev) => new Set(prev).add(flagModalEntryId));
    try {
      await onFlag(flagModalEntryId, flagReason.trim());
      setFlagModalEntryId(null);
      setFlagReason("");
    } catch (err) {
      console.error("Failed to flag entry:", err);
    } finally {
      if (flagModalEntryId) {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(flagModalEntryId);
          return next;
        });
      }
    }
  };

  const handleBulkApprove = async (entryIds: string[]) => {
    const bulkKey = entryIds.join(",");
    setLoadingIds((prev) => new Set(prev).add(bulkKey));
    try {
      await onBulkApprove(entryIds, approverName);
    } catch (err) {
      console.error("Failed to bulk approve:", err);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(bulkKey);
        return next;
      });
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded text-sm font-sans outline-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] uppercase tracking-[1px] px-2.5 py-1 rounded font-sans font-medium"
              style={{
                color: "#42a5f5",
                background: "rgba(66,165,245,0.1)",
                border: "1px solid rgba(66,165,245,0.2)",
              }}
            >
              {pendingEntries.length} Pending
            </span>
            {flaggedEntries.length > 0 && (
              <span
                className="text-[10px] uppercase tracking-[1px] px-2.5 py-1 rounded font-sans font-medium"
                style={{
                  color: "#ffb74d",
                  background: "rgba(255,183,77,0.1)",
                  border: "1px solid rgba(255,183,77,0.2)",
                }}
              >
                {flaggedEntries.length} Flagged
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending entries grouped by company */}
      {pendingByCompany.length > 0 ? (
        pendingByCompany.map(({ company, entries: groupEntries }) => (
          <div key={company?.id || "unknown"} className="mb-6">
            {/* Company group header */}
            <div
              className="flex items-center justify-between px-4 py-2.5 rounded-t-lg border border-b-0"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-color)",
              }}
            >
              <h3
                className="text-xs font-sans font-medium uppercase tracking-[1.5px]"
                style={{ color: "var(--text-primary)" }}
              >
                {company?.name || "Unknown Company"}
              </h3>
              <button
                onClick={() =>
                  handleBulkApprove(groupEntries.map((e) => e.id))
                }
                className="text-[10px] font-sans font-medium uppercase tracking-[1px] px-3 py-1 rounded border transition-all"
                style={{
                  borderColor: "rgba(102,187,106,0.3)",
                  background: "rgba(102,187,106,0.1)",
                  color: "#66bb6a",
                }}
              >
                Approve All ({groupEntries.length})
              </button>
            </div>

            {/* Entry table */}
            <table
              className="w-full text-sm font-sans border border-t-0 rounded-b-lg overflow-hidden"
              style={{
                borderCollapse: "collapse",
                borderColor: "var(--border-color)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Resource #", "Name", "Job", "Clock In", "Clock Out", "Hours", "Billable", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {groupEntries.map((entry) => {
                  const emp = employeeMap.get(entry.employee_id);
                  const job = entry.job_id ? jobMap.get(entry.job_id) : null;
                  const hours = getHours(entry.clock_in, entry.clock_out);
                  const billable = hours * (emp?.billable_rate || 0);
                  const isLoading = loadingIds.has(entry.id);

                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                    >
                      <td
                        className="py-3 px-3 font-mono text-xs"
                        style={{ color: "var(--gold)" }}
                      >
                        {emp?.employee_number || "—"}
                      </td>
                      <td
                        className="py-3 px-3"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {emp
                          ? `${emp.first_name} ${emp.last_name}`
                          : "Unknown"}
                      </td>
                      <td
                        className="py-3 px-3 text-xs"
                        style={{
                          color: job
                            ? "var(--text-secondary)"
                            : "var(--text-muted)",
                        }}
                      >
                        {job?.name || "\u2014"}
                      </td>
                      <td
                        className="py-3 px-3 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {new Date(entry.clock_in).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {entry.clock_out ? (
                          <span style={{ color: "var(--text-secondary)" }}>
                            {new Date(entry.clock_out).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span style={{ color: "#66bb6a" }}>Active</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-3 font-mono text-xs"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {hours.toFixed(2)}h
                      </td>
                      <td
                        className="py-3 px-3 font-mono text-xs"
                        style={{ color: "var(--gold)" }}
                      >
                        ${billable.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(entry.id)}
                            disabled={isLoading}
                            className="text-[10px] font-sans font-medium uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all disabled:opacity-40"
                            style={{
                              borderColor: "rgba(102,187,106,0.3)",
                              background: "rgba(102,187,106,0.1)",
                              color: "#66bb6a",
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setFlagModalEntryId(entry.id);
                              setFlagReason("");
                            }}
                            disabled={isLoading}
                            className="text-[10px] font-sans font-medium uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all disabled:opacity-40"
                            style={{
                              borderColor: "rgba(255,183,77,0.3)",
                              background: "rgba(255,183,77,0.1)",
                              color: "#ffb74d",
                            }}
                          >
                            Flag
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div
          className="py-12 text-center text-sm font-sans"
          style={{ color: "var(--text-muted)" }}
        >
          No pending entries for this date.
        </div>
      )}

      {/* Flagged Entries Section */}
      {flaggedEntries.length > 0 && (
        <div className="mt-8">
          <h3
            className="text-[10px] font-sans uppercase tracking-[2px] mb-3 font-medium"
            style={{ color: "#ffb74d" }}
          >
            Flagged Entries
          </h3>
          <table
            className="w-full text-sm font-sans border rounded-lg overflow-hidden"
            style={{ borderCollapse: "collapse", borderColor: "var(--border-color)" }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                {["Resource #", "Name", "Job", "Clock In", "Clock Out", "Hours", "Flag Note"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {flaggedEntries.map((entry) => {
                const emp = employeeMap.get(entry.employee_id);
                const job = entry.job_id ? jobMap.get(entry.job_id) : null;
                const hours = getHours(entry.clock_in, entry.clock_out);

                return (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid var(--border-light)" }}
                  >
                    <td
                      className="py-3 px-3 font-mono text-xs"
                      style={{ color: "var(--gold)" }}
                    >
                      {emp?.employee_number || "—"}
                    </td>
                    <td
                      className="py-3 px-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {emp
                        ? `${emp.first_name} ${emp.last_name}`
                        : "Unknown"}
                    </td>
                    <td
                      className="py-3 px-3 text-xs"
                      style={{
                        color: job
                          ? "var(--text-secondary)"
                          : "var(--text-muted)",
                      }}
                    >
                      {job?.name || "\u2014"}
                    </td>
                    <td
                      className="py-3 px-3 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {new Date(entry.clock_in).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {entry.clock_out ? (
                        <span style={{ color: "var(--text-secondary)" }}>
                          {new Date(entry.clock_out).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span style={{ color: "#66bb6a" }}>Active</span>
                      )}
                    </td>
                    <td
                      className="py-3 px-3 font-mono text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {hours.toFixed(2)}h
                    </td>
                    <td
                      className="py-3 px-3 text-xs"
                      style={{ color: "#ffb74d" }}
                    >
                      {entry.flag_note || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Flag Modal */}
      {flagModalEntryId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="border rounded-xl p-6 w-full max-w-sm mx-4"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-color)",
            }}
          >
            <h2
              className="text-lg font-light mb-4"
              style={{ color: "#ffb74d" }}
            >
              Flag Entry
            </h2>
            <p
              className="text-xs font-sans mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Provide a reason for flagging this time entry.
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Reason for flagging..."
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm font-sans outline-none mb-4 resize-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleFlag}
                disabled={!flagReason.trim()}
                className="flex-1 px-4 py-2 text-sm font-sans font-medium rounded-lg border transition-all disabled:opacity-40"
                style={{
                  borderColor: "rgba(255,183,77,0.3)",
                  background: "rgba(255,183,77,0.15)",
                  color: "#ffb74d",
                }}
              >
                Flag
              </button>
              <button
                onClick={() => {
                  setFlagModalEntryId(null);
                  setFlagReason("");
                }}
                className="px-4 py-2 text-sm font-sans font-medium rounded-lg border transition-all"
                style={{
                  borderColor: "var(--border-light)",
                  color: "var(--text-muted)",
                }}
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
