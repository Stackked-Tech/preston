"use client";

import { useState } from "react";
import type { CSProject } from "@/types/scheduler";

interface ProjectListProps {
  projects: CSProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (project: { name: string; address: string; pm_name: string }) => Promise<void>;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  planning: { bg: "rgba(107, 114, 128, 0.15)", text: "#9ca3af", label: "Planning" },
  active: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e", label: "Active" },
  on_hold: { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308", label: "On Hold" },
  completed: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", label: "Completed" },
};

export default function ProjectList({ projects, selectedId, onSelect, onCreate }: ProjectListProps) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPm, setNewPm] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreate({ name: newName.trim(), address: newAddress.trim(), pm_name: newPm.trim() });
    setNewName("");
    setNewAddress("");
    setNewPm("");
    setShowNew(false);
  };

  return (
    <div
      className="w-72 flex-shrink-0 border-r flex flex-col h-full"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-sans font-semibold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            Projects
          </h2>
          <button
            onClick={() => setShowNew(!showNew)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm border transition-colors"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            {showNew ? "✕" : "+"}
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-1 flex-wrap">
          {["all", "active", "planning", "on_hold", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2 py-0.5 rounded text-[10px] font-sans uppercase tracking-wider transition-colors"
              style={{
                background: filter === f ? "var(--gold)" : "transparent",
                color: filter === f ? "#000" : "var(--text-muted)",
                border: filter === f ? "none" : "1px solid var(--border-light)",
              }}
            >
              {f === "all" ? "All" : f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* New project form */}
      {showNew && (
        <form onSubmit={handleCreate} className="p-3 border-b space-y-2" style={{ borderColor: "var(--border-color)" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name *"
            className="w-full px-2 py-1.5 rounded border text-xs font-sans"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            autoFocus
          />
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Address"
            className="w-full px-2 py-1.5 rounded border text-xs font-sans"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
          <input
            type="text"
            value={newPm}
            onChange={(e) => setNewPm(e.target.value)}
            placeholder="Project Manager"
            className="w-full px-2 py-1.5 rounded border text-xs font-sans"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full py-1.5 rounded text-xs font-sans font-medium"
            style={{ background: "var(--gold)", color: "#000", opacity: newName.trim() ? 1 : 0.5 }}
          >
            Create Project
          </button>
        </form>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs font-sans text-center py-8" style={{ color: "var(--text-muted)" }}>
            No projects
          </p>
        )}
        {filtered.map((project) => {
          const badge = STATUS_BADGES[project.status] || STATUS_BADGES.planning;
          const isSelected = project.id === selectedId;
          return (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className="w-full text-left px-4 py-3 border-b transition-colors"
              style={{
                borderColor: "var(--border-light)",
                background: isSelected ? "var(--card-hover)" : "transparent",
                borderLeft: isSelected ? "3px solid var(--gold)" : "3px solid transparent",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-sans font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {project.name}
                  </p>
                  {project.address && (
                    <p className="text-[10px] font-sans truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                      📍 {project.address}
                    </p>
                  )}
                  {project.pm_name && (
                    <p className="text-[10px] font-sans truncate" style={{ color: "var(--text-muted)" }}>
                      PM: {project.pm_name}
                    </p>
                  )}
                </div>
                <span
                  className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
