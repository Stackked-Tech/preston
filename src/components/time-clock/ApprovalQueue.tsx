"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { TCEmployee, TCTimeEntry, TCJob, TCCompany } from "@/types/timeclock";

interface Props {
  entries: TCTimeEntry[];
  employees: TCEmployee[];
  companies: TCCompany[];
  jobs: TCJob[];
  onApprove: (entryId: string, approvedBy: string) => Promise<void>;
  onFlag: (entryId: string, flagNote: string) => Promise<void>;
  onBulkApprove: (entryIds: string[], approvedBy: string) => Promise<void>;
  onUpdateEntry: (entryId: string, updates: { job_id?: string | null; clock_in?: string; clock_out?: string }) => Promise<void>;
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

/** Convert ISO datetime to HH:MM for time input */
function toTimeValue(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Apply a HH:MM time value to an existing ISO datetime, preserving the date */
function applyTime(existingIso: string, timeStr: string): string {
  const d = new Date(existingIso);
  const [h, m] = timeStr.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

type EditingCell = { entryId: string; field: "job" | "clockIn" | "clockOut" | "hours" | "billable" } | null;

/* ─── Inline Editable Cell Wrapper ─── */
function EditableCell({
  isEditing,
  onClick,
  children,
  editContent,
}: {
  isEditing: boolean;
  onClick: () => void;
  children: React.ReactNode;
  editContent: React.ReactNode;
}) {
  if (isEditing) return <>{editContent}</>;
  return (
    <span
      onClick={onClick}
      className="cursor-pointer hover:underline decoration-dotted underline-offset-2"
      style={{ textDecorationColor: "var(--text-muted)" }}
      title="Click to edit"
    >
      {children}
    </span>
  );
}

export default function ApprovalQueue({
  entries,
  employees,
  companies,
  jobs,
  onApprove,
  onFlag,
  onBulkApprove,
  onUpdateEntry,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(getYesterdayDate);
  const [approverName] = useState("Brian");
  const [flagModalEntryId, setFlagModalEntryId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Auto-focus when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

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

  /* ─── Inline Edit Handlers ─── */

  const startEdit = (entryId: string, field: EditingCell extends null ? never : NonNullable<EditingCell>["field"], currentValue: string) => {
    setEditing({ entryId, field });
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const saveEdit = async (entry: TCTimeEntry) => {
    if (!editing) return;
    const { field } = editing;

    try {
      if (field === "job") {
        const newJobId = editValue === "" ? null : editValue;
        if (newJobId !== entry.job_id) {
          await onUpdateEntry(entry.id, { job_id: newJobId });
        }
      } else if (field === "clockIn") {
        const newClockIn = applyTime(entry.clock_in, editValue);
        if (newClockIn !== entry.clock_in) {
          await onUpdateEntry(entry.id, { clock_in: newClockIn });
        }
      } else if (field === "clockOut") {
        if (entry.clock_out) {
          const newClockOut = applyTime(entry.clock_out, editValue);
          if (newClockOut !== entry.clock_out) {
            await onUpdateEntry(entry.id, { clock_out: newClockOut });
          }
        }
      } else if (field === "hours") {
        // Adjust clock_out based on entered hours
        const newHours = parseFloat(editValue);
        if (!isNaN(newHours) && newHours > 0) {
          const start = new Date(entry.clock_in).getTime();
          const newClockOut = new Date(start + newHours * 60 * 60 * 1000).toISOString();
          await onUpdateEntry(entry.id, { clock_out: newClockOut });
        }
      } else if (field === "billable") {
        // Reverse-compute hours from billable amount, then adjust clock_out
        const emp = employeeMap.get(entry.employee_id);
        const rate = emp?.billable_rate || 0;
        if (rate > 0) {
          const newBillable = parseFloat(editValue);
          if (!isNaN(newBillable) && newBillable >= 0) {
            const newHours = newBillable / rate;
            const start = new Date(entry.clock_in).getTime();
            const newClockOut = new Date(start + newHours * 60 * 60 * 1000).toISOString();
            await onUpdateEntry(entry.id, { clock_out: newClockOut });
          }
        }
      }
    } catch (err) {
      console.error("Failed to update entry:", err);
    }
    cancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent, entry: TCTimeEntry) => {
    if (e.key === "Enter") saveEdit(entry);
    if (e.key === "Escape") cancelEdit();
  };

  /* ─── Shared input style ─── */
  const inlineInputStyle: React.CSSProperties = {
    background: "var(--input-bg)",
    borderColor: "var(--gold)",
    color: "var(--text-primary)",
    boxShadow: "0 0 0 1px var(--gold)",
  };

  /* ─── Render an entry row (used for both pending and flagged) ─── */
  const renderEntryRow = (entry: TCTimeEntry, showActions: boolean) => {
    const emp = employeeMap.get(entry.employee_id);
    const job = entry.job_id ? jobMap.get(entry.job_id) : null;
    const hours = getHours(entry.clock_in, entry.clock_out);
    const billable = hours * (emp?.billable_rate || 0);
    const isLoading = loadingIds.has(entry.id);
    const isEditing = (field: string) => editing?.entryId === entry.id && editing?.field === field;

    return (
      <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
        {/* Resource # — read-only */}
        <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>
          {emp?.employee_number || "\u2014"}
        </td>

        {/* Name — read-only */}
        <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
          {emp ? `${emp.first_name} ${emp.last_name}` : "Unknown"}
        </td>

        {/* Job — dropdown */}
        <td className="py-3 px-3 text-xs" style={{ color: job ? "var(--text-secondary)" : "var(--text-muted)" }}>
          <EditableCell
            isEditing={isEditing("job")}
            onClick={() => startEdit(entry.id, "job", entry.job_id || "")}
            editContent={
              <select
                ref={(el) => { inputRef.current = el; }}
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  // Auto-save on select
                  const newJobId = e.target.value === "" ? null : e.target.value;
                  if (newJobId !== entry.job_id) {
                    onUpdateEntry(entry.id, { job_id: newJobId }).catch(console.error);
                  }
                  cancelEdit();
                }}
                onBlur={() => cancelEdit()}
                className="px-1.5 py-0.5 border rounded text-xs font-sans outline-none w-full max-w-[120px]"
                style={inlineInputStyle}
              >
                <option value="">\u2014 None</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            }
          >
            {job?.name || "\u2014"}
          </EditableCell>
        </td>

        {/* Clock In — time input */}
        <td className="py-3 px-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <EditableCell
            isEditing={isEditing("clockIn")}
            onClick={() => startEdit(entry.id, "clockIn", toTimeValue(entry.clock_in))}
            editContent={
              <input
                ref={(el) => { inputRef.current = el; }}
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveEdit(entry)}
                onKeyDown={(e) => handleKeyDown(e, entry)}
                className="px-1.5 py-0.5 border rounded text-xs font-sans outline-none w-[100px]"
                style={inlineInputStyle}
              />
            }
          >
            {new Date(entry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </EditableCell>
        </td>

        {/* Clock Out — time input */}
        <td className="py-3 px-3 text-xs">
          {entry.clock_out ? (
            <EditableCell
              isEditing={isEditing("clockOut")}
              onClick={() => startEdit(entry.id, "clockOut", toTimeValue(entry.clock_out!))}
              editContent={
                <input
                  ref={(el) => { inputRef.current = el; }}
                  type="time"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveEdit(entry)}
                  onKeyDown={(e) => handleKeyDown(e, entry)}
                  className="px-1.5 py-0.5 border rounded text-xs font-sans outline-none w-[100px]"
                  style={inlineInputStyle}
                />
              }
            >
              <span style={{ color: "var(--text-secondary)" }}>
                {new Date(entry.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </EditableCell>
          ) : (
            <span style={{ color: "#66bb6a" }}>Active</span>
          )}
        </td>

        {/* Hours — editable number (adjusts clock_out) */}
        <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
          <EditableCell
            isEditing={isEditing("hours")}
            onClick={() => startEdit(entry.id, "hours", hours.toFixed(2))}
            editContent={
              <input
                ref={(el) => { inputRef.current = el; }}
                type="number"
                step="0.25"
                min="0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveEdit(entry)}
                onKeyDown={(e) => handleKeyDown(e, entry)}
                className="px-1.5 py-0.5 border rounded text-xs font-mono outline-none w-[70px]"
                style={inlineInputStyle}
              />
            }
          >
            {hours.toFixed(2)}h
          </EditableCell>
        </td>

        {/* Billable — editable number (reverse-computes hours from rate) */}
        <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>
          <EditableCell
            isEditing={isEditing("billable")}
            onClick={() => startEdit(entry.id, "billable", billable.toFixed(2))}
            editContent={
              <div className="flex items-center">
                <span className="text-xs mr-0.5" style={{ color: "var(--gold)" }}>$</span>
                <input
                  ref={(el) => { inputRef.current = el; }}
                  type="number"
                  step="0.01"
                  min="0"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveEdit(entry)}
                  onKeyDown={(e) => handleKeyDown(e, entry)}
                  className="px-1.5 py-0.5 border rounded text-xs font-mono outline-none w-[70px]"
                  style={inlineInputStyle}
                />
              </div>
            }
          >
            ${billable.toFixed(2)}
          </EditableCell>
        </td>

        {/* Actions */}
        {showActions ? (
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
        ) : (
          <td className="py-3 px-3 text-xs" style={{ color: "#ffb74d" }}>
            {entry.flag_note || "\u2014"}
          </td>
        )}
      </tr>
    );
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
                {groupEntries.map((entry) => renderEntryRow(entry, true))}
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
                {["Resource #", "Name", "Job", "Clock In", "Clock Out", "Hours", "Billable", "Flag Note"].map(
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
              {flaggedEntries.map((entry) => renderEntryRow(entry, false))}
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
