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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border mx-4 overflow-hidden"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(212, 175, 55, 0.1)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <h3 className="text-base font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
              Manage Phases
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--card-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Existing phases */}
        <div className="px-6 py-4 max-h-60 overflow-y-auto">
          {phases.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                style={{ background: "rgba(212, 175, 55, 0.08)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>
                No phases yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all"
                  style={{ borderColor: "var(--border-light)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ background: phase.color, boxShadow: `0 2px 6px ${phase.color}40` }}
                  />
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
                      className="flex-1 px-2 py-1 rounded-lg border text-sm font-sans outline-none transition-all"
                      style={{ background: "var(--card-bg)", borderColor: "var(--gold)", color: "var(--text-primary)", boxShadow: "0 0 0 3px rgba(212, 175, 55, 0.1)" }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm font-sans font-medium cursor-pointer"
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <form onSubmit={handleCreate} className="px-6 py-4 border-t" style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Phase name (e.g. Foundation)"
            className="w-full px-3 py-2.5 rounded-lg border text-sm font-sans outline-none transition-all mb-3"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212, 175, 55, 0.1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Color</span>
            <div className="flex items-center gap-1.5">
              {PHASE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-6 h-6 rounded-full transition-all"
                  style={{
                    background: c,
                    transform: newColor === c ? "scale(1.25)" : "scale(1)",
                    boxShadow: newColor === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-sans font-semibold transition-all active:scale-[0.98]"
            style={{ background: "var(--gold)", color: "#000", opacity: newName.trim() ? 1 : 0.4 }}
          >
            Add Phase
          </button>
        </form>
      </div>
    </div>
  );
}
