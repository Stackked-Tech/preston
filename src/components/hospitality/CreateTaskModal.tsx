"use client";

import { useState } from "react";
import type { HMProperty, HMUser, HMPriority } from "@/types/hospitality";

interface CreateTaskModalProps {
  properties: HMProperty[];
  users: HMUser[];
  onSubmit: (task: {
    property_id: string;
    title: string;
    description: string;
    priority: HMPriority;
    assigned_to: string;
    due_date: string;
  }) => Promise<unknown>;
  onClose: () => void;
  submitting: boolean;
}

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  width: "100%",
  outline: "none",
  fontSize: "0.875rem",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.75rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
  display: "block",
};

export default function CreateTaskModal({
  properties,
  users,
  onSubmit,
  onClose,
  submitting,
}: CreateTaskModalProps) {
  const [form, setForm] = useState({
    property_id: "",
    title: "",
    description: "",
    priority: "medium" as HMPriority,
    assigned_to: "",
    due_date: "",
  });
  const [error, setError] = useState<string | null>(null);

  const activeProperties = properties.filter((p) => p.is_active);
  const activeUsers = users.filter((u) => u.is_active);

  const canSubmit =
    form.property_id &&
    form.title.trim() &&
    form.description.trim() &&
    form.assigned_to &&
    form.due_date &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setError(null);
      await onSubmit({
        property_id: form.property_id,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        assigned_to: form.assigned_to,
        due_date: form.due_date,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
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
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="font-serif text-xl mb-4"
          style={{ color: "var(--gold)" }}
        >
          Create Task
        </h2>

        <div className="space-y-3">
          {/* Property */}
          <div>
            <label style={labelStyle}>Property *</label>
            <select
              style={inputStyle}
              value={form.property_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, property_id: e.target.value }))
              }
            >
              <option value="">Select property...</option>
              {activeProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Task title"
            />
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority *</label>
            <select
              style={inputStyle}
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as HMPriority,
                }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Describe the task..."
            />
          </div>

          {/* Assigned To */}
          <div>
            <label style={labelStyle}>Assigned To *</label>
            <select
              style={inputStyle}
              value={form.assigned_to}
              onChange={(e) =>
                setForm((f) => ({ ...f, assigned_to: e.target.value }))
              }
            >
              <option value="">Select user...</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label style={labelStyle}>Due Date *</label>
            <input
              type="date"
              style={inputStyle}
              value={form.due_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, due_date: e.target.value }))
              }
            />
          </div>
        </div>

        {error && (
          <p className="text-xs mt-3" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-sans"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-md text-sm font-sans font-semibold transition-all"
            style={{
              background: canSubmit ? "var(--gold)" : "var(--input-bg)",
              color: canSubmit ? "#0a0b0e" : "var(--text-muted)",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
