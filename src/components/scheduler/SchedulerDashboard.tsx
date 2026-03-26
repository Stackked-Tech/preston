"use client";

import { useState, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import {
  useProjects,
  usePhases,
  useTasks,
  useSubs,
  useSubTokens,
  useNotifications,
  useTemplates,
} from "@/lib/schedulerHooks";
import type { CSProject, CSTask, CSPhase, CSSub, CSSubInsert } from "@/types/scheduler";
import ProjectList from "./ProjectList";
import ProjectDetail from "./ProjectDetail";
import SubDirectory from "./SubDirectory";
import NotificationLog from "./NotificationLog";
import TemplateManager from "./TemplateManager";

export default function SchedulerDashboard() {
  const { theme, toggleTheme } = useTheme();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showSubs, setShowSubs] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Data hooks
  const { projects, createProject, updateProject, deleteProject } = useProjects();
  const { phases, createPhase, updatePhase, deletePhase, fetchPhases } = usePhases(selectedProjectId);
  const { tasks, createTask, updateTask, bulkUpdateTasks, deleteTask, fetchTasks } = useTasks(selectedProjectId);
  const { subs, createSub, updateSub, deleteSub } = useSubs();
  const { generateToken } = useSubTokens();
  const { notifications, fetchNotifications } = useNotifications(selectedProjectId || undefined);
  const { templates, createTemplate, deleteTemplate, applyTemplate } = useTemplates();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Handlers
  const handleCreateProject = useCallback(
    async (data: { name: string; address: string; pm_name: string }) => {
      const project = await createProject({
        ...data,
        status: "planning",
        start_date: null,
        estimated_end_date: null,
        notes: null,
      });
      setSelectedProjectId(project.id);
    },
    [createProject]
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProject(id);
      setSelectedProjectId(null);
    },
    [deleteProject]
  );

  const handleCreatePhase = useCallback(
    async (name: string, color: string) => {
      if (!selectedProjectId) return;
      await createPhase({
        project_id: selectedProjectId,
        name,
        sort_order: phases.length,
        color,
      });
    },
    [selectedProjectId, phases.length, createPhase]
  );

  const handleCreateTask = useCallback(
    async (taskData: Partial<CSTask> & { project_id: string }) => {
      await createTask(taskData as CSTask);
    },
    [createTask]
  );

  const handleNotifySubs = useCallback(
    async (changes: { taskId: string; subId: string; taskName: string; oldStart: string; oldEnd: string; newStart: string; newEnd: string }[]) => {
      if (!selectedProject) return;

      // Group changes by sub
      const bySubId = new Map<string, typeof changes>();
      for (const c of changes) {
        const existing = bySubId.get(c.subId) || [];
        existing.push(c);
        bySubId.set(c.subId, existing);
      }

      // Send one notification per sub
      for (const [subId, subChanges] of bySubId) {
        try {
          await fetch("/api/scheduler/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: selectedProject.id,
              projectName: selectedProject.name,
              subId,
              changes: subChanges.map((c) => ({
                taskId: c.taskId,
                taskName: c.taskName,
                oldStart: c.oldStart,
                oldEnd: c.oldEnd,
                newStart: c.newStart,
                newEnd: c.newEnd,
              })),
            }),
          });
        } catch (err) {
          console.error("Failed to notify sub:", err);
        }
      }
      fetchNotifications();
    },
    [selectedProject, fetchNotifications]
  );

  const handleApplyTemplate = useCallback(
    async (templateId: string, startDate: string) => {
      if (!selectedProjectId) return;
      await applyTemplate(templateId, selectedProjectId, startDate);
      fetchTasks();
      fetchPhases();
    },
    [selectedProjectId, applyTemplate, fetchTasks, fetchPhases]
  );

  const handleCreateTemplate = useCallback(
    async (name: string, description: string) => {
      await createTemplate({ name, description: description || null });
    },
    [createTemplate]
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <a href="/" className="text-xl no-underline">📅</a>
          <div>
            <h1 className="text-base font-serif font-semibold m-0" style={{ color: "var(--text-primary)" }}>
              Construction Scheduler
            </h1>
            <p className="text-[10px] font-sans tracking-[2px] uppercase m-0" style={{ color: "var(--text-muted)" }}>
              WHB Companies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubs(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans border transition-colors"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            👷 Subs
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans border transition-colors"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            📋 Templates
          </button>
          <button
            onClick={() => setShowNotifications(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans border transition-colors"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            🔔 Notifications
          </button>
          <button
            onClick={toggleTheme}
            className="px-3 py-1.5 rounded-lg text-xs font-sans border transition-colors"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            {theme === "dark" ? "☀" : "●"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <ProjectList
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onCreate={handleCreateProject}
        />

        {selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            tasks={tasks}
            phases={phases}
            subs={subs}
            onUpdateProject={updateProject}
            onDeleteProject={handleDeleteProject}
            onCreateTask={handleCreateTask}
            onUpdateTask={updateTask}
            onBulkUpdateTasks={bulkUpdateTasks}
            onDeleteTask={deleteTask}
            onCreatePhase={handleCreatePhase}
            onUpdatePhase={updatePhase}
            onDeletePhase={deletePhase}
            onNotifySubs={handleNotifySubs}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-4">📅</p>
              <p className="text-sm font-sans" style={{ color: "var(--text-muted)" }}>
                Select a project or create one to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSubs && (
        <SubDirectory
          subs={subs}
          onCreateSub={async (sub: CSSubInsert) => { await createSub(sub); }}
          onUpdateSub={async (id: string, updates: Partial<CSSub>) => { await updateSub(id, updates); }}
          onDeleteSub={async (id: string) => { await deleteSub(id); }}
          onGenerateLink={generateToken}
          onClose={() => setShowSubs(false)}
        />
      )}

      {showNotifications && (
        <NotificationLog
          notifications={notifications}
          subs={subs}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {showTemplates && (
        <TemplateManager
          templates={templates}
          onApplyTemplate={handleApplyTemplate}
          onCreateTemplate={handleCreateTemplate}
          onDeleteTemplate={deleteTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}
