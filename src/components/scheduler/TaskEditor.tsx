"use client";

import { useState, useEffect } from "react";
import type { CSTask, CSPhase, CSSub } from "@/types/scheduler";

interface TaskEditorProps {
  task: CSTask | null; // null = create mode
  projectId: string;
  phases: CSPhase[];
  subs: CSSub[];
  tasks: CSTask[]; // for dependency dropdown
  onSave: (task: Partial<CSTask> & { project_id: string }) => Promise<unknown>;
  onDelete?: (id: string) => Promise<unknown>;
  onClose: () => void;
}

export default function TaskEditor({ task, projectId, phases, subs, tasks, onSave, onDelete, onClose }: TaskEditorProps) {
  const [name, setName] = useState(task?.name || "");
  const [startDate, setStartDate] = useState(task?.start_date || new Date().toISOString().split("T")[0]);
  const [durationDays, setDurationDays] = useState(task?.duration_days || 5);
  const [phaseId, setPhaseId] = useState(task?.phase_id || "");
  const [subId, setSubId] = useState(task?.sub_id || "");
  const [dependencyId, setDependencyId] = useState(task?.dependency_id || "");
  const [status, setStatus] = useState(task?.status || "pending");
  const [notes, setNotes] = useState(task?.notes || "");
  const [saving, setSaving] = useState(false);

  // Calculate end date from start + duration
  const endDate = (() => {
    const d = new Date(startDate + "T12:00:00");
    d.setDate(d.getDate() + durationDays - 1);
    return d.toISOString().split("T")[0];
  })();

  const availableDeps = tasks.filter((t) => t.id !== task?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(task?.id ? { id: task.id } : {}),
        project_id: projectId,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        duration_days: durationDays,
        phase_id: phaseId || null,
        sub_id: subId || null,
        dependency_id: dependencyId || null,
        status: status as CSTask["status"],
        notes: notes.trim() || null,
        sort_order: task?.sort_order || tasks.length,
      });
      onClose();
    } catch (err) {
      console.error("Save task error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border p-6 mx-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
            {task ? "Edit Task" : "New Task"}
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Task Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              placeholder="e.g. Pour Foundation"
            />
          </div>

          {/* Phase */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Phase
            </label>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="">No Phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                Duration (days)
              </label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div className="text-xs font-sans px-1" style={{ color: "var(--text-muted)" }}>
            End date: <span style={{ color: "var(--gold)" }}>{new Date(endDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
          </div>

          {/* Dependency */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Depends On
            </label>
            <select
              value={dependencyId}
              onChange={(e) => setDependencyId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="">None</option>
              {availableDeps.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Sub */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Assigned Subcontractor
            </label>
            <select
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="">Unassigned</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.trade}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CSTask["status"])}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans resize-none"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-sans font-medium transition-opacity"
              style={{ background: "var(--gold)", color: "#000", opacity: saving ? 0.5 : 1 }}
            >
              {saving ? "Saving..." : task ? "Update Task" : "Create Task"}
            </button>
            {task && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this task?")) onDelete(task.id);
                }}
                className="px-4 py-2 rounded-lg text-sm font-sans border"
                style={{ borderColor: "#ef4444", color: "#ef4444" }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-sans border"
              style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
