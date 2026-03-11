"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { useEmployees, useTimeEntries, useJobs, useCompanies } from "@/lib/timeClockHooks";
import type { TCTimeEntry } from "@/types/timeclock";

type Screen = "input" | "confirm" | "select-job" | "action";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Get Mon 00:00 and Sun 23:59 for the week containing `date` */
function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

/** Build per-day hours for the current Mon–Sun week */
function getWeeklySummary(
  entries: TCTimeEntry[],
  employeeId: string,
): { day: string; date: string; hours: number }[] {
  const { weekStart, weekEnd } = getWeekBounds(new Date());

  const empEntries = entries.filter((e) => {
    if (e.employee_id !== employeeId) return false;
    const clockIn = new Date(e.clock_in);
    return clockIn >= weekStart && clockIn <= weekEnd;
  });

  // Accumulate hours per day-of-week (0=Mon … 6=Sun)
  const hoursPerDay = new Array(7).fill(0);
  for (const entry of empEntries) {
    const start = new Date(entry.clock_in);
    const end = entry.clock_out ? new Date(entry.clock_out) : new Date();
    const hrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const jsDay = start.getDay(); // 0=Sun
    const idx = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon
    hoursPerDay[idx] += hrs;
  }

  return DAY_NAMES.map((day, idx) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + idx);
    return {
      day,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      hours: hoursPerDay[idx],
    };
  });
}

export default function TimeClock() {
  const { theme, toggleTheme } = useTheme();
  const { employees, loading: empLoading, findByNumber } = useEmployees();
  const { entries, loading: entLoading, getOpenEntry, clockIn, clockOut, refetch: refetchEntries } = useTimeEntries();
  const { activeJobs, loading: jobsLoading } = useJobs();
  const { companies } = useCompanies();

  const [screen, setScreen] = useState<Screen>("input");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [matchedEmployee, setMatchedEmployee] = useState<ReturnType<typeof findByNumber>>(undefined);
  const [openEntry, setOpenEntry] = useState<ReturnType<typeof getOpenEntry>>(undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
  const [isSwitching, setIsSwitching] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [now, setNow] = useState(new Date());

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset to input after 30s of inactivity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (screen !== "input") {
      inactivityTimer.current = setTimeout(() => {
        setScreen("input");
        setEmployeeNumber("");
        setMatchedEmployee(undefined);
        setOpenEntry(undefined);
        setSelectedJobId(undefined);
        setIsSwitching(false);
        setMessage(null);
      }, 30000);
    }
  }, [screen]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  const handleKeyPress = (digit: string) => {
    resetInactivityTimer();
    if (digit === "clear") {
      setEmployeeNumber("");
      return;
    }
    if (digit === "back") {
      setEmployeeNumber((prev) => prev.slice(0, -1));
      return;
    }
    if (employeeNumber.length < 4) {
      setEmployeeNumber((prev) => prev + digit);
    }
  };

  const handleSubmitNumber = () => {
    const emp = findByNumber(employeeNumber);
    if (!emp) {
      setMessage({ text: "Resource number not found", type: "error" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setMatchedEmployee(emp);
    setScreen("confirm");
    resetInactivityTimer();
  };

  const handleConfirmYes = () => {
    if (!matchedEmployee) return;
    const entry = getOpenEntry(matchedEmployee.id);
    setOpenEntry(entry);
    // If clocking out (has open entry), go straight to action
    // If clocking in, go to job selection first
    if (entry) {
      setScreen("action");
    } else {
      setScreen("select-job");
    }
    resetInactivityTimer();
  };

  const handleConfirmNo = () => {
    setScreen("input");
    setEmployeeNumber("");
    setMatchedEmployee(undefined);
    setSelectedJobId(undefined);
    setIsSwitching(false);
  };

  const handleSelectJob = async (jobId: string) => {
    if (isSwitching && openEntry && matchedEmployee) {
      // Switch job: clock out current, clock in new
      try {
        await clockOut(openEntry.id);
        await clockIn(matchedEmployee.id, jobId);
        const oldJobName = activeJobs.find((j) => j.id === openEntry.job_id)?.name;
        const newJobName = activeJobs.find((j) => j.id === jobId)?.name;
        setMessage({
          text: `Switched${oldJobName ? ` from ${oldJobName}` : ""}${newJobName ? ` to ${newJobName}` : ""}! Keep it up, ${matchedEmployee.first_name}.`,
          type: "success",
        });
        await refetchEntries();
        setTimeout(() => {
          setScreen("input");
          setEmployeeNumber("");
          setMatchedEmployee(undefined);
          setOpenEntry(undefined);
          setSelectedJobId(undefined);
          setIsSwitching(false);
          setMessage(null);
        }, 4000);
      } catch {
        setMessage({ text: "Failed to switch jobs. Try again.", type: "error" });
      }
      return;
    }
    setSelectedJobId(jobId);
    setScreen("action");
    resetInactivityTimer();
  };

  const handleClockIn = async () => {
    if (!matchedEmployee) return;
    try {
      await clockIn(matchedEmployee.id, selectedJobId);
      const jobName = activeJobs.find((j) => j.id === selectedJobId)?.name;
      setMessage({
        text: `Clocked in${jobName ? ` for ${jobName}` : ""}! Have a great shift, ${matchedEmployee.first_name}.`,
        type: "success",
      });
      setTimeout(() => {
        setScreen("input");
        setEmployeeNumber("");
        setMatchedEmployee(undefined);
        setOpenEntry(undefined);
        setSelectedJobId(undefined);
        setIsSwitching(false);
        setMessage(null);
      }, 4000);
    } catch {
      setMessage({ text: "Failed to clock in. Try again.", type: "error" });
    }
  };

  const handleClockOut = async () => {
    if (!openEntry) return;
    try {
      await clockOut(openEntry.id);
      const hrs = (Date.now() - new Date(openEntry.clock_in).getTime()) / (1000 * 60 * 60);
      setMessage({
        text: `Clocked out! Total: ${hrs.toFixed(1)} hours. See you next time, ${matchedEmployee?.first_name}!`,
        type: "success",
      });
      setTimeout(() => {
        setScreen("input");
        setEmployeeNumber("");
        setMatchedEmployee(undefined);
        setOpenEntry(undefined);
        setSelectedJobId(undefined);
        setIsSwitching(false);
        setMessage(null);
      }, 4000);
    } catch {
      setMessage({ text: "Failed to clock out. Try again.", type: "error" });
    }
  };

  const formatElapsed = (clockInIso: string): string => {
    const ms = Date.now() - new Date(clockInIso).getTime();
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  };

  // Weekly summary for the matched employee
  const weeklySummary = useMemo(() => {
    if (!matchedEmployee) return null;
    return getWeeklySummary(entries, matchedEmployee.id);
  }, [entries, matchedEmployee]);

  const weeklyTotal = useMemo(() => {
    if (!weeklySummary) return 0;
    return weeklySummary.reduce((sum, d) => sum + d.hours, 0);
  }, [weeklySummary]);

  const loading = empLoading || entLoading || jobsLoading;
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setLoadingTimedOut(true), 12000);
      return () => clearTimeout(timer);
    }
    setLoadingTimedOut(false);
  }, [loading]);

  const handleRetry = () => {
    setLoadingTimedOut(false);
    window.location.reload();
  };

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
            href="/"
            className="border px-2.5 py-1.5 rounded-md text-xs font-sans transition-all no-underline"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            ← Home
          </Link>
          <div>
            <h1 className="text-[22px] font-light tracking-[3px] uppercase m-0" style={{ color: "var(--gold)" }}>
              R Alexander Time Clock
            </h1>
            <p className="text-[11px] font-sans tracking-[2px] uppercase mt-0.5" style={{ color: "var(--text-muted)" }}>
              Contractor Clock In / Out
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/time-clock/admin"
            className="text-[10px] font-sans tracking-[1px] uppercase no-underline px-3 py-1.5 border rounded-md transition-all"
            style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
          >
            Admin
          </Link>
          <button
            onClick={toggleTheme}
            className="px-3 py-1.5 text-lg rounded border transition-all"
            style={{ borderColor: "var(--border-color)" }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Live Clock */}
          <div className="text-center mb-8">
            <div className="text-6xl font-light font-sans tabular-nums" style={{ color: "var(--text-primary)" }}>
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-sm font-sans mt-2" style={{ color: "var(--text-muted)" }}>
              {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>

          {/* Loading timeout warning */}
          {loading && loadingTimedOut && (
            <div
              className="mb-6 p-5 rounded-lg text-center font-sans"
              style={{
                background: "rgba(239,83,80,0.1)",
                border: "1px solid rgba(239,83,80,0.3)",
              }}
            >
              <p className="text-sm font-medium mb-2" style={{ color: "#ef5350" }}>
                Unable to connect to the server
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                This may be a network issue or your browser may not be supported. Try refreshing or using a newer device.
              </p>
              <button
                onClick={handleRetry}
                className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all border"
                style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Connecting indicator */}
          {loading && !loadingTimedOut && (
            <div className="mb-4 text-center">
              <p className="text-xs font-sans tracking-[1px] uppercase" style={{ color: "var(--text-muted)" }}>
                Connecting...
              </p>
            </div>
          )}

          {/* Message Banner */}
          {message && (
            <div
              className="mb-6 p-4 rounded-lg text-center text-sm font-sans font-medium"
              style={{
                background: message.type === "success" ? "rgba(102,187,106,0.15)" : "rgba(239,83,80,0.15)",
                border: `1px solid ${message.type === "success" ? "rgba(102,187,106,0.3)" : "rgba(239,83,80,0.3)"}`,
                color: message.type === "success" ? "#66bb6a" : "#ef5350",
              }}
            >
              {message.text}
            </div>
          )}

          {/* INPUT SCREEN */}
          {screen === "input" && (
            <div>
              <p className="text-center text-[11px] font-sans uppercase tracking-[2px] mb-4" style={{ color: "var(--text-muted)" }}>
                Enter your resource number
              </p>

              {/* Display */}
              <div
                className="text-center text-4xl font-sans font-light tracking-[12px] py-5 mb-6 rounded-lg border"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  color: employeeNumber ? "var(--text-primary)" : "var(--text-muted)",
                  minHeight: "72px",
                }}
              >
                {employeeNumber || "----"}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="py-5 rounded-xl text-2xl font-sans font-medium transition-all active:scale-95 border"
                    style={{
                      background: key === "clear" || key === "back" ? "var(--bg-secondary)" : "var(--card-bg)",
                      borderColor: "var(--border-light)",
                      color: key === "clear" ? "#ef5350" : key === "back" ? "var(--text-muted)" : "var(--text-primary)",
                      fontSize: key === "clear" || key === "back" ? "14px" : undefined,
                      textTransform: key === "clear" || key === "back" ? "uppercase" : undefined,
                      letterSpacing: key === "clear" || key === "back" ? "1px" : undefined,
                    }}
                  >
                    {key === "back" ? "←" : key === "clear" ? "CLR" : key}
                  </button>
                ))}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitNumber}
                disabled={employeeNumber.length < 4 || loading}
                className="w-full py-4 rounded-xl text-lg font-sans font-semibold uppercase tracking-[2px] transition-all disabled:opacity-30"
                style={{
                  background: "rgba(212,175,55,0.2)",
                  border: "2px solid var(--gold)",
                  color: "var(--gold)",
                }}
              >
                {loading ? "Connecting..." : "Enter"}
              </button>
            </div>
          )}

          {/* CONFIRM SCREEN */}
          {screen === "confirm" && matchedEmployee && (
            <div className="text-center">
              <div
                className="p-8 rounded-xl border mb-6"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}
              >
                <p className="text-[11px] font-sans uppercase tracking-[2px] mb-3" style={{ color: "var(--text-muted)" }}>
                  Is this you?
                </p>
                <p className="text-3xl font-light mb-2" style={{ color: "var(--text-primary)" }}>
                  {matchedEmployee.first_name} {matchedEmployee.last_name}
                </p>
                <p className="text-sm font-sans" style={{ color: "var(--text-muted)" }}>
                  {(() => { const c = companies.find(c => c.id === matchedEmployee.company_id); return c ? c.name + " — " : ""; })()}Resource #{matchedEmployee.employee_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleConfirmNo}
                  className="py-5 rounded-xl text-lg font-sans font-semibold uppercase tracking-[2px] transition-all border-2"
                  style={{
                    background: "rgba(239,83,80,0.1)",
                    borderColor: "#ef5350",
                    color: "#ef5350",
                  }}
                >
                  No
                </button>
                <button
                  onClick={handleConfirmYes}
                  className="py-5 rounded-xl text-lg font-sans font-semibold uppercase tracking-[2px] transition-all border-2"
                  style={{
                    background: "rgba(102,187,106,0.1)",
                    borderColor: "#66bb6a",
                    color: "#66bb6a",
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          )}

          {/* SELECT JOB SCREEN */}
          {screen === "select-job" && matchedEmployee && (
            <div className="text-center">
              <p className="text-lg font-sans mb-1" style={{ color: "var(--text-primary)" }}>
                {matchedEmployee.first_name} {matchedEmployee.last_name}
              </p>
              <p className="text-[11px] font-sans uppercase tracking-[2px] mb-6" style={{ color: "var(--text-muted)" }}>
                {isSwitching ? "Switch to which job?" : "Select your job"}
              </p>

              <div className="space-y-3">
                {(() => {
                  const companyJobs = activeJobs.filter(j => !isSwitching || j.id !== openEntry?.job_id);
                  return (
                    <>
                      {companyJobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => handleSelectJob(job.id)}
                          className="w-full py-5 rounded-xl text-xl font-sans font-medium transition-all active:scale-95 border-2"
                          style={{
                            background: "rgba(212,175,55,0.08)",
                            borderColor: "var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {job.name}
                        </button>
                      ))}
                      {companyJobs.length === 0 && (
                        <div className="py-6" style={{ color: "var(--text-muted)" }}>
                          <p className="text-sm font-sans mb-4">No jobs configured.</p>
                          <button
                            onClick={() => {
                              setScreen("action");
                              resetInactivityTimer();
                            }}
                            className="px-6 py-3 rounded-xl text-sm font-sans font-medium transition-all border"
                            style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
                          >
                            Continue without job
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <button
                onClick={handleConfirmNo}
                className="mt-6 text-sm font-sans px-6 py-2 rounded-lg border transition-all"
                style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ACTION SCREEN */}
          {screen === "action" && matchedEmployee && (
            <div className="text-center">
              <p className="text-lg font-sans mb-2" style={{ color: "var(--text-primary)" }}>
                {matchedEmployee.first_name} {matchedEmployee.last_name}
              </p>

              {openEntry ? (
                <>
                  <div
                    className="p-6 rounded-xl border mb-6"
                    style={{ background: "rgba(102,187,106,0.05)", borderColor: "rgba(102,187,106,0.2)" }}
                  >
                    <p className="text-sm font-sans mb-1" style={{ color: "var(--text-muted)" }}>
                      Clocked in since
                    </p>
                    <p className="text-2xl font-sans font-light" style={{ color: "#66bb6a" }}>
                      {new Date(openEntry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-sm font-sans mt-1" style={{ color: "var(--text-muted)" }}>
                      ({formatElapsed(openEntry.clock_in)})
                    </p>
                    {openEntry.job_id && (
                      <p className="text-sm font-sans mt-2 font-medium" style={{ color: "var(--gold)" }}>
                        {activeJobs.find((j) => j.id === openEntry.job_id)?.name || "Unknown Job"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleClockOut}
                      className="w-full py-6 rounded-xl text-2xl font-sans font-bold uppercase tracking-[3px] transition-all active:scale-95 border-2"
                      style={{
                        background: "rgba(239,83,80,0.15)",
                        borderColor: "#ef5350",
                        color: "#ef5350",
                      }}
                    >
                      Clock Out
                    </button>

                    {activeJobs.length > 1 && (
                      <button
                        onClick={() => {
                          setIsSwitching(true);
                          setScreen("select-job");
                          resetInactivityTimer();
                        }}
                        className="w-full py-5 rounded-xl text-lg font-sans font-semibold uppercase tracking-[2px] transition-all active:scale-95 border-2"
                        style={{
                          background: "rgba(212,175,55,0.12)",
                          borderColor: "var(--gold)",
                          color: "var(--gold)",
                        }}
                      >
                        Switch Job
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Weekly Hours Summary */}
                  {weeklySummary && (
                    <div
                      className="rounded-xl border mb-5 mt-2 overflow-hidden"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div
                        className="px-4 py-2"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        <p
                          className="text-[10px] font-sans uppercase tracking-[2px] font-medium"
                          style={{ color: "var(--text-muted)" }}
                        >
                          This Week
                        </p>
                      </div>
                      {weeklySummary.map(({ day, date, hours }) => (
                        <div
                          key={day}
                          className="flex items-center justify-between px-4 py-1.5"
                          style={{ borderBottom: "1px solid var(--border-light)" }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-sans"
                              style={{ color: hours > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
                            >
                              {day}
                            </span>
                            <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                              {date}
                            </span>
                          </div>
                          <span
                            className="text-xs font-mono"
                            style={{ color: hours > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
                          >
                            {hours > 0 ? `${hours.toFixed(1)}h` : "\u2014"}
                          </span>
                        </div>
                      ))}
                      <div
                        className="flex items-center justify-between px-4 py-2"
                        style={{ background: "rgba(212,175,55,0.06)" }}
                      >
                        <span
                          className="text-xs font-sans font-medium uppercase tracking-[1px]"
                          style={{ color: "var(--gold)" }}
                        >
                          Total
                        </span>
                        <span
                          className="text-sm font-mono font-medium"
                          style={{ color: "var(--gold)" }}
                        >
                          {weeklyTotal.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleClockIn}
                    className="w-full py-6 rounded-xl text-2xl font-sans font-bold uppercase tracking-[3px] transition-all active:scale-95 border-2"
                    style={{
                      background: "rgba(102,187,106,0.15)",
                      borderColor: "#66bb6a",
                      color: "#66bb6a",
                    }}
                  >
                    Clock In
                  </button>
                </>
              )}

              <button
                onClick={handleConfirmNo}
                className="mt-6 text-sm font-sans px-6 py-2 rounded-lg border transition-all"
                style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
