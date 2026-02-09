"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProjects } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";
import { exportToPDF, exportToCSV, exportProjectToPDF, exportProjectToCSV } from "@/lib/export";
import Onboarding, { useOnboarding } from "./Onboarding";
import type { Project, Requirement, ProjectStatus, ProjectPriority } from "@/types/database";

const tagColors: Record<string, { bg: string; text: string }> = {
  platform: { bg: "#1a2f4a", text: "#5b9bd5" },
  integration: { bg: "#2a1f3d", text: "#b39ddb" },
  web: { bg: "#1a3a2a", text: "#66bb6a" },
  app: { bg: "#3d2a1a", text: "#ffb74d" },
  scheduling: { bg: "#1a3a3a", text: "#4dd0e1" },
  accounting: { bg: "#2d2d1a", text: "#dce775" },
  marketing: { bg: "#3d1a2a", text: "#f06292" },
  growth: { bg: "#1a3d1a", text: "#81c784" },
  planning: { bg: "#2a2a3d", text: "#9fa8da" },
  insurance: { bg: "#3d3d1a", text: "#fff176" },
  billing: { bg: "#2d1a3d", text: "#ce93d8" },
  "time-tracking": { bg: "#1a2d3d", text: "#4fc3f7" },
  i18n: { bg: "#3d1a1a", text: "#ef5350" },
  ux: { bg: "#1a3d2d", text: "#69f0ae" },
  invoicing: { bg: "#3d2d1a", text: "#ffa726" },
  payroll: { bg: "#1a1a3d", text: "#7986cb" },
  purchasing: { bg: "#2d3d1a", text: "#aed581" },
};

const priorityConfig = {
  high: { label: "High", color: "#ef5350", bg: "rgba(239,83,80,0.12)" },
  medium: { label: "Medium", color: "#ffb74d", bg: "rgba(255,183,77,0.12)" },
  low: { label: "Low", color: "#66bb6a", bg: "rgba(102,187,106,0.12)" },
};

const statusConfig = {
  active: { label: "Active", color: "#4dd0e1" },
  "not-launched": { label: "Not Launched", color: "#78909c" },
};

const iconOptions = ["📁", "🏢", "🧖", "🏠", "🧹", "🏗️", "🎨", "🥪", "📚", "💇", "💼", "💈", "🍽️", "🍦", "🎉", "🍕", "🏛️", "⚡", "🔧", "📊"];

// Sortable requirement item
function SortableRequirement({
  req,
  isSelected,
  onToggle,
  onSelect,
  onDelete,
  bulkMode,
}: {
  req: Requirement;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDelete: () => void;
  bulkMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: req.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-3 px-4 rounded-lg transition-all group ${
        req.done
          ? "bg-green-500/5 border border-green-500/15"
          : "border border-[var(--border-light)] hover:bg-[var(--card-hover)]"
      }`}
      {...attributes}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--gold)] mt-1"
      >
        ⋮⋮
      </div>

      {/* Bulk select checkbox */}
      {bulkMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="w-4 h-4 mt-1 accent-[var(--gold)]"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Done checkbox */}
      <div
        onClick={onToggle}
        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
          req.done
            ? "border-2 border-green-500 bg-green-500/20"
            : "border-2 border-[var(--border-light)] bg-transparent hover:border-[var(--gold)]"
        }`}
      >
        {req.done && <span className="text-green-500 text-[13px] font-bold">✓</span>}
      </div>

      <div className="flex-1">
        <span
          className={`text-sm font-sans leading-relaxed ${
            req.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]"
          }`}
        >
          {req.text}
        </span>
        {req.tags && req.tags.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {req.tags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-sans font-medium uppercase tracking-[0.8px] px-1.5 py-0.5 rounded-sm"
                style={{
                  background: tagColors[tag]?.bg || "#1a1a2e",
                  color: tagColors[tag]?.text || "#888",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 text-xs transition-all px-2"
      >
        ✕
      </button>
    </div>
  );
}

export default function ProjectTracker() {
  const {
    projects,
    loading,
    error,
    updateProject,
    createProject,
    deleteProject,
    toggleRequirement,
    addRequirement,
    deleteRequirement,
    bulkToggleRequirements,
    bulkDeleteRequirements,
    reorderRequirements,
    addComment,
    deleteComment,
    uploadAttachment,
    deleteAttachment,
    getAttachmentUrl,
  } = useProjects();

  const { theme, toggleTheme } = useTheme();
  const { showOnboarding, restartOnboarding, completeOnboarding, checked } = useOnboarding();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddRequirement, setShowAddRequirement] = useState(false);
  const [newRequirementText, setNewRequirementText] = useState("");
  const [newRequirementTags, setNewRequirementTags] = useState("");

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set());

  // Comments state
  const [newComment, setNewComment] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");

  // Tab state for detail panel
  const [activeTab, setActiveTab] = useState<"requirements" | "comments" | "attachments">("requirements");

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New project form state
  const [newProject, setNewProject] = useState({
    name: "",
    status: "active" as ProjectStatus,
    priority: "medium" as ProjectPriority,
    category: "",
    icon: "📁",
    summary: "",
    notes: "",
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Select first project when loaded
  useEffect(() => {
    if (projects.length > 0 && !selectedId) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  // Reset bulk selection when changing projects
  useEffect(() => {
    setSelectedRequirements(new Set());
    setBulkMode(false);
  }, [selectedId]);

  const selected = projects.find((p) => p.id === selectedId);

  const filteredProjects = projects.filter((p) => {
    const matchesFilter = filter === "all" || p.status === filter;
    const matchesSearch =
      searchTerm === "" ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCount = projects.filter((p) => p.status === "active").length;
  const notLaunchedCount = projects.filter((p) => p.status === "not-launched").length;
  const totalReqs = projects.reduce((sum, p) => sum + (p.requirements?.length || 0), 0);
  const doneReqs = projects.reduce(
    (sum, p) => sum + (p.requirements?.filter((r) => r.done).length || 0),
    0
  );

  const getProgress = (proj: Project) => {
    if (!proj.requirements?.length) return 0;
    return Math.round(
      (proj.requirements.filter((r) => r.done).length / proj.requirements.length) * 100
    );
  };

  const allTags = [...new Set(projects.flatMap((p) => p.requirements?.flatMap((r) => r.tags || []) || []))];

  const sharedNeeds = allTags
    .map((tag) => ({
      tag,
      count: projects.filter(
        (p) => p.status === "active" && p.requirements?.some((r) => r.tags?.includes(tag))
      ).length,
    }))
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count);

  const handleSaveNote = async () => {
    if (!selected) return;
    await updateProject(selected.id, { notes: noteText });
    setEditingNote(false);
  };

  const handleAddProject = async () => {
    if (!newProject.name.trim()) return;
    try {
      const created = await createProject(newProject);
      setSelectedId(created.id);
      setShowAddProject(false);
      setNewProject({
        name: "",
        status: "active",
        priority: "medium",
        category: "",
        icon: "📁",
        summary: "",
        notes: "",
      });
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const handleDeleteProject = async () => {
    if (!selected) return;
    if (!confirm(`Are you sure you want to delete "${selected.name}"?`)) return;
    await deleteProject(selected.id);
    setSelectedId(null);
  };

  const handleAddRequirement = async () => {
    if (!selected || !newRequirementText.trim()) return;
    const tags = newRequirementTags.split(",").map((t) => t.trim()).filter(Boolean);
    await addRequirement(selected.id, newRequirementText, tags);
    setNewRequirementText("");
    setNewRequirementTags("");
    setShowAddRequirement(false);
  };

  const handleDeleteRequirement = async (reqId: string) => {
    if (!selected) return;
    if (!confirm("Delete this requirement?")) return;
    await deleteRequirement(selected.id, reqId);
    setSelectedRequirements((prev) => {
      const next = new Set(prev);
      next.delete(reqId);
      return next;
    });
  };

  // Drag end handler for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !selected?.requirements) return;

    const oldIndex = selected.requirements.findIndex((r) => r.id === active.id);
    const newIndex = selected.requirements.findIndex((r) => r.id === over.id);

    const reordered = arrayMove(selected.requirements, oldIndex, newIndex).map((r, i) => ({
      ...r,
      sort_order: i,
    }));

    await reorderRequirements(selected.id, reordered);
  };

  // Bulk selection handlers
  const handleSelectRequirement = (reqId: string) => {
    setSelectedRequirements((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!selected?.requirements) return;
    if (selectedRequirements.size === selected.requirements.length) {
      setSelectedRequirements(new Set());
    } else {
      setSelectedRequirements(new Set(selected.requirements.map((r) => r.id)));
    }
  };

  const handleBulkMarkDone = async () => {
    if (!selected || selectedRequirements.size === 0) return;
    await bulkToggleRequirements(selected.id, Array.from(selectedRequirements), true);
    setSelectedRequirements(new Set());
    setBulkMode(false);
  };

  const handleBulkMarkUndone = async () => {
    if (!selected || selectedRequirements.size === 0) return;
    await bulkToggleRequirements(selected.id, Array.from(selectedRequirements), false);
    setSelectedRequirements(new Set());
    setBulkMode(false);
  };

  const handleBulkDelete = async () => {
    if (!selected || selectedRequirements.size === 0) return;
    if (!confirm(`Delete ${selectedRequirements.size} requirements?`)) return;
    await bulkDeleteRequirements(selected.id, Array.from(selectedRequirements));
    setSelectedRequirements(new Set());
    setBulkMode(false);
  };

  // Comment handlers
  const handleAddComment = async () => {
    if (!selected || !newComment.trim()) return;
    await addComment(selected.id, newComment, commentAuthor || "User");
    setNewComment("");
  };

  // Attachment handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.length) return;
    const file = e.target.files[0];
    try {
      await uploadAttachment(selected.id, file);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("File upload failed. Make sure Supabase Storage is configured with an 'attachments' bucket.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-xl font-sans" style={{ color: "var(--gold)" }}>Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4" style={{ background: "var(--bg-primary)" }}>
        <div className="text-red-400 text-xl font-sans">Error: {error}</div>
        <p className="text-sm font-sans max-w-md text-center" style={{ color: "var(--text-muted)" }}>
          Make sure you have created the .env.local file with your Supabase credentials
          and run the SQL schema in your Supabase dashboard.
        </p>
      </div>
    );
  }

  return (
    <div
      className="font-serif min-h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Onboarding Tutorial */}
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}

      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{
          background: "var(--bg-tertiary)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="border px-2.5 py-1.5 rounded-md text-xs font-sans transition-all no-underline"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
            title="Back to Dashboard"
          >
            ← Home
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="border px-2.5 py-1.5 rounded-md text-base font-sans transition-all"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            {sidebarOpen ? "◂" : "▸"}
          </button>
          <div>
            <h1 className="text-[22px] font-light tracking-[3px] uppercase m-0" style={{ color: "var(--gold)" }}>
              Preston Brain Dump
            </h1>
            <p className="text-[11px] font-sans tracking-[2px] uppercase mt-0.5" style={{ color: "var(--text-muted)" }}>
              Project Portfolio Tracker
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          {/* Stats */}
          <div className="flex gap-7 items-center">
            {[
              { label: "Active", value: activeCount, color: "#4dd0e1" },
              { label: "Pipeline", value: notLaunchedCount, color: "#78909c" },
              { label: "Requirements", value: `${doneReqs}/${totalReqs}`, color: "var(--gold)" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-semibold font-sans" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-[9px] uppercase tracking-[1.5px] font-sans" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Export buttons */}
          <div data-tour="export" className="flex gap-2 ml-4">
            <button
              onClick={() => exportToPDF(projects)}
              className="px-3 py-1.5 text-[10px] font-sans font-medium rounded border transition-all uppercase tracking-[1px]"
              style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
            >
              PDF
            </button>
            <button
              onClick={() => exportToCSV(projects)}
              className="px-3 py-1.5 text-[10px] font-sans font-medium rounded border transition-all uppercase tracking-[1px]"
              style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
            >
              CSV
            </button>
          </div>

          {/* Theme toggle */}
          <button
            data-tour="theme-toggle"
            onClick={toggleTheme}
            className="px-3 py-1.5 text-lg rounded border transition-all"
            style={{ borderColor: "var(--border-color)" }}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Help button */}
          <button
            onClick={restartOnboarding}
            className="px-3 py-1.5 text-lg rounded border transition-all"
            style={{ borderColor: "var(--border-color)" }}
            title="Show tutorial"
          >
            ❓
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          data-tour="sidebar"
          className={`transition-all duration-300 overflow-hidden flex flex-col ${
            sidebarOpen ? "w-[280px] min-w-[280px]" : "w-0 min-w-0"
          }`}
          style={{
            background: "var(--bg-secondary)",
            borderRight: sidebarOpen ? `1px solid var(--border-light)` : "none",
          }}
        >
          {/* Search */}
          <div className="p-4 pb-2">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-xs font-sans outline-none transition-all"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Filters */}
          <div className="px-4 py-1 pb-2.5 flex gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "not-launched", label: "Pipeline" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-2.5 py-1 text-[10px] font-sans font-medium rounded transition-all uppercase tracking-[1px]"
                style={{
                  border: `1px solid ${filter === f.key ? "var(--gold)" : "var(--border-light)"}`,
                  background: filter === f.key ? "rgba(212,175,55,0.12)" : "var(--card-bg)",
                  color: filter === f.key ? "var(--gold)" : "var(--text-muted)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Add Project Button */}
          <div className="px-4 pb-2" data-tour="add-project">
            <button
              onClick={() => setShowAddProject(true)}
              className="w-full px-3 py-2 text-xs font-sans font-medium rounded-md border transition-all flex items-center justify-center gap-2"
              style={{
                borderColor: "var(--border-color)",
                background: "rgba(212,175,55,0.1)",
                color: "var(--gold)",
              }}
            >
              <span className="text-lg">+</span> Add Project
            </button>
          </div>

          {/* Project List */}
          <div className="flex-1 overflow-auto px-2 pb-4">
            {filteredProjects.map((proj) => {
              const isSelected = proj.id === selectedId;
              const progress = getProgress(proj);
              return (
                <button
                  key={proj.id}
                  onClick={() => setSelectedId(proj.id)}
                  className={`w-full p-3 rounded-lg cursor-pointer text-left flex items-start gap-2.5 transition-all mb-0.5 border ${
                    isSelected ? "border-[var(--gold)]/20" : "border-transparent"
                  }`}
                  style={{
                    background: isSelected ? "rgba(212,175,55,0.08)" : "transparent",
                  }}
                >
                  <span className="text-xl leading-none flex-shrink-0 mt-0.5">{proj.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-sans whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {proj.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="text-[9px] font-sans uppercase tracking-[1px] opacity-70"
                        style={{ color: statusConfig[proj.status].color }}
                      >
                        {proj.category}
                      </span>
                      {proj.requirements && proj.requirements.length > 0 && (
                        <div
                          className="flex-1 h-0.5 rounded-sm overflow-hidden min-w-[30px]"
                          style={{ background: "var(--border-light)" }}
                        >
                          <div
                            className="h-full rounded-sm transition-all duration-400"
                            style={{
                              width: `${progress}%`,
                              background:
                                progress === 100 ? "#66bb6a" : progress > 0 ? "var(--gold)" : "transparent",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 opacity-70"
                    style={{ background: priorityConfig[proj.priority].color }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div
            className="flex-1 overflow-auto p-7 px-9"
            style={{ background: "var(--bg-primary)" }}
          >
            {/* Project Header */}
            <div className="mb-7">
              <div className="flex items-center gap-3.5 mb-2">
                <span className="text-4xl">{selected.icon}</span>
                <div className="flex-1">
                  <h2 className="m-0 text-[28px] font-light tracking-[1px]" style={{ color: "var(--text-primary)" }}>
                    {selected.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span
                      className="text-[10px] font-sans font-medium uppercase tracking-[1.5px] px-2.5 py-0.5 rounded"
                      style={{
                        color: statusConfig[selected.status].color,
                        background: `${statusConfig[selected.status].color}15`,
                        border: `1px solid ${statusConfig[selected.status].color}30`,
                      }}
                    >
                      {statusConfig[selected.status].label}
                    </span>
                    <span
                      className="text-[10px] font-sans font-medium uppercase tracking-[1.5px] px-2.5 py-0.5 rounded"
                      style={{
                        color: priorityConfig[selected.priority].color,
                        background: priorityConfig[selected.priority].bg,
                        border: `1px solid ${priorityConfig[selected.priority].color}30`,
                      }}
                    >
                      {priorityConfig[selected.priority].label} Priority
                    </span>
                    <span className="text-[10px] font-sans tracking-[1px] uppercase" style={{ color: "var(--text-muted)" }}>
                      {selected.category}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportProjectToPDF(selected)}
                    className="text-xs font-sans px-3 py-1.5 border rounded transition-all"
                    style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                  >
                    Export
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="text-red-400/60 hover:text-red-400 text-xs font-sans px-3 py-1.5 border border-red-400/20 rounded hover:bg-red-400/10 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-[15px] font-sans font-light leading-relaxed mt-4 max-w-[700px]" style={{ color: "var(--text-secondary)" }}>
                {selected.summary}
              </p>
            </div>

            {/* Progress Bar */}
            {selected.requirements && selected.requirements.length > 0 && (
              <div className="mb-7">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-sans uppercase tracking-[2px]" style={{ color: "var(--text-muted)" }}>
                    Progress
                  </span>
                  <span className="text-[13px] font-sans font-semibold" style={{ color: "var(--gold)" }}>
                    {getProgress(selected)}%
                  </span>
                </div>
                <div className="h-1 rounded-sm overflow-hidden" style={{ background: "var(--border-light)" }}>
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: `${getProgress(selected)}%`,
                      background:
                        getProgress(selected) === 100
                          ? "linear-gradient(90deg, #66bb6a, #81c784)"
                          : "linear-gradient(90deg, var(--gold), var(--gold-light))",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tabs */}
            <div data-tour="tabs" className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--border-light)" }}>
              {[
                { key: "requirements", label: "Requirements", count: selected.requirements?.length || 0 },
                { key: "comments", label: "Comments", count: selected.comments?.length || 0 },
                { key: "attachments", label: "Files", count: selected.attachments?.length || 0 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className="px-4 py-2 text-xs font-sans font-medium transition-all -mb-px"
                  style={{
                    color: activeTab === tab.key ? "var(--gold)" : "var(--text-muted)",
                    borderBottom: activeTab === tab.key ? "2px solid var(--gold)" : "2px solid transparent",
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Requirements Tab */}
            {activeTab === "requirements" && (
              <div className="mb-7" data-tour="requirements">
                <div className="flex items-center justify-between mb-3.5" data-tour="bulk-actions">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setBulkMode(!bulkMode);
                        setSelectedRequirements(new Set());
                      }}
                      className={`text-[10px] font-sans font-medium uppercase tracking-[1px] px-3 py-1 rounded border transition-all ${
                        bulkMode ? "bg-[var(--gold)]/15" : ""
                      }`}
                      style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
                    >
                      {bulkMode ? "Cancel" : "Select"}
                    </button>
                    {bulkMode && (
                      <>
                        <button
                          onClick={handleSelectAll}
                          className="text-[10px] font-sans uppercase tracking-[1px] px-2 py-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {selectedRequirements.size === selected.requirements?.length ? "Deselect All" : "Select All"}
                        </button>
                        {selectedRequirements.size > 0 && (
                          <>
                            <button
                              onClick={handleBulkMarkDone}
                              className="text-[10px] font-sans uppercase tracking-[1px] px-2 py-1 text-green-500"
                            >
                              ✓ Done ({selectedRequirements.size})
                            </button>
                            <button
                              onClick={handleBulkMarkUndone}
                              className="text-[10px] font-sans uppercase tracking-[1px] px-2 py-1"
                              style={{ color: "var(--text-muted)" }}
                            >
                              ○ Undone
                            </button>
                            <button
                              onClick={handleBulkDelete}
                              className="text-[10px] font-sans uppercase tracking-[1px] px-2 py-1 text-red-400"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddRequirement(true)}
                    className="text-[10px] font-sans font-medium uppercase tracking-[1px] px-3 py-1 rounded border transition-all"
                    style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
                  >
                    + Add
                  </button>
                </div>

                {/* Add Requirement Form */}
                {showAddRequirement && (
                  <div className="mb-4 p-4 border rounded-lg" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                    <input
                      type="text"
                      placeholder="Requirement text..."
                      value={newRequirementText}
                      onChange={(e) => setNewRequirementText(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm font-sans outline-none mb-2"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                    />
                    <input
                      type="text"
                      placeholder="Tags (comma-separated, e.g.: scheduling, app)"
                      value={newRequirementTags}
                      onChange={(e) => setNewRequirementTags(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm font-sans outline-none mb-3"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddRequirement}
                        className="px-4 py-1.5 text-xs font-sans font-medium rounded border transition-all"
                        style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
                      >
                        Add Requirement
                      </button>
                      <button
                        onClick={() => {
                          setShowAddRequirement(false);
                          setNewRequirementText("");
                          setNewRequirementTags("");
                        }}
                        className="px-4 py-1.5 text-xs font-sans font-medium rounded border transition-all"
                        style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Requirements List with DnD */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={selected.requirements?.map((r) => r.id) || []} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-1.5">
                      {selected.requirements?.map((req) => (
                        <SortableRequirement
                          key={req.id}
                          req={req}
                          isSelected={selectedRequirements.has(req.id)}
                          onToggle={() => toggleRequirement(selected.id, req.id)}
                          onSelect={() => handleSelectRequirement(req.id)}
                          onDelete={() => handleDeleteRequirement(req.id)}
                          bulkMode={bulkMode}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === "comments" && (
              <div className="mb-7">
                {/* Add Comment Form */}
                <div className="mb-4 p-4 border rounded-lg" style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Your name (optional)"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      className="w-32 px-3 py-2 border rounded text-sm font-sans outline-none"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm font-sans outline-none resize-y min-h-[80px] mb-2"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-1.5 text-xs font-sans font-medium rounded border transition-all disabled:opacity-50"
                    style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
                  >
                    Add Comment
                  </button>
                </div>

                {/* Comments List */}
                <div className="flex flex-col gap-3">
                  {selected.comments?.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-4 rounded-lg border group"
                      style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>
                            {comment.author}
                          </span>
                          <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                            {new Date(comment.created_at).toLocaleDateString()} at{" "}
                            {new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteComment(selected.id, comment.id)}
                          className="text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 text-xs transition-all"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-sm font-sans leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {comment.text}
                      </p>
                    </div>
                  ))}
                  {(!selected.comments || selected.comments.length === 0) && (
                    <p className="text-center py-8 text-sm font-sans" style={{ color: "var(--text-muted)" }}>
                      No comments yet. Start the discussion!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === "attachments" && (
              <div className="mb-7">
                {/* Upload Button */}
                <div className="mb-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-sans font-medium rounded border transition-all flex items-center gap-2"
                    style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
                  >
                    📎 Upload File
                  </button>
                  <p className="text-[10px] font-sans mt-2" style={{ color: "var(--text-muted)" }}>
                    Note: Requires Supabase Storage bucket named &quot;attachments&quot; to be created and set to public.
                  </p>
                </div>

                {/* Attachments List */}
                <div className="flex flex-col gap-2">
                  {selected.attachments?.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="p-3 rounded-lg border flex items-center justify-between group"
                      style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {attachment.file_type?.startsWith("image/") ? "🖼️" :
                           attachment.file_type?.includes("pdf") ? "📄" :
                           attachment.file_type?.includes("spreadsheet") || attachment.file_type?.includes("excel") ? "📊" :
                           attachment.file_type?.includes("document") || attachment.file_type?.includes("word") ? "📝" :
                           "📎"}
                        </span>
                        <div>
                          <a
                            href={getAttachmentUrl(attachment.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-sans hover:underline"
                            style={{ color: "var(--gold)" }}
                          >
                            {attachment.file_name}
                          </a>
                          <p className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                            {formatFileSize(attachment.file_size)} • {new Date(attachment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAttachment(selected.id, attachment.id, attachment.file_path)}
                        className="text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 text-xs transition-all px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {(!selected.attachments || selected.attachments.length === 0) && (
                    <p className="text-center py-8 text-sm font-sans" style={{ color: "var(--text-muted)" }}>
                      No files attached yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-7">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[10px] font-sans uppercase tracking-[2px] m-0 font-medium" style={{ color: "var(--text-muted)" }}>
                  Notes
                </h3>
                <button
                  onClick={() => {
                    if (editingNote) {
                      handleSaveNote();
                    } else {
                      setNoteText(selected.notes);
                      setEditingNote(true);
                    }
                  }}
                  className="text-[10px] font-sans font-medium uppercase tracking-[1px] px-3 py-1 rounded border transition-all"
                  style={{
                    borderColor: "var(--border-color)",
                    background: editingNote ? "rgba(212,175,55,0.15)" : "transparent",
                    color: "var(--gold)",
                  }}
                >
                  {editingNote ? "Save" : "Edit"}
                </button>
              </div>

              {editingNote ? (
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full min-h-[100px] p-3.5 border rounded-lg text-[13px] font-sans leading-relaxed outline-none resize-y"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                />
              ) : (
                <div
                  className="p-3.5 border rounded-lg text-[13px] font-sans leading-relaxed"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-light)", color: "var(--text-secondary)" }}
                >
                  {selected.notes || "No notes yet."}
                </div>
              )}
            </div>

            {/* Shared Needs Section */}
            {selected.id === projects.find((p) => p.name.includes("WHB Companies"))?.id && (
              <div>
                <h3 className="text-[10px] font-sans uppercase tracking-[2px] mb-3.5 font-medium" style={{ color: "var(--text-muted)" }}>
                  Shared Needs Across Companies
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sharedNeeds.map(({ tag, count }) => (
                    <div
                      key={tag}
                      className="px-3.5 py-2 rounded-lg flex items-center gap-2"
                      style={{
                        background: tagColors[tag]?.bg || "#1a1a2e",
                        border: `1px solid ${tagColors[tag]?.text || "#888"}25`,
                      }}
                    >
                      <span
                        className="text-xs font-sans font-medium capitalize"
                        style={{ color: tagColors[tag]?.text || "#888" }}
                      >
                        {tag.replace("-", " ")}
                      </span>
                      <span
                        className="text-[10px] font-sans font-bold opacity-60 bg-white/10 px-1.5 py-0.5 rounded-sm"
                        style={{ color: tagColors[tag]?.text || "#888" }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-sans mt-2.5 italic" style={{ color: "var(--text-muted)" }}>
                  Number indicates how many active companies share this need — opportunity for shared solutions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="border rounded-xl p-6 w-full max-w-md mx-4"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
          >
            <h2 className="text-xl font-light mb-4" style={{ color: "var(--gold)" }}>Add New Project</h2>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
              />

              <input
                type="text"
                placeholder="Category (e.g., Food & Bev, Construction)"
                value={newProject.category}
                onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm font-sans outline-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
              />

              <textarea
                placeholder="Summary..."
                value={newProject.summary}
                onChange={(e) => setNewProject({ ...newProject, summary: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm font-sans outline-none min-h-[80px] resize-y"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
              />

              <div className="flex gap-3">
                <select
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value as ProjectStatus })}
                  className="flex-1 px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                >
                  <option value="active">Active</option>
                  <option value="not-launched">Not Launched</option>
                </select>

                <select
                  value={newProject.priority}
                  onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as ProjectPriority })}
                  className="flex-1 px-3 py-2 border rounded text-sm font-sans outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-light)", color: "var(--text-primary)" }}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-sans uppercase tracking-[1px] mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  Icon
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewProject({ ...newProject, icon })}
                      className="text-xl p-2 rounded transition-all border"
                      style={{
                        background: newProject.icon === icon ? "rgba(212,175,55,0.2)" : "var(--card-bg)",
                        borderColor: newProject.icon === icon ? "var(--gold)" : "var(--border-light)",
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddProject}
                className="flex-1 px-4 py-2.5 text-sm font-sans font-medium rounded-lg border transition-all"
                style={{ borderColor: "var(--gold)", background: "rgba(212,175,55,0.15)", color: "var(--gold)" }}
              >
                Create Project
              </button>
              <button
                onClick={() => setShowAddProject(false)}
                className="px-4 py-2.5 text-sm font-sans font-medium rounded-lg border transition-all"
                style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
