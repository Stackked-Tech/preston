"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatDateShort, daysBetween } from "@/lib/schedulerHooks";
import type { CSTask, CSSub, CSProject } from "@/types/scheduler";

interface SubWorkloadProps {
  subs: CSSub[];
  onClose: () => void;
  onNavigateToProject: (projectId: string) => void;
}

const PROJECT_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#ec4899",
  "#06b6d4", "#eab308", "#ef4444", "#14b8a6", "#f43f5e",
];

interface TaskWithProject extends CSTask {
  project_name: string;
  project_color: string;
  project_id: string;
}

export default function SubWorkload({ subs, onClose, onNavigateToProject }: SubWorkloadProps) {
  const [allTasks, setAllTasks] = useState<TaskWithProject[]>([]);
  const [projects, setProjects] = useState<CSProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  // Fetch all tasks across all projects
  useEffect(() => {
    async function fetchAll() {
      if (!isSupabaseConfigured) { setLoading(false); return; }
      try {
        const [tasksRes, projectsRes] = await Promise.all([
          supabase.from("cs_tasks").select("*, project:cs_projects(id, name)").not("sub_id", "is", null).in("status", ["pending", "in_progress", "delayed"]).order("start_date"),
          supabase.from("cs_projects").select("*").in("status", ["active", "planning"]).order("name"),
        ]);
        const projs = (projectsRes.data || []) as CSProject[];
        setProjects(projs);
        const projectColorMap = new Map(projs.map((p, i) => [p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]]));

        const mapped = (tasksRes.data || []).map((t: Record<string, unknown>) => {
          const proj = t.project as { id: string; name: string } | null;
          return {
            ...(t as unknown as CSTask),
            project_name: proj?.name || "Unknown",
            project_color: projectColorMap.get(proj?.id || "") || "#6b7280",
            project_id: proj?.id || "",
          };
        });
        setAllTasks(mapped);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Get unique trades
  const trades = useMemo(() => {
    const set = new Set(subs.map((s) => s.trade));
    return Array.from(set).sort();
  }, [subs]);

  // Filter subs
  const filteredSubs = useMemo(() => {
    return tradeFilter === "all" ? subs : subs.filter((s) => s.trade === tradeFilter);
  }, [subs, tradeFilter]);

  // Tasks grouped by sub
  const subTaskMap = useMemo(() => {
    const map = new Map<string, TaskWithProject[]>();
    for (const task of allTasks) {
      if (!task.sub_id) continue;
      const existing = map.get(task.sub_id) || [];
      existing.push(task);
      map.set(task.sub_id, existing);
    }
    return map;
  }, [allTasks]);

  // Date range for the timeline
  const { minDate, maxDate, totalDays, dayWidth } = useMemo(() => {
    const today = new Date();
    const defaultMin = new Date(today);
    defaultMin.setDate(defaultMin.getDate() - 7);
    const defaultMax = new Date(today);
    defaultMax.setDate(defaultMax.getDate() + 60);

    if (allTasks.length === 0) {
      return {
        minDate: defaultMin.toISOString().split("T")[0],
        maxDate: defaultMax.toISOString().split("T")[0],
        totalDays: 67,
        dayWidth: 24,
      };
    }

    const starts = allTasks.map((t) => t.start_date).sort();
    const ends = allTasks.map((t) => t.end_date).sort().reverse();
    const min = new Date(Math.min(defaultMin.getTime(), new Date(starts[0] + "T12:00:00").getTime()));
    min.setDate(min.getDate() - 3);
    const max = new Date(Math.max(defaultMax.getTime(), new Date(ends[0] + "T12:00:00").getTime()));
    max.setDate(max.getDate() + 7);

    const days = daysBetween(min.toISOString().split("T")[0], max.toISOString().split("T")[0]);
    return { minDate: min.toISOString().split("T")[0], maxDate: max.toISOString().split("T")[0], totalDays: days, dayWidth: 24 };
  }, [allTasks]);

  // Week headers
  const weekHeaders = useMemo(() => {
    const headers: { label: string; left: number; width: number }[] = [];
    const start = new Date(minDate + "T12:00:00");
    const current = new Date(start);
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - ((dayOfWeek + 6) % 7));

    while (current <= new Date(maxDate + "T12:00:00")) {
      const offset = daysBetween(minDate, current.toISOString().split("T")[0]);
      headers.push({
        label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        left: Math.max(0, offset * dayWidth),
        width: 7 * dayWidth,
      });
      current.setDate(current.getDate() + 7);
    }
    return headers;
  }, [minDate, maxDate, dayWidth]);

  // Day columns
  const dayColumns = useMemo(() => {
    const cols: { left: number; isWeekend: boolean; isToday: boolean }[] = [];
    const today = new Date().toISOString().split("T")[0];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      cols.push({
        left: i * dayWidth,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: d.toISOString().split("T")[0] === today,
      });
    }
    return cols;
  }, [minDate, totalDays, dayWidth]);

  const labelWidth = 220;
  const chartWidth = totalDays * dayWidth;
  const rowHeight = 48;

  // Only show subs that have tasks (or all if no filter)
  const subsWithTasks = filteredSubs.filter((s) => (subTaskMap.get(s.id)?.length || 0) > 0);
  const subsWithoutTasks = filteredSubs.filter((s) => (subTaskMap.get(s.id)?.length || 0) === 0);
  const chartHeight = subsWithTasks.length * rowHeight;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex-1 m-4 rounded-2xl border overflow-hidden flex flex-col"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(212, 175, 55, 0.1)" }}>
              <span className="text-lg">👷</span>
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold m-0" style={{ color: "var(--text-primary)" }}>
                Sub Workload Overview
              </h3>
              <p className="text-xs font-sans m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                All tasks across all projects · {subsWithTasks.length} subs with active work
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Trade filter */}
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-xs font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="all">All Trades</option>
              {trades.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "var(--text-muted)", background: "var(--border-light)" }}>✕</button>
          </div>
        </div>

        {/* Project legend */}
        <div className="px-6 py-2 border-b flex items-center gap-4 flex-wrap" style={{ borderColor: "var(--border-light)" }}>
          <span className="text-[10px] font-sans uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Projects:</span>
          {projects.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
              <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>{p.name}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-lg border-2 border-[#d4af37]/30 border-t-[#d4af37] animate-spin" />
              <p className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>Loading workload data...</p>
            </div>
          </div>
        ) : subsWithTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(107, 114, 128, 0.08)" }}>
                <span className="text-3xl">📋</span>
              </div>
              <p className="text-sm font-sans" style={{ color: "var(--text-muted)" }}>No active tasks assigned to subs</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="flex">
              {/* Labels */}
              <div className="flex-shrink-0 border-r" style={{ width: labelWidth, borderColor: "var(--border-color)" }}>
                <div className="h-8 border-b" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }} />
                {subsWithTasks.map((sub) => {
                  const taskCount = subTaskMap.get(sub.id)?.length || 0;
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center px-3 border-b"
                      style={{ height: rowHeight, borderColor: "var(--border-light)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-sans font-medium truncate m-0" style={{ color: "var(--text-primary)" }}>{sub.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-sans" style={{ color: "var(--gold)" }}>{sub.trade}</span>
                          <span className="text-[9px] font-sans" style={{ color: "var(--text-muted)" }}>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chart */}
              <div className="flex-1 overflow-x-auto">
                {/* Week headers */}
                <div className="h-8 relative border-b" style={{ width: chartWidth, borderColor: "var(--border-color)", background: "var(--card-bg)" }}>
                  {weekHeaders.map((wh, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full flex items-center px-2 text-[9px] font-sans border-l"
                      style={{ left: wh.left, width: wh.width, borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                    >
                      {wh.label}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div className="relative" style={{ width: chartWidth, height: chartHeight }}>
                  {/* Day columns */}
                  {dayColumns.map((col, i) => (
                    <div
                      key={i}
                      className="absolute top-0"
                      style={{
                        left: col.left,
                        width: dayWidth,
                        height: chartHeight,
                        background: col.isToday ? "rgba(212, 175, 55, 0.08)" : col.isWeekend ? "rgba(0,0,0,0.02)" : "transparent",
                        borderLeft: "1px solid var(--border-light)",
                      }}
                    />
                  ))}

                  {/* Today line */}
                  {dayColumns.filter((c) => c.isToday).map((col, i) => (
                    <div key={`today-${i}`} className="absolute top-0" style={{ left: col.left + dayWidth / 2, width: 2, height: chartHeight, background: "var(--gold)", zIndex: 5, opacity: 0.6 }} />
                  ))}

                  {/* Row borders */}
                  {subsWithTasks.map((_, i) => (
                    <div key={`row-${i}`} className="absolute w-full border-b" style={{ top: i * rowHeight, height: rowHeight, borderColor: "var(--border-light)" }} />
                  ))}

                  {/* Task bars */}
                  {subsWithTasks.map((sub, rowIdx) => {
                    const subTasks = subTaskMap.get(sub.id) || [];
                    return subTasks.map((task) => {
                      const offset = daysBetween(minDate, task.start_date);
                      const duration = daysBetween(task.start_date, task.end_date) + 1;
                      const left = offset * dayWidth;
                      const width = Math.max(duration * dayWidth - 4, dayWidth - 4);
                      const isHovered = hoveredTask === task.id;

                      return (
                        <div
                          key={task.id}
                          className="absolute rounded-md cursor-pointer transition-all duration-200"
                          style={{
                            left: left + 2,
                            top: rowIdx * rowHeight + 10,
                            width,
                            height: rowHeight - 20,
                            background: task.project_color,
                            opacity: isHovered ? 1 : 0.75,
                            zIndex: isHovered ? 10 : 4,
                            boxShadow: isHovered ? `0 4px 12px ${task.project_color}40` : "none",
                            transform: isHovered ? "scaleY(1.1)" : "scaleY(1)",
                          }}
                          onMouseEnter={() => setHoveredTask(task.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                          onClick={() => { onNavigateToProject(task.project_id); onClose(); }}
                          title={`${task.name}\n${task.project_name}\n${formatDateShort(task.start_date)} – ${formatDateShort(task.end_date)}`}
                        >
                          <div className="h-full flex items-center px-1.5 overflow-hidden">
                            <span className="text-[9px] font-sans font-medium text-white truncate">{task.name}</span>
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>

            {/* Idle subs */}
            {subsWithoutTasks.length > 0 && (
              <div className="px-6 py-3 border-t" style={{ borderColor: "var(--border-color)" }}>
                <p className="text-[10px] font-sans uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Available (no active tasks)
                </p>
                <div className="flex flex-wrap gap-2">
                  {subsWithoutTasks.map((sub) => (
                    <span key={sub.id} className="text-[10px] font-sans px-2 py-1 rounded-full border" style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}>
                      {sub.name} · {sub.trade}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
