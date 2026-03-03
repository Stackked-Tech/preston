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
import { exportDailyCSV, exportWeeklyCSV, exportMonthlyCSV } from "@/lib/timeClockExport";
import ApprovalQueue from "@/components/time-clock/ApprovalQueue";
import CrewEntry from "@/components/time-clock/CrewEntry";

type Tab = "contractors" | "companies" | "jobs" | "approval" | "daily" | "weekly" | "monthly" | "crew" | "settings";

export default function TimeClockAdmin() {
  const { theme, toggleTheme } = useTheme();
  const { companies, activeCompanies, loading: compLoading, addCompany, toggleActive: toggleCompanyActive } = useCompanies();
  const { employees, loading: empLoading, addEmployee, toggleActive, updateEmployee } = useEmployees();
  const { entries, loading: entLoading, updateEntry, refetch: refetchEntries, approveEntry, flagEntry, bulkApprove, batchClockIn } = useTimeEntries();
  const { location, loading: settLoading, updateLocation } = useTimeClockSettings();
  const { jobs, loading: jobsLoading, addJob, updateJob, toggleActive: toggleJobActive, getJobsByCompany } = useJobs();
  const reports = useTimeClockReports(employees, entries, jobs);

  const [activeTab, setActiveTab] = useState<Tab>("approval");

  // Company form
  const [companyName, setCompanyName] = useState("");

  // Contractor form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contractorCompanyId, setContractorCompanyId] = useState("");
  const [contractorRate, setContractorRate] = useState("");

  // Job form
  const [jobName, setJobName] = useState("");
  const [jobCompanyId, setJobCompanyId] = useState("");

  // Daily log
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Weekly nav
  const [weekDate, setWeekDate] = useState(() => new Date());

  // Monthly nav
  const [monthYear, setMonthYear] = useState(() => new Date().getFullYear());
  const [monthMonth, setMonthMonth] = useState(() => new Date().getMonth());

  // Settings
  const [settLocationName, setSettLocationName] = useState(location.name);
  const [settLat, setSettLat] = useState(location.lat !== null ? String(location.lat) : "");
  const [settLng, setSettLng] = useState(location.lng !== null ? String(location.lng) : "");
  const [settRadius, setSettRadius] = useState(location.radius_meters !== null ? String(location.radius_meters) : "");

  // Edit clock-out modal
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editClockOut, setEditClockOut] = useState("");

  // Company filter for reports
  const [filterCompanyId, setFilterCompanyId] = useState<string | "all">("all");

  const loading = compLoading || empLoading || entLoading || settLoading || jobsLoading;

  const handleAddCompany = async () => {
    if (!companyName.trim()) return;
    try {
      await addCompany(companyName.trim());
      setCompanyName("");
    } catch (err) {
      console.error("Failed to add company:", err);
    }
  };

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

  const handleAddJob = async () => {
    if (!jobName.trim() || !jobCompanyId) return;
    try {
      await addJob(jobName.trim(), jobCompanyId);
      setJobName("");
    } catch (err) {
      console.error("Failed to add job:", err);
    }
  };

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

  const handleSaveClockOut = async () => {
    if (!editingEntry || !editClockOut) return;
    try {
      await updateEntry(editingEntry, { clock_out: new Date(editClockOut).toISOString() });
      setEditingEntry(null);
      setEditClockOut("");
    } catch (err) {
      console.error("Failed to update entry:", err);
    }
  };

  const weekRange = reports.getWeekRange(weekDate);
  const weekLabel = `${weekRange.start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${weekRange.end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;

  const navigateWeek = (dir: number) => {
    const d = new Date(weekDate);
    d.setDate(d.getDate() + dir * 7);
    setWeekDate(d);
  };

  const navigateMonth = (dir: number) => {
    let m = monthMonth + dir;
    let y = monthYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setMonthMonth(m);
    setMonthYear(y);
  };

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const monthName = new Date(monthYear, monthMonth).toLocaleString("default", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-xl font-sans" style={{ color: "var(--gold)" }}>Loading admin panel...</div>
      </div>
    );
  }

  const dailyEntries = reports.getDailyEntries(new Date(dailyDate + "T00:00:00"));
  const weeklySummary = reports.getWeeklySummary(weekDate);
  const monthlySummary = reports.getMonthlySummary(monthYear, monthMonth);

  // Filtered report data
  const filteredDailyEntries = filterCompanyId === "all"
    ? dailyEntries
    : dailyEntries.filter(({ employee }) => employee.company_id === filterCompanyId);

  const filteredWeeklySummary = filterCompanyId === "all"
    ? weeklySummary
    : weeklySummary.filter(({ employee }) => employee.company_id === filterCompanyId);

  const filteredMonthlySummary = filterCompanyId === "all"
    ? monthlySummary
    : monthlySummary.filter(({ employee }) => employee.company_id === filterCompanyId);

  // Count weeks for monthly columns
  const monthWeekCount = filteredMonthlySummary.length > 0 ? filteredMonthlySummary[0].weeklyHours.length : 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/time-clock"
            className="border px-2.5 py-1.5 rounded-md text-xs font-sans transition-all no-underline"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            ← Time Clock
          </Link>
          <div>
            <h1 className="text-[22px] font-light tracking-[3px] uppercase m-0" style={{ color: "var(--gold)" }}>
              R Alexander Admin
            </h1>
            <p className="text-[11px] font-sans tracking-[2px] uppercase mt-0.5" style={{ color: "var(--text-muted)" }}>
              Time Clock Management
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 text-lg rounded border transition-all"
          style={{ borderColor: "var(--border-color)" }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--border-light)" }}>
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
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-xs font-sans font-medium transition-all -mb-px whitespace-nowrap"
            style={{
              color: activeTab === tab.key ? "var(--gold)" : "var(--text-muted)",
              borderBottom: activeTab === tab.key ? "2px solid var(--gold)" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">

        {/* ─── APPROVAL QUEUE TAB ─── */}
        {activeTab === "approval" && (
          <ApprovalQueue
            entries={entries}
            employees={employees}
            companies={companies}
            jobs={jobs}
            onApprove={approveEntry}
            onFlag={flagEntry}
            onBulkApprove={bulkApprove}
          />
        )}

        {/* ─── COMPANIES TAB ─── */}
        {activeTab === "companies" && (
          <div className="max-w-2xl">
            {/* Add form */}
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
                  className="px-5 py-2 text-sm font-sans font-medium rounded border transition-all disabled:opacity-30"
                  style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Companies list */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr style={{ background: "var(--bg-tertiary)" }}>
                    {["Company Name", "Contractors", "Jobs", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[10px] uppercase tracking-[1px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                        No companies yet. Add one above.
                      </td>
                    </tr>
                  )}
                  {companies.map((company) => {
                    const compEmployees = employees.filter((e) => e.company_id === company.id);
                    const compJobs = jobs.filter((j) => j.company_id === company.id);
                    return (
                      <tr
                        key={company.id}
                        className="border-t"
                        style={{ borderColor: "var(--border-light)" }}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                          {company.name}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                          {compEmployees.length}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                          {compJobs.length}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-sans uppercase tracking-[1px] px-2 py-0.5 rounded"
                            style={{
                              background: company.is_active ? "rgba(102,187,106,0.15)" : "rgba(239,83,80,0.15)",
                              color: company.is_active ? "#66bb6a" : "#ef5350",
                            }}
                          >
                            {company.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleCompanyActive(company.id, !company.is_active)}
                            className="text-xs font-sans px-3 py-1 rounded border transition-all"
                            style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                          >
                            {company.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── CONTRACTORS TAB ─── */}
        {activeTab === "contractors" && (
          <div className="max-w-4xl">
            {/* Add form */}
            <div className="p-4 rounded-lg border mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
              <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-3 font-medium" style={{ color: "var(--text-muted)" }}>
                Add Contractor
              </h3>
              <div className="flex gap-3 flex-wrap">
                <select
                  value={contractorCompanyId}
                  onChange={(e) => setContractorCompanyId(e.target.value)}
                  className="px-3 py-2 border rounded text-sm font-sans outline-none"
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
                  placeholder="Billable Rate"
                  value={contractorRate}
                  onChange={(e) => setContractorRate(e.target.value)}
                  className="w-[120px] px-3 py-2 border rounded text-sm font-sans outline-none"
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

            {/* Contractor table */}
            <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Resource #", "Name", "Company", "Rate", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold)" }}>
                      {emp.employee_number}
                    </td>
                    <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={emp.company_id || ""}
                        onChange={(e) => updateEmployee(emp.id, { company_id: e.target.value || undefined })}
                        className="px-2 py-1 border rounded text-xs font-sans outline-none"
                        style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                      >
                        <option value="">No Company</option>
                        {activeCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={emp.billable_rate}
                        onChange={(e) => updateEmployee(emp.id, { billable_rate: parseFloat(e.target.value) || 0 })}
                        className="w-[90px] px-2 py-1 border rounded text-xs font-mono outline-none"
                        style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                      />
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
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                      No contractors added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── JOBS TAB ─── */}
        {activeTab === "jobs" && (
          <div className="max-w-4xl">
            {/* Add form */}
            <div className="p-4 rounded-lg border mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
              <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-3 font-medium" style={{ color: "var(--text-muted)" }}>
                Add Job
              </h3>
              <div className="flex gap-3">
                <select
                  value={jobCompanyId}
                  onChange={(e) => setJobCompanyId(e.target.value)}
                  className="px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                >
                  <option value="">Select Company</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Job Name"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddJob()}
                  className="flex-1 px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={handleAddJob}
                  disabled={!jobName.trim() || !jobCompanyId}
                  className="px-5 py-2 text-xs font-sans font-medium rounded border transition-all disabled:opacity-40"
                  style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Jobs table */}
            <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Name", "Company", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
                      {job.name}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={job.company_id || ""}
                        onChange={(e) => updateJob(job.id, { company_id: e.target.value || undefined })}
                        className="px-2 py-1 border rounded text-xs font-sans outline-none"
                        style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                      >
                        <option value="">No Company</option>
                        {activeCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className="text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded"
                        style={{
                          color: job.is_active ? "#66bb6a" : "#78909c",
                          background: job.is_active ? "rgba(102,187,106,0.1)" : "rgba(120,144,156,0.1)",
                          border: `1px solid ${job.is_active ? "rgba(102,187,106,0.2)" : "rgba(120,144,156,0.2)"}`,
                        }}
                      >
                        {job.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => toggleJobActive(job.id, !job.is_active)}
                        className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                        style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                      >
                        {job.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                      No jobs added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── DAILY LOG TAB ─── */}
        {activeTab === "daily" && (
          <div className="max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                />
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                >
                  <option value="all">All Companies</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => exportDailyCSV(filteredDailyEntries, new Date(dailyDate))}
                className="px-4 py-1.5 text-[10px] font-sans font-medium rounded border transition-all uppercase tracking-[1px]"
                style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
              >
                Export CSV
              </button>
            </div>

            <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Contractor", "Company", "Job", "Clock In", "Clock Out", "Hours", "Status", "Approval", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDailyEntries.map(({ employee, entry, hours, isStale, jobName: entryJobName }) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
                      <span className="font-mono text-xs mr-2" style={{ color: "var(--gold)" }}>{employee.employee_number}</span>
                      {employee.first_name} {employee.last_name}
                    </td>
                    <td className="py-3 px-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {companies.find((c) => c.id === employee.company_id)?.name || "-"}
                    </td>
                    <td className="py-3 px-3 text-xs" style={{ color: entryJobName ? "var(--text-secondary)" : "var(--text-muted)" }}>
                      {entryJobName || "-"}
                    </td>
                    <td className="py-3 px-3" style={{ color: "var(--text-secondary)" }}>
                      {new Date(entry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 px-3" style={{ color: "var(--text-secondary)" }}>
                      {entry.clock_out
                        ? new Date(entry.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : <span style={{ color: "#66bb6a" }}>Active</span>
                      }
                    </td>
                    <td className="py-3 px-3 font-mono" style={{ color: "var(--text-primary)" }}>
                      {hours.toFixed(2)}h
                    </td>
                    <td className="py-3 px-3">
                      {isStale && (
                        <span className="text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded"
                          style={{ color: "#ef5350", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.2)" }}>
                          Stale (&gt;12h)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className="text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded"
                        style={{
                          color: entry.approval_status === "approved" ? "#66bb6a"
                            : entry.approval_status === "flagged" ? "#ffb74d"
                            : "#42a5f5",
                          background: entry.approval_status === "approved" ? "rgba(102,187,106,0.1)"
                            : entry.approval_status === "flagged" ? "rgba(255,183,77,0.1)"
                            : "rgba(66,165,245,0.1)",
                          border: `1px solid ${
                            entry.approval_status === "approved" ? "rgba(102,187,106,0.2)"
                              : entry.approval_status === "flagged" ? "rgba(255,183,77,0.2)"
                              : "rgba(66,165,245,0.2)"
                          }`,
                        }}
                      >
                        {entry.approval_status === "approved" ? "Approved"
                          : entry.approval_status === "flagged" ? "Flagged"
                          : "Pending"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {(!entry.clock_out || isStale) && (
                        <button
                          onClick={() => {
                            setEditingEntry(entry.id);
                            setEditClockOut(entry.clock_out || new Date().toISOString().slice(0, 16));
                          }}
                          className="text-[10px] font-sans uppercase tracking-[1px] px-2.5 py-1 rounded border transition-all"
                          style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                        >
                          Set Clock Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredDailyEntries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                      No entries for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── WEEKLY TAB ─── */}
        {activeTab === "weekly" && (
          <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateWeek(-1)}
                  className="px-3 py-1.5 border rounded text-sm font-sans transition-all"
                  style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                >
                  ← Prev
                </button>
                <span className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>
                  {weekLabel}
                </span>
                <button
                  onClick={() => navigateWeek(1)}
                  className="px-3 py-1.5 border rounded text-sm font-sans transition-all"
                  style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                >
                  Next →
                </button>
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                >
                  <option value="all">All Companies</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => exportWeeklyCSV(filteredWeeklySummary, weekRange.start)}
                className="px-4 py-1.5 text-[10px] font-sans font-medium rounded border transition-all uppercase tracking-[1px]"
                style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
                      Contractor
                    </th>
                    {dayNames.map((d) => (
                      <th key={d} className="text-center text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-2 min-w-[60px]" style={{ color: "var(--text-muted)" }}>
                        {d}
                      </th>
                    ))}
                    <th className="text-right text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeeklySummary.map(({ employee, dailyHours, weeklyTotal }) => (
                    <tr key={employee.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
                        {employee.first_name} {employee.last_name}
                      </td>
                      {dailyHours.map((h, i) => (
                        <td
                          key={i}
                          className="py-3 px-2 text-center font-mono text-xs"
                          style={{
                            color: h > 0 ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {h > 0 ? h.toFixed(1) : "-"}
                        </td>
                      ))}
                      <td
                        className="py-3 px-3 text-right font-mono text-xs font-semibold"
                        style={{ color: "var(--gold)" }}
                      >
                        {weeklyTotal.toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                  {filteredWeeklySummary.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                        No active contractors.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── MONTHLY TAB ─── */}
        {activeTab === "monthly" && (
          <div className="max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="px-3 py-1.5 border rounded text-sm font-sans transition-all"
                  style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                >
                  ← Prev
                </button>
                <span className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>
                  {monthName}
                </span>
                <button
                  onClick={() => navigateMonth(1)}
                  className="px-3 py-1.5 border rounded text-sm font-sans transition-all"
                  style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                >
                  Next →
                </button>
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                >
                  <option value="all">All Companies</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => exportMonthlyCSV(filteredMonthlySummary, monthYear, monthMonth)}
                className="px-4 py-1.5 text-[10px] font-sans font-medium rounded border transition-all uppercase tracking-[1px]"
                style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th className="text-left text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
                      Contractor
                    </th>
                    {Array.from({ length: monthWeekCount }, (_, i) => (
                      <th key={i} className="text-center text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-2 min-w-[60px]" style={{ color: "var(--text-muted)" }}>
                        Wk {i + 1}
                      </th>
                    ))}
                    <th className="text-right text-[10px] uppercase tracking-[1.5px] font-medium py-2 px-3" style={{ color: "var(--text-muted)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlySummary.map(({ employee, weeklyHours, monthlyTotal }) => (
                    <tr key={employee.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td className="py-3 px-3" style={{ color: "var(--text-primary)" }}>
                        {employee.first_name} {employee.last_name}
                      </td>
                      {weeklyHours.map((h, i) => (
                        <td
                          key={i}
                          className="py-3 px-2 text-center font-mono text-xs"
                          style={{ color: h > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
                        >
                          {h > 0 ? h.toFixed(1) : "-"}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right font-mono text-xs font-semibold" style={{ color: "var(--gold)" }}>
                        {monthlyTotal.toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                  {filteredMonthlySummary.length === 0 && (
                    <tr>
                      <td colSpan={monthWeekCount + 2} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                        No active contractors.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── CREW ENTRY TAB ─── */}
        {activeTab === "crew" && (
          <CrewEntry
            employees={employees}
            companies={companies}
            jobs={jobs}
            getJobsByCompany={getJobsByCompany}
            onBatchClockIn={batchClockIn}
          />
        )}

        {/* ─── SETTINGS TAB ─── */}
        {activeTab === "settings" && (
          <div className="max-w-lg">
            <div className="p-5 rounded-lg border mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
              <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-4 font-medium" style={{ color: "var(--text-muted)" }}>
                Location (for future GPS)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Location Name
                  </label>
                  <input
                    type="text"
                    value={settLocationName}
                    onChange={(e) => setSettLocationName(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block" style={{ color: "var(--text-muted)" }}>
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={settLat}
                      onChange={(e) => setSettLat(e.target.value)}
                      placeholder="e.g. 33.4484"
                      className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block" style={{ color: "var(--text-muted)" }}>
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={settLng}
                      onChange={(e) => setSettLng(e.target.value)}
                      placeholder="e.g. -112.0740"
                      className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Radius (meters)
                  </label>
                  <input
                    type="text"
                    value={settRadius}
                    onChange={(e) => setSettRadius(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              className="px-6 py-2.5 text-sm font-sans font-medium rounded-lg border transition-all"
              style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
            >
              Save Settings
            </button>
          </div>
        )}
      </div>

      {/* Edit Clock Out Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="border rounded-xl p-6 w-full max-w-sm mx-4"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
          >
            <h2 className="text-lg font-light mb-4" style={{ color: "var(--gold)" }}>
              Set Clock Out Time
            </h2>
            <input
              type="datetime-local"
              value={editClockOut}
              onChange={(e) => setEditClockOut(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-sans outline-none mb-4"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleSaveClockOut}
                className="flex-1 px-4 py-2 text-sm font-sans font-medium rounded-lg border transition-all"
                style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
              >
                Save
              </button>
              <button
                onClick={() => { setEditingEntry(null); setEditClockOut(""); }}
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
