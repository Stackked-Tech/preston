"use client";

import { useState, useEffect } from "react";
import type {
  HMRequestWithDetails,
  HMUser,
  HMPriority,
  HMUrgency,
} from "@/types/hospitality";

interface ApprovalModalProps {
  request: HMRequestWithDetails | null;
  staffUsers: HMUser[];
  onApprove: (edits?: {
    priority: HMPriority;
    due_date?: string;
    assigned_to?: string;
    manager_notes?: string;
  }) => Promise<void>;
  onClose: () => void;
  mode: "approve" | "edit";
  processing: boolean;
}

const URGENCY_TO_PRIORITY: Record<HMUrgency, HMPriority> = {
  routine: "medium",
  urgent: "high",
  emergency: "critical",
};

export default function ApprovalModal({
  request,
  staffUsers,
  onApprove,
  onClose,
  mode,
  processing,
}: ApprovalModalProps) {
  const [priority, setPriority] = useState<HMPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when request or mode changes
  useEffect(() => {
    if (request) {
      setPriority(URGENCY_TO_PRIORITY[request.urgency]);
      setDueDate("");
      setAssignedTo("");
      setManagerNotes("");
      setError(null);
    }
  }, [request, mode]);

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (mode === "edit") {
        await onApprove({
          priority,
          due_date: dueDate || undefined,
          assigned_to: assignedTo || undefined,
          manager_notes: managerNotes || undefined,
        });
      } else {
        await onApprove();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-sans"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="rounded-xl border shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-light)" }}
        >
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {mode === "edit" ? "Approve with Edits" : "Approve Request"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: "var(--text-muted)" }}
          >
            &times;
          </button>
        </div>

        {/* Request Summary */}
        <div
          className="px-5 py-3 border-b"
          style={{
            borderColor: "var(--border-light)",
            background: "var(--card-bg)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {request.property?.name || "Unknown Property"}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background:
                  request.urgency === "emergency"
                    ? "rgba(239, 68, 68, 0.15)"
                    : request.urgency === "urgent"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(255,255,255,0.08)",
                color:
                  request.urgency === "emergency"
                    ? "#ef4444"
                    : request.urgency === "urgent"
                    ? "#f59e0b"
                    : "var(--text-secondary)",
              }}
            >
              {request.urgency}
            </span>
          </div>
          {request.category && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border inline-block mb-2"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
            >
              {request.category.label}
            </span>
          )}
          <p
            className="text-xs line-clamp-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {request.description}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {error && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{ background: "rgba(199,49,48,0.1)", color: "#c73130" }}
            >
              {error}
            </p>
          )}

          {mode === "edit" ? (
            <>
              {/* Priority */}
              <div>
                <label
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as HMPriority)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Assign To */}
              <div>
                <label
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Assign To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">Unassigned</option>
                  {staffUsers
                    .filter((u) => u.is_active)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Manager Notes */}
              <div>
                <label
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Manager Notes
                </label>
                <textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Optional notes for the maintenance team..."
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </>
          ) : (
            <div
              className="text-sm py-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="mb-2">
                This will approve the request and create a maintenance task with:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>
                  Priority:{" "}
                  <span
                    className="font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {URGENCY_TO_PRIORITY[request.urgency]}
                  </span>{" "}
                  (auto-mapped from {request.urgency})
                </li>
                <li>No specific due date</li>
                <li>Unassigned (can be assigned later from Task Board)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{
              borderColor: "var(--border-light)",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: processing ? 0.6 : 1,
            }}
          >
            {processing
              ? "Processing..."
              : mode === "edit"
              ? "Approve with Edits"
              : "Approve Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
