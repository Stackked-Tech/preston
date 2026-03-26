"use client";

import { useState } from "react";
import type { CSTemplate } from "@/types/scheduler";

interface TemplateManagerProps {
  templates: CSTemplate[];
  onApplyTemplate: (templateId: string, startDate: string) => Promise<unknown>;
  onCreateTemplate: (name: string, description: string) => Promise<unknown>;
  onDeleteTemplate: (id: string) => Promise<unknown>;
  onClose: () => void;
}

export default function TemplateManager({ templates, onApplyTemplate, onCreateTemplate, onDeleteTemplate, onClose }: TemplateManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreateTemplate(newName.trim(), newDesc.trim());
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
  };

  const handleApply = async () => {
    if (!applyingId || !startDate) return;
    await onApplyTemplate(applyingId, startDate);
    setApplyingId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border p-6 mx-4 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
            Schedule Templates
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Apply template */}
        {applyingId && (
          <div className="p-4 rounded-lg border mb-4" style={{ borderColor: "var(--gold)", background: "rgba(212, 175, 55, 0.05)" }}>
            <p className="text-sm font-sans font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              Apply Template — Choose Start Date
            </p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans mb-3"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                className="flex-1 py-2 rounded-lg text-sm font-sans font-medium"
                style={{ background: "var(--gold)", color: "#000" }}
              >
                Apply Template
              </button>
              <button
                onClick={() => setApplyingId(null)}
                className="px-4 py-2 rounded-lg text-sm font-sans border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Template list */}
        <div className="space-y-2 mb-4">
          {templates.length === 0 && !showCreate && (
            <p className="text-sm font-sans text-center py-6" style={{ color: "var(--text-muted)" }}>
              No templates yet. Create one to reuse schedules across projects.
            </p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 rounded-lg border" style={{ borderColor: "var(--border-light)" }}>
              <div>
                <p className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                {t.description && <p className="text-[10px] font-sans mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setApplyingId(t.id)}
                  className="px-3 py-1 rounded text-xs font-sans"
                  style={{ background: "var(--gold)", color: "#000" }}
                >
                  Apply
                </button>
                <button
                  onClick={() => { if (confirm(`Delete template "${t.name}"?`)) onDeleteTemplate(t.id); }}
                  className="px-2 py-1 rounded text-xs font-sans"
                  style={{ color: "#ef4444" }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create template */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name (e.g. Standard New Build)"
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              autoFocus
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans resize-none"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={!newName.trim()} className="flex-1 py-2 rounded-lg text-sm font-sans font-medium"
                style={{ background: "var(--gold)", color: "#000" }}>
                Create Template
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-sans border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2 rounded-lg text-sm font-sans font-medium border"
            style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
          >
            + Create New Template
          </button>
        )}
      </div>
    </div>
  );
}
