"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useTasks } from "@/lib/hospitalityHooks";
import type { HMTaskStatus } from "@/types/hospitality";
import TaskList from "./TaskList";
import TaskDetail from "./TaskDetail";
import TaskMap from "./TaskMap";
import RouteOptimizer from "./RouteOptimizer";

interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "manager" | "staff";
}

type TabMode = "all" | "mine" | "map";

export default function TaskBoard() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [mustReset, setMustReset] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tabMode, setTabMode] = useState<TabMode>("all");

  // Map state
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const [routeStopOrder, setRouteStopOrder] = useState<string[]>([]);

  // Filter state
  const [statusFilters, setStatusFilters] = useState<HMTaskStatus[]>([
    "new",
    "acknowledged",
    "in_progress",
    "on_hold",
  ]);
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");

  // Tasks hook — filter by assigned user when in "mine" tab
  const { tasks, loading, refetch } = useTasks(
    tabMode === "mine" && currentUser
      ? { assignedTo: currentUser.id }
      : undefined
  );

  // Filter tasks client-side by status, property, priority
  const filteredTasks = tasks.filter((t) => {
    if (statusFilters.length > 0 && !statusFilters.includes(t.status))
      return false;
    if (propertyFilter && t.property_id !== propertyFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  // Unique properties from tasks for the filter dropdown
  const taskProperties = Array.from(
    new Map(
      tasks
        .filter((t) => t.property)
        .map((t) => [t.property!.id, t.property!.name])
    )
  );

  const handleLogin = useCallback(async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await fetch("/api/hospitality/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Invalid credentials");
        return;
      }
      if (data.mustResetPassword) {
        setMustReset(true);
        setResetUserId(data.user.id);
      } else {
        setCurrentUser(data.user as AuthUser);
      }
    } catch {
      setLoginError("Network error. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }, [loginEmail, loginPassword]);

  const handlePasswordReset = useCallback(async () => {
    if (!newPassword.trim() || !resetUserId) return;
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }
    try {
      setResetLoading(true);
      setResetError(null);
      const res = await fetch("/api/hospitality/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUserId, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "Failed to reset password");
        return;
      }
      // Re-login with new password
      setMustReset(false);
      setLoginPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      // Auto-login
      const loginRes = await fetch("/api/hospitality/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: newPassword,
        }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && !loginData.mustResetPassword) {
        setCurrentUser(loginData.user as AuthUser);
      }
    } catch {
      setResetError("Network error. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }, [newPassword, confirmPassword, resetUserId, loginEmail]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setViewMode("list");
    setSelectedTaskId(null);
    setLoginPassword("");
    setLoginEmail("");
  }, []);

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setViewMode("detail");
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedTaskId(null);
    refetch();
  }, [refetch]);

  // Login gate
  if (!currentUser) {
    if (mustReset) {
      return (
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ background: "var(--bg-primary)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-8 border"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-light)",
            }}
          >
            <h1
              className="text-xl font-bold text-center mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Set New Password
            </h1>
            <p
              className="text-sm text-center mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              You must set a new password before continuing.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Confirm new password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePasswordReset();
                  }}
                />
              </div>

              {resetError && (
                <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                  {resetError}
                </p>
              )}

              <button
                onClick={handlePasswordReset}
                disabled={
                  resetLoading || !newPassword.trim() || !confirmPassword.trim()
                }
                className="w-full min-h-[48px] rounded-xl text-sm font-semibold transition-opacity"
                style={{
                  background: "var(--gold)",
                  color: "#000",
                  opacity:
                    resetLoading ||
                    !newPassword.trim() ||
                    !confirmPassword.trim()
                      ? 0.5
                      : 1,
                }}
              >
                {resetLoading ? "Updating..." : "Set Password"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 border"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="text-center mb-6">
            <div
              className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: "rgba(212, 175, 55, 0.1)" }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              WHB Maintenance
            </h1>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Sign in to view your tasks
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-light)",
                  color: "var(--text-primary)",
                }}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-light)",
                  color: "var(--text-primary)",
                }}
                placeholder="Enter password"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>

            {loginError && (
              <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                {loginError}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={
                loginLoading ||
                !loginEmail.trim() ||
                !loginPassword.trim()
              }
              className="w-full min-h-[48px] rounded-xl text-sm font-semibold transition-opacity"
              style={{
                background: "var(--gold)",
                color: "#000",
                opacity:
                  loginLoading ||
                  !loginEmail.trim() ||
                  !loginPassword.trim()
                    ? 0.5
                    : 1,
              }}
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-xs no-underline"
              style={{ color: "var(--text-muted)" }}
            >
              &larr; Back to Command Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated view
  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center gap-3">
          {viewMode === "detail" && (
            <button
              onClick={handleBackToList}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
              style={{ color: "var(--gold)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div>
            <h1
              className="text-base font-bold m-0"
              style={{ color: "var(--text-primary)" }}
            >
              WHB Maintenance
            </h1>
            <p
              className="text-[10px] m-0"
              style={{ color: "var(--text-muted)" }}
            >
              {currentUser.name}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="min-h-[44px] px-3 rounded-lg text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Sign Out
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden pb-[60px] flex flex-col">
        {viewMode === "list" && tabMode !== "map" ? (
          <TaskList
            tasks={filteredTasks}
            onSelectTask={handleSelectTask}
            loading={loading}
            statusFilters={statusFilters}
            onStatusFiltersChange={setStatusFilters}
            propertyFilter={propertyFilter}
            onPropertyFilterChange={setPropertyFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            properties={taskProperties}
          />
        ) : viewMode === "list" && tabMode === "map" ? (
          <>
            <TaskMap
              tasks={filteredTasks}
              onSelectTask={handleSelectTask}
              routeGeometry={routeGeometry}
              routeStopOrder={routeStopOrder}
            />
            <RouteOptimizer
              tasks={filteredTasks}
              onOptimizedRoute={setRouteStopOrder}
              onRouteGeometry={setRouteGeometry}
            />
          </>
        ) : selectedTaskId ? (
          <TaskDetail
            taskId={selectedTaskId}
            currentUser={{ id: currentUser.id, name: currentUser.name }}
            onBack={handleBackToList}
          />
        ) : null}
      </div>

      {/* Bottom Nav — only show in list mode */}
      {viewMode === "list" && (
        <nav
          className="fixed bottom-0 left-0 right-0 flex border-t"
          style={{
            height: 60,
            background: "var(--bg-secondary)",
            borderColor: "var(--border-light)",
          }}
        >
          <button
            onClick={() => setTabMode("all")}
            className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px]"
            style={{
              color: tabMode === "all" ? "var(--gold)" : "var(--text-muted)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className="text-[10px] font-medium">All Tasks</span>
          </button>
          <button
            onClick={() => setTabMode("mine")}
            className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px]"
            style={{
              color: tabMode === "mine" ? "var(--gold)" : "var(--text-muted)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[10px] font-medium">My Tasks</span>
          </button>
          <button
            onClick={() => { setTabMode("map"); setRouteGeometry(null); setRouteStopOrder([]); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px]"
            style={{
              color: tabMode === "map" ? "var(--gold)" : "var(--text-muted)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-[10px] font-medium">Map</span>
          </button>
        </nav>
      )}
    </div>
  );
}
