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
    return { total, completed, delayed, inProgress, pct: total ? Math.round((completed / total) * 100) : 0 };
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

        // Collect sub notifications
        const subChanges = changed
          .filter((t) => t.sub_id)
          .map((t) => {
            const orig = tasks.find((o) => o.id === t.id)!;
            return {
              taskId: t.id,
              subId: t.sub_id!,
              taskName: t.name,
              oldStart: orig.start_date,
              oldEnd: orig.end_date,
              newStart: t.start_date,
              newEnd: t.end_date,
            };
          });

        if (subChanges.length > 0) {
          await onNotifySubs(subChanges);
        }
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
      {/* Project header */}
      <div className="p-4 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
              {project.name}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              {project.address && (
                <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>📍 {project.address}</span>
              )}
              {project.pm_name && (
                <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>PM: {project.pm_name}</span>
              )}
              {/* Status toggle */}
              {editingStatus ? (
                <select
                  value={project.status}
                  onChange={async (e) => {
                    await onUpdateProject(project.id, { status: e.target.value as CSProject["status"] });
                    setEditingStatus(false);
                  }}
                  onBlur={() => setEditingStatus(false)}
                  className="text-xs font-sans px-2 py-0.5 rounded border"
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
                  className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full cursor-pointer"
                  style={{
                    background: project.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)",
                    color: project.status === "active" ? "#22c55e" : "#9ca3af",
                  }}
                >
                  {project.status.replace("_", " ").toUpperCase()}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm("Delete this project and all its tasks?")) onDeleteProject(project.id);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-sans border"
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              Delete Project
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>Progress</span>
            <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: "var(--border-light)" }}>
              <div className="h-full rounded-full" style={{ width: `${stats.pct}%`, background: "var(--gold)" }} />
            </div>
            <span className="text-xs font-sans font-medium" style={{ color: "var(--gold)" }}>{stats.pct}%</span>
          </div>
          <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>{stats.total} tasks</span>
          {stats.inProgress > 0 && <span className="text-xs font-sans" style={{ color: "#3b82f6" }}>⏳ {stats.inProgress} active</span>}
          {stats.delayed > 0 && <span className="text-xs font-sans" style={{ color: "#ef4444" }}>⚠ {stats.delayed} delayed</span>}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setEditingTask("new")}
            className="px-3 py-1.5 rounded-lg text-xs font-sans font-medium"
            style={{ background: "var(--gold)", color: "#000" }}
          >
            + Add Task
          </button>
          <button
            onClick={() => setShowPhases(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans border"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Phases
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setView("gantt")}
              className="px-2 py-1 rounded text-xs font-sans"
              style={{ background: view === "gantt" ? "var(--gold)" : "transparent", color: view === "gantt" ? "#000" : "var(--text-muted)" }}
            >
              Gantt
            </button>
            <button
              onClick={() => setView("list")}
              className="px-2 py-1 rounded text-xs font-sans"
              style={{ background: view === "list" ? "var(--gold)" : "transparent", color: view === "list" ? "#000" : "var(--text-muted)" }}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Chart / List */}
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
              <p className="text-sm font-sans text-center py-8" style={{ color: "var(--text-muted)" }}>
                No tasks yet. Click &ldquo;+ Add Task&rdquo; to get started.
              </p>
            )}
            {tasks.map((task) => {
              const sub = subs.find((s) => s.id === task.sub_id);
              const phase = phases.find((p) => p.id === task.phase_id);
              return (
                <button
                  key={task.id}
                  onClick={() => setEditingTask(task)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <div
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{
                      background:
                        task.status === "completed" ? "#22c55e" : task.status === "delayed" ? "#ef4444" : task.status === "in_progress" ? "#3b82f6" : "#6b7280",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>{task.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {phase && (
                        <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-full" style={{ background: `${phase.color}20`, color: phase.color }}>
                          {phase.name}
                        </span>
                      )}
                      {sub && <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>{sub.name}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-sans" style={{ color: "var(--text-primary)" }}>
                      {formatDateShort(task.start_date)} – {formatDateShort(task.end_date)}
                    </p>
                    <p className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>{task.duration_days}d</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {editingTask !== null && (
        <TaskEditor
          task={editingTask === "new" ? null : editingTask}
          projectId={project.id}
          phases={phases}
          subs={subs}
          tasks={tasks}
          onSave={handleSaveTask}
          onDelete={async (id) => {
            await onDeleteTask(id);
            setEditingTask(null);
          }}
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
