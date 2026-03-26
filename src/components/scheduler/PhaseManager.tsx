"use client";

import { useState } from "react";
import type { CSPhase } from "@/types/scheduler";

interface PhaseManagerProps {
  phases: CSPhase[];
  onCreatePhase: (name: string, color: string) => Promise<unknown>;
  onUpdatePhase: (id: string, updates: Partial<CSPhase>) => Promise<unknown>;
  onDeletePhase: (id: string) => Promise<unknown>;
  onClose: () => void;
}

const PHASE_COLORS = ["#d4af37", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899", "#6b7280"];

export default function PhaseManager({ phases, onCreatePhase, onUpdatePhase, onDeletePhase, onClose }: PhaseManagerProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PHASE_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreatePhase(newName.trim(), newColor);
    setNewName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border p-6 mx-4"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
            Manage Phases
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Existing phases */}
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {phases.length === 0 && (
            <p className="text-xs font-sans py-4 text-center" style={{ color: "var(--text-muted)" }}>
              No phases yet
            </p>
          )}
          {phases.map((phase) => (
            <div
              key={phase.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: "var(--border-light)" }}
            >
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: phase.color }} />
              {editingId === phase.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={async () => {
                    if (editName.trim()) await onUpdatePhase(phase.id, { name: editName.trim() });
                    setEditingId(null);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && editName.trim()) {
                      await onUpdatePhase(phase.id, { name: editName.trim() });
                      setEditingId(null);
                    }
                  }}
                  className="flex-1 px-2 py-0.5 rounded border text-xs font-sans"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-sm font-sans cursor-pointer"
                  style={{ color: "var(--text-primary)" }}
                  onClick={() => {
                    setEditingId(phase.id);
                    setEditName(phase.name);
                  }}
                >
                  {phase.name}
                </span>
              )}
              <button
                onClick={() => {
                  if (confirm(`Delete phase "${phase.name}"?`)) onDeletePhase(phase.id);
                }}
                className="text-xs"
                style={{ color: "#ef4444" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <form onSubmit={handleCreate} className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Phase name (e.g. Foundation)"
            className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>Color:</span>
            {PHASE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-transform"
                style={{
                  background: c,
                  borderColor: newColor === c ? "var(--text-primary)" : "transparent",
                  transform: newColor === c ? "scale(1.2)" : "scale(1)",
                }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full py-2 rounded-lg text-sm font-sans font-medium"
            style={{ background: "var(--gold)", color: "#000", opacity: newName.trim() ? 1 : 0.5 }}
          >
            Add Phase
          </button>
        </form>
      </div>
    </div>
  );
}
