"use client";

import type { HMTaskWithDetails, HMTaskStatus, HMPriority } from "@/types/hospitality";

interface TaskListProps {
  tasks: HMTaskWithDetails[];
  onSelectTask: (taskId: string) => void;
  loading: boolean;
  statusFilters: HMTaskStatus[];
  onStatusFiltersChange: (statuses: HMTaskStatus[]) => void;
  propertyFilter: string;
  onPropertyFilterChange: (propertyId: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (priority: string) => void;
  properties: [string, string][];
}

const ALL_STATUSES: { value: HMTaskStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const STATUS_COLORS: Record<HMTaskStatus, { bg: string; text: string }> = {
  new: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" },
  acknowledged: { bg: "rgba(168, 85, 247, 0.15)", text: "#a855f7" },
  in_progress: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" },
  on_hold: { bg: "rgba(107, 114, 128, 0.15)", text: "#6b7280" },
  completed: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" },
};

const PRIORITY_COLORS: Record<HMPriority, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#9ca3af",
};

const PRIORITY_LABELS: Record<HMPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Med",
  low: "Low",
};

const STATUS_LABELS: Record<HMTaskStatus, string> = {
  new: "New",
  acknowledged: "Ack",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Done",
};

const STATUS_PROGRESS: Record<HMTaskStatus, { step: number; total: number }> = {
  new: { step: 1, total: 5 },
  acknowledged: { step: 2, total: 5 },
  in_progress: { step: 3, total: 5 },
  on_hold: { step: 3, total: 5 },
  completed: { step: 5, total: 5 },
};

function formatDueDate(dateStr: string): { label: string; overdue: boolean } {
  const due = new Date(dateStr + "T23:59:59");
  const now = new Date();
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);
  const overdue = diffDays < 0;

  if (diffDays === 0) return { label: "Today", overdue: false };
  if (diffDays === 1) return { label: "Tomorrow", overdue: false };
  if (diffDays === -1) return { label: "Yesterday", overdue: true };
  if (overdue)
    return { label: `${Math.abs(diffDays)}d overdue`, overdue: true };
  if (diffDays <= 7) return { label: `${diffDays}d`, overdue: false };

  return {
    label: new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    overdue: false,
  };
}

function formatAge(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TaskList({
  tasks,
  onSelectTask,
  loading,
  statusFilters,
  onStatusFiltersChange,
  propertyFilter,
  onPropertyFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  properties,
}: TaskListProps) {
  const toggleStatus = (status: HMTaskStatus) => {
    if (statusFilters.includes(status)) {
      onStatusFiltersChange(statusFilters.filter((s) => s !== status));
    } else {
      onStatusFiltersChange([...statusFilters, status]);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter Bar */}
      <div
        className="flex-shrink-0 px-4 py-3 space-y-3 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        {/* Status chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          {ALL_STATUSES.map(({ value, label }) => {
            const active = statusFilters.includes(value);
            const colors = STATUS_COLORS[value];
            return (
              <button
                key={value}
                onClick={() => toggleStatus(value)}
                className="flex-shrink-0 px-3 min-h-[36px] rounded-full text-xs font-medium transition-all border whitespace-nowrap"
                style={{
                  background: active ? colors.bg : "transparent",
                  color: active ? colors.text : "var(--text-muted)",
                  borderColor: active ? colors.text : "var(--border-light)",
                  opacity: active ? 1 : 0.6,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Property & Priority dropdowns */}
        <div className="flex gap-2">
          <select
            value={propertyFilter}
            onChange={(e) => onPropertyFilterChange(e.target.value)}
            className="flex-1 rounded-lg border px-3 min-h-[36px] text-xs outline-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-secondary)",
            }}
          >
            <option value="">All Properties</option>
            {properties.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            className="flex-1 rounded-lg border px-3 min-h-[36px] text-xs outline-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-secondary)",
            }}
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task Cards */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          // Skeleton cards
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-4 animate-pulse"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-light)",
              }}
            >
              <div className="flex gap-3">
                <div
                  className="w-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: "var(--border-light)",
                    minHeight: 56,
                  }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 rounded w-3/4"
                    style={{ background: "var(--border-light)" }}
                  />
                  <div
                    className="h-3 rounded w-1/2"
                    style={{ background: "var(--border-light)" }}
                  />
                  <div
                    className="h-3 rounded w-2/3"
                    style={{ background: "var(--border-light)" }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
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
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              No tasks match your filters
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Try adjusting the status or property filters
            </p>
          </div>
        ) : (
          tasks.map((task) => {
            const priorityColor = PRIORITY_COLORS[task.priority];
            const statusColor = STATUS_COLORS[task.status];
            const displayTitle =
              task.title ||
              task.description?.substring(0, 60) ||
              "Untitled task";
            const dueInfo = task.due_date
              ? formatDueDate(task.due_date)
              : null;
            const progress = STATUS_PROGRESS[task.status];

            return (
              <button
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="w-full text-left rounded-xl border p-4 transition-colors"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border-light)",
                }}
              >
                <div className="flex gap-3">
                  {/* Priority bar - wider with label */}
                  <div className="flex flex-col items-center flex-shrink-0 gap-1">
                    <div
                      className="w-1.5 rounded-full flex-1"
                      style={{
                        background: priorityColor,
                        minHeight: 40,
                      }}
                    />
                    <span
                      className="text-[8px] font-bold uppercase tracking-wider"
                      style={{ color: priorityColor }}
                    >
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <p
                      className="text-sm font-medium truncate m-0"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {displayTitle}
                    </p>

                    {/* Property */}
                    {task.property && (
                      <p
                        className="text-xs mt-0.5 m-0 truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {task.property.name}
                      </p>
                    )}

                    {/* Second row: due date prominent + created age */}
                    <div className="flex items-center gap-3 mt-1.5">
                      {dueInfo && (
                        <span
                          className="text-xs font-semibold flex items-center gap-1"
                          style={{
                            color: dueInfo.overdue
                              ? "#ef4444"
                              : "var(--text-secondary)",
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {dueInfo.overdue ? "! " : ""}
                          {dueInfo.label}
                        </span>
                      )}
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Created {formatAge(task.created_at)}
                      </span>
                    </div>

                    {/* Bottom row: status badge, progress, assignee */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: statusColor.bg,
                          color: statusColor.text,
                        }}
                      >
                        {STATUS_LABELS[task.status]}
                      </span>

                      {/* Progress dots */}
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: progress.total }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background:
                                i < progress.step
                                  ? statusColor.text
                                  : "var(--border-light)",
                            }}
                          />
                        ))}
                        <span
                          className="text-[9px] ml-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {progress.step}/{progress.total}
                        </span>
                      </div>

                      {task.assigned_user && (
                        <span
                          className="text-[10px] ml-auto"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {task.assigned_user.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
