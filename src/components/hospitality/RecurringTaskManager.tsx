"use client";

import { useState } from "react";
import {
  useRecurringTasks,
  useProperties,
  useCategories,
  useHMUsers,
} from "@/lib/hospitalityHooks";
import type {
  HMRecurringTask,
  HMRecurringTaskInsert,
  HMPriority,
  HMFrequency,
} from "@/types/hospitality";

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.75rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
  display: "block",
};

const PRIORITIES: HMPriority[] = ["low", "medium", "high", "critical"];
const FREQUENCIES: HMFrequency[] = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];

const PRIORITY_COLORS: Record<HMPriority, { bg: string; color: string; border: string }> = {
  low: { bg: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "rgba(96,165,250,0.2)" },
  medium: { bg: "rgba(212,175,55,0.1)", color: "#d4af37", border: "rgba(212,175,55,0.2)" },
  high: { bg: "rgba(251,146,60,0.1)", color: "#fb923c", border: "rgba(251,146,60,0.2)" },
  critical: { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECURRING TASK FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface FormModalProps {
  task: HMRecurringTask | null;
  properties: { id: string; name: string }[];
  categories: { id: string; label: string }[];
  staff: { id: string; name: string }[];
  onSave: (data: HMRecurringTaskInsert) => Promise<unknown>;
  onUpdate: (id: string, data: Partial<HMRecurringTaskInsert>) => Promise<unknown>;
  onClose: () => void;
}

function RecurringTaskFormModal({
  task,
  properties,
  categories,
  staff,
  onSave,
  onUpdate,
  onClose,
}: FormModalProps) {
  const isEditing = !!task;
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    property_id: task?.property_id ?? "",
    category_id: task?.category_id ?? "",
    priority: task?.priority ?? ("medium" as HMPriority),
    frequency: task?.frequency ?? ("weekly" as HMFrequency),
    next_due_date: task?.next_due_date?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    assigned_to: task?.assigned_to ?? "",
  });
  const [saving, setSaving] = useState(false);

  const canSubmit = form.title.trim() !== "" && form.property_id !== "";

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const payload: HMRecurringTaskInsert = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        property_id: form.property_id,
        category_id: form.category_id || null,
        priority: form.priority,
        frequency: form.frequency,
        next_due_date: form.next_due_date,
        assigned_to: form.assigned_to || null,
        is_active: true,
      };
      if (isEditing && task) {
        await onUpdate(task.id, payload);
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save recurring task:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl mb-4" style={{ color: "var(--gold)" }}>
          {isEditing ? "Edit Recurring Task" : "Add Recurring Task"}
        </h2>

        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title"
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Property *</label>
              <select
                style={inputStyle}
                value={form.property_id}
                onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
              >
                <option value="">Select property...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                style={inputStyle}
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                style={inputStyle}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as HMPriority }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Frequency</label>
              <select
                style={inputStyle}
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as HMFrequency }))}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Next Due Date</label>
              <input
                style={inputStyle}
                type="date"
                value={form.next_due_date}
                onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Assigned To</label>
              <select
                style={inputStyle}
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-sans"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-4 py-2 rounded-md text-sm font-sans transition-all"
            style={{
              background: canSubmit ? "var(--gold)" : "var(--input-bg)",
              color: canSubmit ? "#0a0b0e" : "var(--text-muted)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : isEditing ? "Update" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECURRING TASK MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export default function RecurringTaskManager() {
  const {
    recurringTasks,
    loading: rtLoading,
    addRecurringTask,
    updateRecurringTask,
    toggleRecurringTaskActive,
  } = useRecurringTasks();
  const { properties, loading: propLoading } = useProperties();
  const { categories, loading: catLoading } = useCategories();
  const { users: staffUsers, loading: staffLoading } = useHMUsers("staff");

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<HMRecurringTask | null>(null);

  const loading = rtLoading || propLoading || catLoading || staffLoading;

  const getPropertyName = (id: string) => properties.find((p) => p.id === id)?.name || "Unknown";
  const getCategoryLabel = (id: string | null) => {
    if (!id) return "-";
    return categories.find((c) => c.id === id)?.label || "Unknown";
  };
  const getStaffName = (id: string | null) => {
    if (!id) return "Unassigned";
    return staffUsers.find((u) => u.id === id)?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span style={{ color: "var(--gold)" }}>Loading recurring tasks...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
          Recurring Tasks ({recurringTasks.length})
        </h2>
        <button
          onClick={() => { setEditingTask(null); setShowForm(true); }}
          className="px-4 py-2 rounded-md text-sm font-sans transition-all"
          style={{ background: "var(--gold)", color: "#0a0b0e", fontWeight: 600 }}
        >
          + Add Recurring Task
        </button>
      </div>

      <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-tertiary)" }}>
                <th className="text-left px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Title</th>
                <th className="text-left px-4 py-3 font-sans font-medium hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>Property</th>
                <th className="text-left px-4 py-3 font-sans font-medium hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>Category</th>
                <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Frequency</th>
                <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Priority</th>
                <th className="text-center px-4 py-3 font-sans font-medium hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>Next Due</th>
                <th className="text-left px-4 py-3 font-sans font-medium hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>Assigned To</th>
                <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Status</th>
                <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringTasks.map((rt, i) => {
                const priColor = PRIORITY_COLORS[rt.priority];
                const isDue = new Date(rt.next_due_date) <= new Date();
                return (
                  <tr
                    key={rt.id}
                    style={{
                      background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--card-bg)",
                      opacity: rt.is_active ? 1 : 0.5,
                    }}
                  >
                    <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{rt.title}</td>
                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                      {getPropertyName(rt.property_id)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>
                      {getCategoryLabel(rt.category_id)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
                        {rt.frequency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{
                          background: priColor.bg,
                          color: priColor.color,
                          border: `1px solid ${priColor.border}`,
                        }}
                      >
                        {rt.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span
                        className="text-xs"
                        style={{ color: isDue ? "#f87171" : "var(--text-secondary)" }}
                      >
                        {new Date(rt.next_due_date).toLocaleDateString()}
                        {isDue && " (overdue)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>
                      {getStaffName(rt.assigned_to)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: rt.is_active ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.1)",
                          color: rt.is_active ? "#4ade80" : "#9ca3af",
                          border: `1px solid ${rt.is_active ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"}`,
                        }}
                      >
                        {rt.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => { setEditingTask(rt); setShowForm(true); }}
                          className="text-xs px-2 py-1 rounded border transition-all"
                          style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleRecurringTaskActive(rt.id, !rt.is_active)}
                          className="text-xs px-2 py-1 rounded border transition-all"
                          style={{
                            borderColor: "var(--border-color)",
                            color: rt.is_active ? "#f87171" : "#4ade80",
                          }}
                        >
                          {rt.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {recurringTasks.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                    No recurring tasks yet. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <RecurringTaskFormModal
          task={editingTask}
          properties={properties.filter((p) => p.is_active)}
          categories={categories}
          staff={staffUsers.filter((u) => u.is_active)}
          onSave={addRecurringTask}
          onUpdate={updateRecurringTask}
          onClose={() => { setShowForm(false); setEditingTask(null); }}
        />
      )}
    </div>
  );
}
