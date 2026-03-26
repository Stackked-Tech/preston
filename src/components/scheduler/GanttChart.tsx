"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import type { CSTask, CSSub, CSPhase } from "@/types/scheduler";
import { formatDateShort, daysBetween } from "@/lib/schedulerHooks";

interface GanttChartProps {
  tasks: CSTask[];
  phases: CSPhase[];
  subs: CSSub[];
  onTaskClick: (task: CSTask) => void;
  onTaskDrag: (taskId: string, newStartDate: string, newEndDate: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#6b7280",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  delayed: "#ef4444",
};

export default function GanttChart({ tasks, phases, subs, onTaskClick, onTaskDrag }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ taskId: string; startX: number; origStart: string; origEnd: string } | null>(null);
  const [hoverTaskId, setHoverTaskId] = useState<string | null>(null);

  // Calculate date range
  const { minDate, maxDate, totalDays, dayWidth } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      return { minDate: today, maxDate: today, totalDays: 30, dayWidth: 32 };
    }
    const starts = tasks.map((t) => t.start_date);
    const ends = tasks.map((t) => t.end_date);
    const min = starts.sort()[0];
    const max = ends.sort().reverse()[0];
    // Add padding
    const padMin = new Date(min + "T12:00:00");
    padMin.setDate(padMin.getDate() - 3);
    const padMax = new Date(max + "T12:00:00");
    padMax.setDate(padMax.getDate() + 7);
    const days = daysBetween(padMin.toISOString().split("T")[0], padMax.toISOString().split("T")[0]);
    return {
      minDate: padMin.toISOString().split("T")[0],
      maxDate: padMax.toISOString().split("T")[0],
      totalDays: Math.max(days, 14),
      dayWidth: 32,
    };
  }, [tasks]);

  // Generate date headers (weeks)
  const weekHeaders = useMemo(() => {
    const headers: { label: string; left: number; width: number }[] = [];
    const start = new Date(minDate + "T12:00:00");
    let current = new Date(start);
    // Align to Monday
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - ((dayOfWeek + 6) % 7));

    while (current <= new Date(maxDate + "T12:00:00")) {
      const weekStart = new Date(current);
      const dayOffset = daysBetween(minDate, weekStart.toISOString().split("T")[0]);
      headers.push({
        label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        left: Math.max(0, dayOffset * dayWidth),
        width: 7 * dayWidth,
      });
      current.setDate(current.getDate() + 7);
    }
    return headers;
  }, [minDate, maxDate, dayWidth]);

  // Day columns for grid lines
  const dayColumns = useMemo(() => {
    const cols: { left: number; isWeekend: boolean; isToday: boolean }[] = [];
    const today = new Date().toISOString().split("T")[0];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay();
      cols.push({
        left: i * dayWidth,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: d.toISOString().split("T")[0] === today,
      });
    }
    return cols;
  }, [minDate, totalDays, dayWidth]);

  // Group tasks by phase
  const groupedTasks = useMemo(() => {
    const groups: { phase: CSPhase | null; tasks: CSTask[] }[] = [];
    const phaseMap = new Map(phases.map((p) => [p.id, p]));
    const unphased: CSTask[] = [];
    const phaseGroups = new Map<string, CSTask[]>();

    for (const task of tasks) {
      if (task.phase_id && phaseMap.has(task.phase_id)) {
        const existing = phaseGroups.get(task.phase_id) || [];
        existing.push(task);
        phaseGroups.set(task.phase_id, existing);
      } else {
        unphased.push(task);
      }
    }

    for (const phase of phases) {
      const phaseTasks = phaseGroups.get(phase.id) || [];
      if (phaseTasks.length > 0) {
        groups.push({ phase, tasks: phaseTasks });
      }
    }
    if (unphased.length > 0) {
      groups.push({ phase: null, tasks: unphased });
    }
    return groups;
  }, [tasks, phases]);

  // Build flat row list for rendering
  const rows = useMemo(() => {
    const result: { type: "phase" | "task"; phase?: CSPhase; task?: CSTask; index: number }[] = [];
    let idx = 0;
    for (const group of groupedTasks) {
      if (group.phase) {
        result.push({ type: "phase", phase: group.phase, index: idx++ });
      }
      for (const task of group.tasks) {
        result.push({ type: "task", task, index: idx++ });
      }
    }
    return result;
  }, [groupedTasks]);

  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);

  const getTaskPosition = useCallback(
    (task: CSTask) => {
      const offset = daysBetween(minDate, task.start_date);
      const duration = daysBetween(task.start_date, task.end_date) + 1;
      return { left: offset * dayWidth, width: Math.max(duration * dayWidth - 2, dayWidth - 2) };
    },
    [minDate, dayWidth]
  );

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, task: CSTask) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging({ taskId: task.id, startX: e.clientX, origStart: task.start_date, origEnd: task.end_date });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const dayShift = Math.round(dx / dayWidth);
      if (dayShift === 0) return;

      const newStart = new Date(dragging.origStart + "T12:00:00");
      newStart.setDate(newStart.getDate() + dayShift);
      const newEnd = new Date(dragging.origEnd + "T12:00:00");
      newEnd.setDate(newEnd.getDate() + dayShift);

      // Visual preview only — actual update on mouseUp
    },
    [dragging, dayWidth]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const dayShift = Math.round(dx / dayWidth);

      if (dayShift !== 0) {
        const newStart = new Date(dragging.origStart + "T12:00:00");
        newStart.setDate(newStart.getDate() + dayShift);
        const newEnd = new Date(dragging.origEnd + "T12:00:00");
        newEnd.setDate(newEnd.getDate() + dayShift);
        onTaskDrag(
          dragging.taskId,
          newStart.toISOString().split("T")[0],
          newEnd.toISOString().split("T")[0]
        );
      }
      setDragging(null);
    },
    [dragging, dayWidth, onTaskDrag]
  );

  // Dependency arrows
  const dependencyLines = useMemo(() => {
    const taskRowMap = new Map<string, number>();
    let rowIdx = 0;
    for (const r of rows) {
      if (r.type === "task") {
        taskRowMap.set(r.task!.id, rowIdx);
      }
      rowIdx++;
    }

    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const r of rows) {
      if (r.type !== "task" || !r.task?.dependency_id) continue;
      const task = r.task!;
      const parentRowIdx = taskRowMap.get(task.dependency_id!);
      const childRowIdx = taskRowMap.get(task.id);
      if (parentRowIdx === undefined || childRowIdx === undefined) continue;

      const parentTask = tasks.find((t) => t.id === task.dependency_id);
      if (!parentTask) continue;

      const parentPos = getTaskPosition(parentTask);
      const childPos = getTaskPosition(task);

      lines.push({
        x1: parentPos.left + parentPos.width,
        y1: parentRowIdx * 40 + 20,
        x2: childPos.left,
        y2: childRowIdx * 40 + 20,
      });
    }
    return lines;
  }, [rows, tasks, getTaskPosition]);

  const rowHeight = 40;
  const labelWidth = 240;
  const chartWidth = totalDays * dayWidth;
  const chartHeight = rows.length * rowHeight;

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm font-sans">No tasks yet. Add tasks to see the timeline.</p>
      </div>
    );
  }

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-primary)" }}
    >
      <div className="flex overflow-x-auto" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => setDragging(null)}>
        {/* Labels column */}
        <div className="flex-shrink-0 border-r" style={{ width: labelWidth, borderColor: "var(--border-color)" }}>
          {/* Header */}
          <div
            className="h-10 flex items-center px-3 border-b text-xs font-sans font-medium uppercase tracking-wider"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)", background: "var(--card-bg)" }}
          >
            Task
          </div>
          {/* Rows */}
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center px-3 border-b"
              style={{
                height: rowHeight,
                borderColor: "var(--border-light)",
                background: row.type === "phase" ? "var(--card-bg)" : "transparent",
              }}
            >
              {row.type === "phase" ? (
                <span className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: row.phase?.color || "var(--gold)" }}>
                  {row.phase?.name}
                </span>
              ) : (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-sans truncate" style={{ color: "var(--text-primary)" }}>
                    {row.task?.name}
                  </span>
                  {row.task?.sub_id && subMap.has(row.task.sub_id) && (
                    <span className="text-[10px] font-sans truncate" style={{ color: "var(--text-muted)" }}>
                      {subMap.get(row.task.sub_id)?.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 overflow-x-auto" ref={containerRef}>
          {/* Week headers */}
          <div
            className="h-10 relative border-b"
            style={{ width: chartWidth, borderColor: "var(--border-color)", background: "var(--card-bg)" }}
          >
            {weekHeaders.map((wh, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-center px-2 text-[10px] font-sans border-l"
                style={{ left: wh.left, width: wh.width, borderColor: "var(--border-light)", color: "var(--text-muted)" }}
              >
                {wh.label}
              </div>
            ))}
          </div>

          {/* Grid + bars */}
          <div className="relative" style={{ width: chartWidth, height: chartHeight }}>
            {/* Day columns (background) */}
            {dayColumns.map((col, i) => (
              <div
                key={i}
                className="absolute top-0"
                style={{
                  left: col.left,
                  width: dayWidth,
                  height: chartHeight,
                  background: col.isToday ? "rgba(212, 175, 55, 0.1)" : col.isWeekend ? "rgba(0,0,0,0.03)" : "transparent",
                  borderLeft: "1px solid var(--border-light)",
                }}
              />
            ))}

            {/* Today line */}
            {dayColumns.map(
              (col, i) =>
                col.isToday && (
                  <div
                    key={`today-${i}`}
                    className="absolute top-0"
                    style={{
                      left: col.left + dayWidth / 2,
                      width: 2,
                      height: chartHeight,
                      background: "var(--gold)",
                      zIndex: 5,
                    }}
                  />
                )
            )}

            {/* Row borders */}
            {rows.map((_, i) => (
              <div
                key={`row-${i}`}
                className="absolute w-full border-b"
                style={{ top: i * rowHeight, height: rowHeight, borderColor: "var(--border-light)" }}
              />
            ))}

            {/* Dependency arrows (SVG) */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={chartWidth}
              height={chartHeight}
              style={{ zIndex: 3 }}
            >
              {dependencyLines.map((line, i) => {
                const midX = line.x1 + (line.x2 - line.x1) / 2;
                return (
                  <g key={i}>
                    <path
                      d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
                      fill="none"
                      stroke="var(--gold)"
                      strokeWidth={1.5}
                      opacity={0.6}
                    />
                    {/* Arrow head */}
                    <polygon
                      points={`${line.x2},${line.y2} ${line.x2 - 6},${line.y2 - 4} ${line.x2 - 6},${line.y2 + 4}`}
                      fill="var(--gold)"
                      opacity={0.6}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Task bars */}
            {rows.map((row) => {
              if (row.type !== "task" || !row.task) return null;
              const task = row.task;
              const pos = getTaskPosition(task);
              const isDraggingThis = dragging?.taskId === task.id;

              // Calculate drag offset for visual preview
              let dragOffset = 0;
              if (isDraggingThis && containerRef.current) {
                // We'll handle this via CSS transform in a future iteration
              }

              return (
                <div
                  key={task.id}
                  className="absolute rounded-md cursor-pointer transition-shadow"
                  style={{
                    left: pos.left + dragOffset,
                    top: row.index * rowHeight + 8,
                    width: pos.width,
                    height: rowHeight - 16,
                    background: STATUS_COLORS[task.status] || STATUS_COLORS.pending,
                    opacity: isDraggingThis ? 0.7 : hoverTaskId === task.id ? 0.9 : 0.8,
                    zIndex: isDraggingThis ? 10 : 4,
                    boxShadow: isDraggingThis ? "0 4px 12px rgba(0,0,0,0.3)" : hoverTaskId === task.id ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                  }}
                  onClick={() => onTaskClick(task)}
                  onMouseDown={(e) => handleMouseDown(e, task)}
                  onMouseEnter={() => setHoverTaskId(task.id)}
                  onMouseLeave={() => setHoverTaskId(null)}
                  title={`${task.name}\n${formatDateShort(task.start_date)} – ${formatDateShort(task.end_date)}`}
                >
                  <div className="h-full flex items-center px-2 overflow-hidden">
                    <span className="text-[10px] font-sans font-medium text-white truncate">{task.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: color, opacity: 0.8 }} />
            <span className="text-[10px] font-sans capitalize" style={{ color: "var(--text-muted)" }}>
              {status.replace("_", " ")}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-0.5" style={{ background: "var(--gold)" }} />
          <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
            Today
          </span>
        </div>
      </div>
    </div>
  );
}
