"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
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
import type { CSTask, CSPhase, CSSub, CSSubInsert } from "@/types/scheduler";
import ProjectList from "./ProjectList";
import ProjectDetail from "./ProjectDetail";
import SubDirectory from "./SubDirectory";
import NotificationLog from "./NotificationLog";
import TemplateManager from "./TemplateManager";
import SubWorkload from "./SubWorkload";

type ViewTab = "schedule" | "subs" | "templates" | "notifications";

export default function SchedulerDashboard() {
  const { theme, toggleTheme } = useTheme();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("schedule");
  const [showSubsModal, setShowSubsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showWorkload, setShowWorkload] = useState(false);

  // Data hooks
  const { projects, createProject, updateProject, deleteProject } = useProjects();
  const { phases, createPhase, updatePhase, deletePhase, fetchPhases } = usePhases(selectedProjectId);
  const { tasks, createTask, updateTask, bulkUpdateTasks, deleteTask, fetchTasks } = useTasks(selectedProjectId);
  const { subs, createSub, updateSub, deleteSub } = useSubs();
  const { generateToken } = useSubTokens();
  const { notifications, fetchNotifications } = useNotifications(selectedProjectId || undefined);
  const { templates, createTemplate, deleteTemplate, applyTemplate } = useTemplates();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Stats
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const totalTasks = tasks.length;
  const pendingNotifications = notifications.filter((n) => n.status === "pending").length;

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

      const bySubId = new Map<string, typeof changes>();
      for (const c of changes) {
        const existing = bySubId.get(c.subId) || [];
        existing.push(c);
        bySubId.set(c.subId, existing);
      }

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
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* ─── Top Bar ─── */}
      <header
        className="flex items-center justify-between px-5 py-2.5 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs no-underline" style={{ color: "var(--text-muted)" }}>
            &larr;
          </Link>
          <Image
            src="/wh-logo-circle-bw.png"
            alt="WHB Companies"
            width={32}
            height={32}
            className="object-contain rounded-full"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
          <div>
            <h1 className="text-sm font-serif font-semibold tracking-wide m-0" style={{ color: "var(--text-primary)" }}>
              Construction Scheduler
            </h1>
            <p className="text-[10px] font-sans tracking-[1.5px] uppercase m-0" style={{ color: "var(--text-muted)" }}>
              WHB Companies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-3 mr-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.08)" }}>
              <span className="text-[10px]">🏗️</span>
              <span className="text-[10px] font-sans font-medium" style={{ color: "#22c55e" }}>{activeProjects} Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "rgba(212, 175, 55, 0.08)" }}>
              <span className="text-[10px]">👷</span>
              <span className="text-[10px] font-sans font-medium" style={{ color: "var(--gold)" }}>{subs.length} Subs</span>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-light)" }}>
            {([
              { key: "schedule", label: "Schedule", icon: "📅" },
              { key: "workload", label: "Workload", icon: "📊" },
              { key: "subs", label: "Subs", icon: "👷" },
              { key: "templates", label: "Templates", icon: "📋" },
              { key: "notifications", label: "Alerts", icon: "🔔" },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => {
                  if (key === "workload") setShowWorkload(true);
                  else if (key === "subs") setShowSubsModal(true);
                  else if (key === "templates") setShowTemplatesModal(true);
                  else if (key === "notifications") setShowNotificationsModal(true);
                  else setActiveTab(key);
                }}
                className="px-3 py-1.5 text-[11px] font-sans font-medium tracking-wide uppercase transition-all duration-200 relative"
                style={{
                  background: activeTab === key ? "rgba(212, 175, 55, 0.12)" : "transparent",
                  color: activeTab === key ? "var(--gold)" : "var(--text-muted)",
                }}
              >
                <span className="hidden sm:inline">{icon} </span>
                {label}
                {key === "notifications" && notifications.length > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ background: "var(--gold)", color: "#000" }}
                  >
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className="border px-2.5 py-1 rounded-lg text-xs font-sans tracking-[1px] uppercase transition-all duration-200"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            {theme === "dark" ? "☀" : "●"}
          </button>
        </div>
      </header>

      {/* ─── Main Layout ─── */}
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
            <div className="text-center max-w-sm">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(212, 175, 55, 0.08)" }}
              >
                <span className="text-4xl">📅</span>
              </div>
              <h3 className="text-lg font-serif font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                No Project Selected
              </h3>
              <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Select a project from the sidebar or create a new one to start building your construction schedule.
              </p>
              {projects.length === 0 && (
                <p className="text-xs font-sans mt-4 px-4 py-2 rounded-lg inline-block" style={{ background: "rgba(212, 175, 55, 0.08)", color: "var(--gold)" }}>
                  Click &ldquo;+&rdquo; in the sidebar to create your first project
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {showSubsModal && (
        <SubDirectory
          subs={subs}
          onCreateSub={async (sub: CSSubInsert) => { await createSub(sub); }}
          onUpdateSub={async (id: string, updates: Partial<CSSub>) => { await updateSub(id, updates); }}
          onDeleteSub={async (id: string) => { await deleteSub(id); }}
          onGenerateLink={generateToken}
          onClose={() => setShowSubsModal(false)}
        />
      )}

      {showNotificationsModal && (
        <NotificationLog
          notifications={notifications}
          subs={subs}
          onClose={() => setShowNotificationsModal(false)}
        />
      )}

      {showWorkload && (
        <SubWorkload
          subs={subs}
          onClose={() => setShowWorkload(false)}
          onNavigateToProject={(projectId) => { setSelectedProjectId(projectId); setShowWorkload(false); }}
        />
      )}

      {showTemplatesModal && (
        <TemplateManager
          templates={templates}
          onApplyTemplate={handleApplyTemplate}
          onCreateTemplate={handleCreateTemplate}
          onDeleteTemplate={deleteTemplate}
          onClose={() => setShowTemplatesModal(false)}
        />
      )}
    </div>
  );
}
