"use client";

import { useMemo } from "react";
import { useTasks, useRequests, useProperties, useHMUsers } from "@/lib/hospitalityHooks";
import type { HMTaskStatus } from "@/types/hospitality";

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<HMTaskStatus, string> = {
  new: "#60a5fa",
  acknowledged: "#a78bfa",
  in_progress: "#d4af37",
  on_hold: "#fb923c",
  completed: "#4ade80",
};

const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: "#fb923c",
  approved: "#4ade80",
  rejected: "#f87171",
};

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC CARD
// ═══════════════════════════════════════════════════════════════════════════════

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
    >
      <p className="text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-serif font-semibold" style={{ color: "var(--gold)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs font-sans mt-1" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BAR CHART (CSS only)
// ═══════════════════════════════════════════════════════════════════════════════

function BarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="text-xs font-sans w-28 text-right truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {item.label}
          </span>
          <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "var(--input-bg)" }}>
            <div
              className="h-full rounded-md transition-all duration-500 flex items-center px-2"
              style={{
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                background: item.color,
                minWidth: item.value > 0 ? "24px" : "0",
              }}
            >
              <span className="text-xs font-sans font-medium" style={{ color: "#0a0b0e" }}>
                {item.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function StatsDashboard() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { requests, loading: requestsLoading } = useRequests();
  const { properties, loading: propsLoading } = useProperties();
  const { users: allUsers, loading: usersLoading } = useHMUsers();

  const loading = tasksLoading || requestsLoading || propsLoading || usersLoading;

  // ─── Computed Metrics ──────────────────────────────────

  const metrics = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== "completed").length;

    // Avg completion time (hours)
    const completedTasks = tasks.filter((t) => t.completed_at);
    let avgCompletionHours = 0;
    if (completedTasks.length > 0) {
      const totalMs = completedTasks.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const completed = new Date(t.completed_at!).getTime();
        return sum + (completed - created);
      }, 0);
      avgCompletionHours = Math.round(totalMs / completedTasks.length / 3600000 * 10) / 10;
    }

    // Tasks this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const tasksThisWeek = tasks.filter(
      (t) => new Date(t.created_at) >= oneWeekAgo
    ).length;

    // Emergency requests pending
    const emergencyPending = requests.filter(
      (r) => r.urgency === "emergency" && r.status === "pending"
    ).length;

    return { openTasks, avgCompletionHours, tasksThisWeek, emergencyPending };
  }, [tasks, requests]);

  // ─── Tasks by Status ───────────────────────────────────

  const tasksByStatus = useMemo(() => {
    const counts: Record<HMTaskStatus, number> = {
      new: 0,
      acknowledged: 0,
      in_progress: 0,
      on_hold: 0,
      completed: 0,
    };
    tasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return (Object.entries(counts) as [HMTaskStatus, number][]).map(
      ([status, count]) => ({
        label: status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: count,
        color: STATUS_COLORS[status],
      })
    );
  }, [tasks]);

  // ─── Requests by Status ───────────────────────────────

  const requestsByStatus = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: REQUEST_STATUS_COLORS[status] || "#9ca3af",
    }));
  }, [requests]);

  // ─── Tasks by Property ────────────────────────────────

  const tasksByProperty = useMemo(() => {
    const propMap: Record<string, { name: string; open: number; completed: number; total: number }> = {};
    properties.forEach((p) => {
      propMap[p.id] = { name: p.name, open: 0, completed: 0, total: 0 };
    });
    tasks.forEach((t) => {
      if (!propMap[t.property_id]) {
        propMap[t.property_id] = { name: t.property?.name || "Unknown", open: 0, completed: 0, total: 0 };
      }
      propMap[t.property_id].total++;
      if (t.status === "completed") {
        propMap[t.property_id].completed++;
      } else {
        propMap[t.property_id].open++;
      }
    });
    return Object.values(propMap).filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  }, [tasks, properties]);

  // ─── Tasks by Staff ───────────────────────────────────

  const tasksByStaff = useMemo(() => {
    const staffMap: Record<string, { name: string; assigned: number; completed: number; totalMs: number; completedCount: number }> = {};
    tasks.forEach((t) => {
      const userId = t.assigned_to || "unassigned";
      if (!staffMap[userId]) {
        staffMap[userId] = {
          name: t.assigned_user?.name || (userId === "unassigned" ? "Unassigned" : "Unknown"),
          assigned: 0,
          completed: 0,
          totalMs: 0,
          completedCount: 0,
        };
      }
      staffMap[userId].assigned++;
      if (t.status === "completed" && t.completed_at) {
        staffMap[userId].completed++;
        const ms = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
        staffMap[userId].totalMs += ms;
        staffMap[userId].completedCount++;
      }
    });
    return Object.values(staffMap)
      .map((s) => ({
        ...s,
        avgHours: s.completedCount > 0
          ? Math.round(s.totalMs / s.completedCount / 3600000 * 10) / 10
          : null,
      }))
      .sort((a, b) => b.assigned - a.assigned);
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span style={{ color: "var(--gold)" }}>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Open Tasks" value={metrics.openTasks} />
        <MetricCard
          label="Avg Completion"
          value={metrics.avgCompletionHours > 0 ? `${metrics.avgCompletionHours}h` : "N/A"}
          sub="hours to complete"
        />
        <MetricCard label="Tasks This Week" value={metrics.tasksThisWeek} />
        <MetricCard
          label="Emergency Requests"
          value={metrics.emergencyPending}
          sub="pending review"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status */}
        <div
          className="p-4 rounded-lg border"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
        >
          <h3 className="font-serif text-base mb-4" style={{ color: "var(--text-primary)" }}>
            Tasks by Status
          </h3>
          <BarChart items={tasksByStatus} />
        </div>

        {/* Requests by Status */}
        <div
          className="p-4 rounded-lg border"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
        >
          <h3 className="font-serif text-base mb-4" style={{ color: "var(--text-primary)" }}>
            Requests by Status
          </h3>
          <BarChart items={requestsByStatus} />
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Property */}
        <div
          className="p-4 rounded-lg border"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
        >
          <h3 className="font-serif text-base mb-4" style={{ color: "var(--text-primary)" }}>
            Tasks by Property
          </h3>
          {tasksByProperty.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No task data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Property</th>
                  <th className="text-center pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Open</th>
                  <th className="text-center pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Done</th>
                  <th className="text-center pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {tasksByProperty.map((p, i) => (
                  <tr
                    key={i}
                    style={{ borderTop: "1px solid var(--border-light)" }}
                  >
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>{p.name}</td>
                    <td className="py-2 text-center" style={{ color: "#fb923c" }}>{p.open}</td>
                    <td className="py-2 text-center" style={{ color: "#4ade80" }}>{p.completed}</td>
                    <td className="py-2 text-center" style={{ color: "var(--text-secondary)" }}>{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tasks by Staff */}
        <div
          className="p-4 rounded-lg border"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
        >
          <h3 className="font-serif text-base mb-4" style={{ color: "var(--text-primary)" }}>
            Tasks by Staff
          </h3>
          {tasksByStaff.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No task data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Staff</th>
                  <th className="text-center pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Assigned</th>
                  <th className="text-center pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Done</th>
                  <th className="text-center pb-2 font-sans font-medium" style={{ color: "var(--text-muted)" }}>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {tasksByStaff.map((s, i) => (
                  <tr
                    key={i}
                    style={{ borderTop: "1px solid var(--border-light)" }}
                  >
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                    <td className="py-2 text-center" style={{ color: "var(--text-secondary)" }}>{s.assigned}</td>
                    <td className="py-2 text-center" style={{ color: "#4ade80" }}>{s.completed}</td>
                    <td className="py-2 text-center" style={{ color: "var(--text-secondary)" }}>
                      {s.avgHours !== null ? `${s.avgHours}h` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
