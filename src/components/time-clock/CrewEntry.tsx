"use client";

import { useState, useMemo } from "react";
import type { TCEmployee, TCJob, TCCompany } from "@/types/timeclock";

interface Props {
  employees: TCEmployee[];
  companies: TCCompany[];
  jobs: TCJob[];
  getJobsByCompany: (companyId: string) => TCJob[];
  onBatchClockIn: (
    employeeIds: string[],
    jobId: string,
    clockIn: string,
    clockOut: string
  ) => Promise<void>;
}

export default function CrewEntry({
  employees,
  companies,
  jobs,
  getJobsByCompany,
  onBatchClockIn,
}: Props) {
  const [companyId, setCompanyId] = useState("");
  const [jobId, setJobId] = useState("");
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [clockInTime, setClockInTime] = useState("07:00");
  const [clockOutTime, setClockOutTime] = useState("17:00");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Active companies for the dropdown
  const activeCompanies = useMemo(
    () => companies.filter((c) => c.is_active),
    [companies]
  );

  // Jobs filtered by selected company
  const companyJobs = useMemo(() => {
    if (!companyId) return [];
    return getJobsByCompany(companyId);
  }, [companyId, getJobsByCompany]);

  // Active employees for selected company
  const companyEmployees = useMemo(() => {
    if (!companyId) return [];
    return employees.filter(
      (e) => e.is_active && e.company_id === companyId
    );
  }, [employees, companyId]);

  const handleCompanyChange = (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    setJobId("");
    setSelectedIds(new Set());
  };

  const toggleEmployee = (empId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === companyEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companyEmployees.map((e) => e.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || !jobId) return;

    const clockIn = new Date(`${entryDate}T${clockInTime}:00`).toISOString();
    const clockOut = new Date(`${entryDate}T${clockOutTime}:00`).toISOString();

    setSubmitting(true);
    setMessage(null);

    try {
      await onBatchClockIn(Array.from(selectedIds), jobId, clockIn, clockOut);
      setMessage({
        type: "success",
        text: `Successfully submitted ${selectedIds.size} entries.`,
      });
      setSelectedIds(new Set());
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error("Failed to submit batch entries:", err);
      setMessage({
        type: "error",
        text: "Failed to submit entries. Please try again.",
      });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedIds.size > 0 && jobId && !submitting;

  return (
    <div className="max-w-3xl">
      {/* Message banner */}
      {message && (
        <div
          className="mb-4 px-4 py-3 rounded-lg border text-sm font-sans"
          style={{
            borderColor:
              message.type === "success"
                ? "rgba(102,187,106,0.3)"
                : "rgba(239,83,80,0.3)",
            background:
              message.type === "success"
                ? "rgba(102,187,106,0.1)"
                : "rgba(239,83,80,0.1)",
            color: message.type === "success" ? "#66bb6a" : "#ef5350",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Setup card */}
      <div
        className="p-5 rounded-lg border mb-6"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--border-color)",
        }}
      >
        <h3
          className="text-[10px] font-sans uppercase tracking-[2px] mb-4 font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Batch Entry Setup
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Company */}
          <div>
            <label
              className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block"
              style={{ color: "var(--text-muted)" }}
            >
              Company
            </label>
            <select
              value={companyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Select Company</option>
              {activeCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Job */}
          <div>
            <label
              className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block"
              style={{ color: "var(--text-muted)" }}
            >
              Job
            </label>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              disabled={!companyId}
              className="w-full px-3 py-2 border rounded text-sm font-sans outline-none disabled:opacity-40"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Select Job</option>
              {companyJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label
              className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block"
              style={{ color: "var(--text-muted)" }}
            >
              Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Times */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Clock In
              </label>
              <input
                type="time"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-light)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="flex-1">
              <label
                className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Clock Out
              </label>
              <input
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-light)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contractor list */}
      {companyId && (
        <div
          className="p-5 rounded-lg border mb-6"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[10px] font-sans uppercase tracking-[2px] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Select Crew Members ({selectedIds.size}/{companyEmployees.length})
            </h3>
            <button
              onClick={handleSelectAll}
              className="text-[10px] font-sans font-medium uppercase tracking-[1px] px-3 py-1 rounded border transition-all"
              style={{
                borderColor: "var(--border-light)",
                color: "var(--text-muted)",
              }}
            >
              {selectedIds.size === companyEmployees.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          {companyEmployees.length > 0 ? (
            <div className="space-y-2">
              {companyEmployees.map((emp) => {
                const isSelected = selectedIds.has(emp.id);
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all"
                    style={{
                      borderColor: isSelected
                        ? "var(--gold)"
                        : "var(--border-light)",
                      background: isSelected
                        ? "rgba(212,175,55,0.08)"
                        : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEmployee(emp.id)}
                      className="accent-[#d4af37] w-4 h-4"
                    />
                    <span
                      className="font-mono text-xs"
                      style={{ color: "var(--gold)" }}
                    >
                      {emp.employee_number}
                    </span>
                    <span
                      className="text-sm font-sans"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {emp.first_name} {emp.last_name}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p
              className="text-sm font-sans py-4 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              No active contractors for this company.
            </p>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full px-6 py-3 text-sm font-sans font-medium rounded-lg border transition-all disabled:opacity-40"
        style={{
          borderColor: "var(--gold)",
          background: "rgba(212,175,55,0.15)",
          color: "var(--gold)",
        }}
      >
        {submitting
          ? "Submitting..."
          : `Submit ${selectedIds.size} Entr${selectedIds.size === 1 ? "y" : "ies"}`}
      </button>
    </div>
  );
}
