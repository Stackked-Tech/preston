"use client";

import { useState } from "react";
import type { CSTask, CSPhase, CSSub } from "@/types/scheduler";

interface TaskEditorProps {
  task: CSTask | null;
  projectId: string;
  phases: CSPhase[];
  subs: CSSub[];
  tasks: CSTask[];
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

  const inputClasses = "w-full px-3 py-2.5 rounded-xl border text-sm font-sans transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37]/50";
  const inputStyle = { background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" };
  const labelClasses = "block text-[10px] font-sans font-semibold uppercase tracking-[1.5px] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-color)",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(212, 175, 55, 0.1)" }}>
              <span className="text-sm">{task ? "✏️" : "➕"}</span>
            </div>
            <h3 className="text-base font-serif font-semibold m-0" style={{ color: "var(--text-primary)" }}>
              {task ? "Edit Task" : "New Task"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{ color: "var(--text-muted)", background: "var(--border-light)" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* ─── Section: Basic Info ─── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--gold)" }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              <span className="text-[11px] font-sans font-semibold uppercase tracking-wider" style={{ color: "var(--gold)" }}>Task Details</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Task Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className={inputClasses} style={inputStyle} placeholder="e.g. Pour Foundation" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Phase</label>
                  <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={inputClasses} style={inputStyle}>
                    <option value="">No Phase</option>
                    {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as CSTask["status"])} className={inputClasses} style={inputStyle}>
                    <option value="pending">⏳ Pending</option>
                    <option value="in_progress">🔵 In Progress</option>
                    <option value="completed">✅ Completed</option>
                    <option value="delayed">🔴 Delayed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section: Schedule ─── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--gold)" }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-[11px] font-sans font-semibold uppercase tracking-wider" style={{ color: "var(--gold)" }}>Schedule</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClasses} style={inputStyle} />
              </div>
              <div>
                <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Duration (days)</label>
                <input type="number" value={durationDays} onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))} min={1} className={inputClasses} style={inputStyle} />
              </div>
            </div>
            <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: "rgba(212, 175, 55, 0.06)" }}>
              <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>
                End date: <span className="font-medium" style={{ color: "var(--gold)" }}>
                  {new Date(endDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
              </span>
            </div>
            <div className="mt-3">
              <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Depends On</label>
              <select value={dependencyId} onChange={(e) => setDependencyId(e.target.value)} className={inputClasses} style={inputStyle}>
                <option value="">No dependency</option>
                {availableDeps.map((t) => <option key={t.id} value={t.id}>↳ {t.name}</option>)}
              </select>
            </div>
          </div>

          {/* ─── Section: Assignment ─── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--gold)" }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span className="text-[11px] font-sans font-semibold uppercase tracking-wider" style={{ color: "var(--gold)" }}>Assignment</span>
            </div>
            <select value={subId} onChange={(e) => setSubId(e.target.value)} className={inputClasses} style={inputStyle}>
              <option value="">Unassigned</option>
              {subs.map((s) => <option key={s.id} value={s.id}>👷 {s.name} — {s.trade}</option>)}
            </select>
          </div>

          {/* ─── Section: Notes ─── */}
          <div className="mb-6">
            <label className={labelClasses} style={{ color: "var(--text-muted)" }}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className={`${inputClasses} resize-none`} style={inputStyle} placeholder="Optional notes..." />
          </div>

          {/* ─── Actions ─── */}
          <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--border-light)" }}>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-sans font-semibold uppercase tracking-wider transition-all duration-200 hover:scale-[1.01]"
              style={{
                background: "var(--gold)",
                color: "#000",
                opacity: saving || !name.trim() ? 0.4 : 1,
                boxShadow: "0 2px 8px rgba(212, 175, 55, 0.25)",
              }}
            >
              {saving ? "Saving..." : task ? "Update Task" : "Create Task"}
            </button>
            {task && onDelete && (
              <button
                type="button"
                onClick={() => { if (confirm("Delete this task? Any dependent tasks will be unlinked.")) onDelete(task.id); }}
                className="px-4 py-2.5 rounded-xl text-sm font-sans font-medium border transition-all duration-200 hover:bg-red-500/10"
                style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#ef4444" }}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
