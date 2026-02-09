"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { useEmployees, useTimeEntries } from "@/lib/timeClockHooks";

type Screen = "input" | "confirm" | "action";

export default function TimeClock() {
  const { theme, toggleTheme } = useTheme();
  const { employees, loading: empLoading, findByNumber } = useEmployees();
  const { entries, loading: entLoading, getOpenEntry, clockIn, clockOut, refetch: refetchEntries } = useTimeEntries();

  const [screen, setScreen] = useState<Screen>("input");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [matchedEmployee, setMatchedEmployee] = useState<ReturnType<typeof findByNumber>>(undefined);
  const [openEntry, setOpenEntry] = useState<ReturnType<typeof getOpenEntry>>(undefined);
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
      setMessage({ text: "Employee not found", type: "error" });
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
    setScreen("action");
    resetInactivityTimer();
  };

  const handleConfirmNo = () => {
    setScreen("input");
    setEmployeeNumber("");
    setMatchedEmployee(undefined);
  };

  const handleClockIn = async () => {
    if (!matchedEmployee) return;
    try {
      await clockIn(matchedEmployee.id);
      setMessage({ text: `Clocked in! Have a great shift, ${matchedEmployee.first_name}.`, type: "success" });
      setTimeout(() => {
        setScreen("input");
        setEmployeeNumber("");
        setMatchedEmployee(undefined);
        setOpenEntry(undefined);
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

  const loading = empLoading || entLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-xl font-sans" style={{ color: "var(--gold)" }}>Loading time clock...</div>
      </div>
    );
  }

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
              Employee Clock In / Out
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
                Enter your employee number
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
                disabled={employeeNumber.length < 4}
                className="w-full py-4 rounded-xl text-lg font-sans font-semibold uppercase tracking-[2px] transition-all disabled:opacity-30"
                style={{
                  background: "rgba(212,175,55,0.2)",
                  border: "2px solid var(--gold)",
                  color: "var(--gold)",
                }}
              >
                Enter
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
                  Employee #{matchedEmployee.employee_number}
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
                  </div>

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
                </>
              ) : (
                <button
                  onClick={handleClockIn}
                  className="w-full py-6 rounded-xl text-2xl font-sans font-bold uppercase tracking-[3px] transition-all active:scale-95 border-2 mt-4"
                  style={{
                    background: "rgba(102,187,106,0.15)",
                    borderColor: "#66bb6a",
                    color: "#66bb6a",
                  }}
                >
                  Clock In
                </button>
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
