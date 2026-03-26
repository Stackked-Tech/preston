"use client";

import { useState, useCallback, useMemo } from "react";
import type { CSProject, CSTask, CSPhase, CSSub } from "@/types/scheduler";
import { formatDateShort, cascadeTasks } from "@/lib/schedulerHooks";
import GanttChart from "./GanttChart";
import TaskEditor from "./TaskEditor";
import PhaseManager from "./PhaseManager";

interface ProjectDetailProps {
  project: CSProject;
  tasks: CSTask[];
  phases: CSPhase[];
  subs: CSSub[];
  onUpdateProject: (id: string, updates: Partial<CSProject>) => Promise<unknown>;
  onDeleteProject: (id: string) => Promise<unknown>;
  onCreateTask: (task: Partial<CSTask> & { project_id: string }) => Promise<unknown>;
  onUpdateTask: (id: string, updates: Partial<CSTask>) => Promise<unknown>;
  onBulkUpdateTasks: (tasks: CSTask[]) => Promise<unknown>;
  onDeleteTask: (id: string) => Promise<unknown>;
  onCreatePhase: (name: string, color: string) => Promise<unknown>;
  onUpdatePhase: (id: string, updates: Partial<CSPhase>) => Promise<unknown>;
  onDeletePhase: (id: string) => Promise<unknown>;
  onNotifySubs: (changes: { taskId: string; subId: string; taskName: string; oldStart: string; oldEnd: string; newStart: string; newEnd: string }[]) => Promise<void>;
}

export default function ProjectDetail({
  project,
  tasks,
  phases,
  subs,
  onUpdateProject,
  onDeleteProject,
  onCreateTask,
  onUpdateTask,
  onBulkUpdateTasks,
  onDeleteTask,
  onCreatePhase,
  onUpdatePhase,
  onDeletePhase,
  onNotifySubs,
}: ProjectDetailProps) {
  const [editingTask, setEditingTask] = useState<CSTask | null | "new">(null);
  const [showPhases, setShowPhases] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [view, setView] = useState<"gantt" | "list">("gantt");

  // Task stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const delayed = tasks.filter((t) => t.status === "delayed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    // Date range
    const starts = tasks.map((t) => t.start_date).filter(Boolean).sort();
    const ends = tasks.map((t) => t.end_date).filter(Boolean).sort().reverse();
    const dateRange = starts.length ? `${formatDateShort(starts[0])} – ${formatDateShort(ends[0])}` : "No dates";

    return { total, completed, delayed, inProgress, pending, pct, dateRange };
  }, [tasks]);

  const handleTaskDrag = useCallback(
    async (taskId: string, newStart: string, newEnd: string) => {
      const oldTask = tasks.find((t) => t.id === taskId);
      if (!oldTask) return;

      const cascaded = cascadeTasks(tasks, taskId, newStart, newEnd);
      const changed = cascaded.filter((t) => {
        const orig = tasks.find((o) => o.id === t.id);
        return orig && (orig.start_date !== t.start_date || orig.end_date !== t.end_date);
      });

      if (changed.length > 0) {
        await onBulkUpdateTasks(changed);
        const subChanges = changed
          .filter((t) => t.sub_id)
          .map((t) => {
            const orig = tasks.find((o) => o.id === t.id)!;
            return {
              taskId: t.id, subId: t.sub_id!, taskName: t.name,
              oldStart: orig.start_date, oldEnd: orig.end_date,
              newStart: t.start_date, newEnd: t.end_date,
            };
          });
        if (subChanges.length > 0) await onNotifySubs(subChanges);
      }
    },
    [tasks, onBulkUpdateTasks, onNotifySubs]
  );

  const handleSaveTask = useCallback(
    async (taskData: Partial<CSTask> & { project_id: string }) => {
      if (taskData.id) {
        const { id, project_id, created_at, updated_at, ...updates } = taskData as CSTask;
        await onUpdateTask(id, updates);
      } else {
        await onCreateTask(taskData);
      }
    },
    [onCreateTask, onUpdateTask]
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* ─── Project header ─── */}
      <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
        {/* Title row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-serif font-semibold m-0" style={{ color: "var(--text-primary)" }}>
                {project.name}
              </h2>
              {editingStatus ? (
                <select
                  value={project.status}
                  onChange={async (e) => {
                    await onUpdateProject(project.id, { status: e.target.value as CSProject["status"] });
                    setEditingStatus(false);
                  }}
                  onBlur={() => setEditingStatus(false)}
                  className="text-xs font-sans px-2 py-1 rounded-lg border focus:outline-none"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  autoFocus
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <button
                  onClick={() => setEditingStatus(true)}
                  className="text-[10px] font-sans font-semibold px-2.5 py-1 rounded-full cursor-pointer uppercase tracking-wider transition-all duration-200 hover:scale-105"
                  style={{
                    background: project.status === "active" ? "rgba(34,197,94,0.12)" : project.status === "on_hold" ? "rgba(234,179,8,0.12)" : project.status === "completed" ? "rgba(59,130,246,0.12)" : "rgba(107,114,128,0.12)",
                    color: project.status === "active" ? "#22c55e" : project.status === "on_hold" ? "#eab308" : project.status === "completed" ? "#3b82f6" : "#9ca3af",
                  }}
                >
                  {project.status.replace("_", " ")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              {project.address && (
                <span className="text-xs font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {project.address}
                </span>
              )}
              {project.pm_name && (
                <span className="text-xs font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {project.pm_name}
                </span>
              )}
              <span className="text-xs font-sans" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                {stats.dateRange}
              </span>
            </div>
          </div>

          <button
            onClick={() => { if (confirm("Delete this project and all its tasks?")) onDeleteProject(project.id); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-sans font-medium uppercase tracking-wider border transition-all duration-200 hover:bg-red-500/10"
            style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#ef4444" }}
          >
            Delete
          </button>
        </div>

        {/* ─── Stats cards ─── */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: "Total", value: stats.total, color: "var(--text-primary)", bg: "rgba(107, 114, 128, 0.06)" },
            { label: "Pending", value: stats.pending, color: "#9ca3af", bg: "rgba(107, 114, 128, 0.06)" },
            { label: "In Progress", value: stats.inProgress, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.06)" },
            { label: "Completed", value: stats.completed, color: "#22c55e", bg: "rgba(34, 197, 94, 0.06)" },
            { label: "Delayed", value: stats.delayed, color: "#ef4444", bg: "rgba(239, 68, 68, 0.06)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-3 py-2.5 rounded-xl border transition-all duration-200"
              style={{ background: stat.bg, borderColor: "var(--border-light)" }}
            >
              <p className="text-[10px] font-sans uppercase tracking-wider m-0" style={{ color: "var(--text-muted)" }}>
                {stat.label}
              </p>
              <p className="text-lg font-sans font-bold m-0 mt-0.5" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-sans uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Progress</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border-light)" }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${stats.pct}%`,
                background: stats.pct === 100 ? "#22c55e" : "linear-gradient(90deg, var(--gold), #f5d06a)",
                boxShadow: stats.pct > 0 ? "0 0 8px rgba(212, 175, 55, 0.3)" : "none",
              }}
            />
          </div>
          <span className="text-xs font-sans font-bold min-w-[3ch] text-right" style={{ color: "var(--gold)" }}>
            {stats.pct}%
          </span>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingTask("new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: "var(--gold)",
              color: "#000",
              boxShadow: "0 2px 8px rgba(212, 175, 55, 0.25)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Task
          </button>
          <button
            onClick={() => setShowPhases(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-sans font-medium border transition-all duration-200 hover:scale-[1.02]"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
            Phases
          </button>

          {/* View toggle */}
          <div className="ml-auto flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-light)" }}>
            {([
              { key: "gantt", label: "Timeline", icon: "▤" },
              { key: "list", label: "List", icon: "☰" },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="px-3 py-1.5 text-[11px] font-sans font-medium tracking-wide transition-all duration-200"
                style={{
                  background: view === key ? "rgba(212, 175, 55, 0.12)" : "transparent",
                  color: view === key ? "var(--gold)" : "var(--text-muted)",
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Chart / List ─── */}
      <div className="flex-1 overflow-auto p-4">
        {view === "gantt" ? (
          <GanttChart
            tasks={tasks}
            phases={phases}
            subs={subs}
            onTaskClick={(task) => setEditingTask(task)}
            onTaskDrag={handleTaskDrag}
          />
        ) : (
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(212, 175, 55, 0.08)" }}>
                  <span className="text-3xl">📋</span>
                </div>
                <p className="text-sm font-sans font-medium mb-1" style={{ color: "var(--text-primary)" }}>No tasks yet</p>
                <p className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>Click &ldquo;Add Task&rdquo; to build your schedule</p>
              </div>
            )}
            {tasks.map((task) => {
              const sub = subs.find((s) => s.id === task.sub_id);
              const phase = phases.find((p) => p.id === task.phase_id);
              const statusColors: Record<string, { bg: string; text: string }> = {
                pending: { bg: "rgba(107, 114, 128, 0.08)", text: "#9ca3af" },
                in_progress: { bg: "rgba(59, 130, 246, 0.08)", text: "#3b82f6" },
                completed: { bg: "rgba(34, 197, 94, 0.08)", text: "#22c55e" },
                delayed: { bg: "rgba(239, 68, 68, 0.08)", text: "#ef4444" },
              };
              const sc = statusColors[task.status] || statusColors.pending;

              return (
                <button
                  key={task.id}
                  onClick={() => setEditingTask(task)}
                  className="w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 hover:shadow-md group"
                  style={{ borderColor: "var(--border-light)", background: "var(--card-bg)" }}
                >
                  {/* Status indicator */}
                  <div
                    className="w-1.5 h-10 rounded-full flex-shrink-0"
                    style={{ background: sc.text }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-sans font-medium m-0 group-hover:text-[var(--gold)] transition-colors" style={{ color: "var(--text-primary)" }}>
                        {task.name}
                      </p>
                      <span className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded-full uppercase" style={{ background: sc.bg, color: sc.text }}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {phase && (
                        <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md" style={{ background: `${phase.color}15`, color: phase.color }}>
                          {phase.name}
                        </span>
                      )}
                      {sub && (
                        <span className="text-[10px] font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                          👷 {sub.name}
                        </span>
                      )}
                      {task.dependency_id && (
                        <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                          🔗 Has dependency
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-sans font-medium m-0" style={{ color: "var(--text-primary)" }}>
                      {formatDateShort(task.start_date)} – {formatDateShort(task.end_date)}
                    </p>
                    <p className="text-[10px] font-sans m-0" style={{ color: "var(--text-muted)" }}>
                      {task.duration_days} day{task.duration_days !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {editingTask !== null && (
        <TaskEditor
          task={editingTask === "new" ? null : editingTask}
          projectId={project.id}
          phases={phases}
          subs={subs}
          tasks={tasks}
          onSave={handleSaveTask}
          onDelete={async (id) => { await onDeleteTask(id); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {showPhases && (
        <PhaseManager
          phases={phases}
          onCreatePhase={onCreatePhase}
          onUpdatePhase={onUpdatePhase}
          onDeletePhase={onDeletePhase}
          onClose={() => setShowPhases(false)}
        />
      )}
    </div>
  );
}
