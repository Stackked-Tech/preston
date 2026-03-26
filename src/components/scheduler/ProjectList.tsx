"use client";

import { useState } from "react";
import type { CSProject } from "@/types/scheduler";

interface ProjectListProps {
  projects: CSProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (project: { name: string; address: string; pm_name: string }) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  planning: { bg: "rgba(107, 114, 128, 0.12)", text: "#9ca3af", label: "Planning", dot: "#9ca3af" },
  active: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e", label: "Active", dot: "#22c55e" },
  on_hold: { bg: "rgba(234, 179, 8, 0.12)", text: "#eab308", label: "On Hold", dot: "#eab308" },
  completed: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6", label: "Completed", dot: "#3b82f6" },
};

export default function ProjectList({ projects, selectedId, onSelect, onCreate }: ProjectListProps) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPm, setNewPm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = projects
    .filter((p) => filter === "all" || p.status === filter)
    .filter((p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.pm_name.toLowerCase().includes(search.toLowerCase())
    );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreate({ name: newName.trim(), address: newAddress.trim(), pm_name: newPm.trim() });
      setNewName("");
      setNewAddress("");
      setNewPm("");
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  };

  const statusCounts = {
    all: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    planning: projects.filter((p) => p.status === "planning").length,
    on_hold: projects.filter((p) => p.status === "on_hold").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };

  return (
    <div
      className="w-80 flex-shrink-0 border-r flex flex-col h-full"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-sans font-semibold uppercase tracking-[2px] m-0" style={{ color: "var(--text-primary)" }}>
              Projects
            </h2>
            <p className="text-[10px] font-sans m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
              {projects.length} total · {statusCounts.active} active
            </p>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: showNew ? "var(--gold)" : "rgba(212, 175, 55, 0.1)",
              color: showNew ? "#000" : "var(--gold)",
            }}
          >
            {showNew ? "✕" : "+"}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40"
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: "var(--text-muted)" }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs font-sans transition-colors focus:outline-none"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "active", "planning", "on_hold", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2 py-0.5 rounded-md text-[10px] font-sans font-medium uppercase tracking-wider transition-all duration-200"
              style={{
                background: filter === f ? "var(--gold)" : "transparent",
                color: filter === f ? "#000" : "var(--text-muted)",
                border: filter === f ? "none" : "1px solid var(--border-light)",
              }}
            >
              {f === "all" ? `All (${statusCounts.all})` : `${f.replace("_", " ")} (${statusCounts[f]})`}
            </button>
          ))}
        </div>
      </div>

      {/* New project form */}
      {showNew && (
        <form
          onSubmit={handleCreate}
          className="p-4 border-b space-y-2.5"
          style={{ borderColor: "var(--border-color)", background: "rgba(212, 175, 55, 0.03)" }}
        >
          <div className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--gold)" }}>
            New Project
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name *"
            className="w-full px-3 py-2 rounded-lg border text-xs font-sans transition-colors focus:outline-none"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            autoFocus
          />
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Job site address"
            className="w-full px-3 py-2 rounded-lg border text-xs font-sans transition-colors focus:outline-none"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
          <input
            type="text"
            value={newPm}
            onChange={(e) => setNewPm(e.target.value)}
            placeholder="Project Manager"
            className="w-full px-3 py-2 rounded-lg border text-xs font-sans transition-colors focus:outline-none"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="w-full py-2 rounded-lg text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-200"
            style={{
              background: "var(--gold)",
              color: "#000",
              opacity: newName.trim() && !creating ? 1 : 0.4,
              boxShadow: newName.trim() ? "0 2px 8px rgba(212, 175, 55, 0.25)" : "none",
            }}
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </form>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(107, 114, 128, 0.08)" }}
            >
              <span className="text-2xl">🏗️</span>
            </div>
            <p className="text-xs font-sans text-center" style={{ color: "var(--text-muted)" }}>
              {search ? "No matching projects" : filter !== "all" ? `No ${filter.replace("_", " ")} projects` : "No projects yet"}
            </p>
          </div>
        )}
        {filtered.map((project) => {
          const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning;
          const isSelected = project.id === selectedId;
          const updatedAgo = getTimeAgo(project.updated_at);

          return (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className="w-full text-left px-4 py-3.5 border-b transition-all duration-200 group"
              style={{
                borderColor: "var(--border-light)",
                background: isSelected ? "rgba(212, 175, 55, 0.06)" : "transparent",
                borderLeft: isSelected ? "3px solid var(--gold)" : "3px solid transparent",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Status dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: config.dot, boxShadow: `0 0 6px ${config.dot}40` }}
                    />
                    <p
                      className="text-sm font-sans font-medium truncate m-0 transition-colors duration-200"
                      style={{ color: isSelected ? "var(--gold)" : "var(--text-primary)" }}
                    >
                      {project.name}
                    </p>
                  </div>
                  {project.address && (
                    <p className="text-[10px] font-sans truncate m-0 ml-4" style={{ color: "var(--text-muted)" }}>
                      📍 {project.address}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 ml-4">
                    {project.pm_name && (
                      <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                        {project.pm_name}
                      </span>
                    )}
                    <span className="text-[9px] font-sans" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      · {updatedAgo}
                    </span>
                  </div>
                </div>

                <span
                  className="text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider"
                  style={{ background: config.bg, color: config.text }}
                >
                  {config.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
