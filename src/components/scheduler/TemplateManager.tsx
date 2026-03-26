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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--gold)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212, 175, 55, 0.1)";
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--border-color)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border mx-4 max-h-[85vh] overflow-hidden flex flex-col"
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
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </div>
            <h3 className="text-base font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
              Schedule Templates
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Apply template */}
          {applyingId && (
            <div className="p-4 rounded-xl border mb-4" style={{ borderColor: "var(--gold)", background: "rgba(212, 175, 55, 0.03)" }}>
              <div className="flex items-center gap-2 mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-sm font-sans font-semibold" style={{ color: "var(--text-primary)" }}>
                  Choose Start Date
                </p>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border text-sm font-sans outline-none transition-all mb-3"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleApply}
                  className="flex-1 py-2.5 rounded-lg text-sm font-sans font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "var(--gold)", color: "#000" }}
                >
                  Apply Template
                </button>
                <button
                  onClick={() => setApplyingId(null)}
                  className="px-4 py-2.5 rounded-lg text-sm font-sans border transition-all"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--card-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Template list */}
          <div className="space-y-2 mb-4">
            {templates.length === 0 && !showCreate && (
              <div className="flex flex-col items-center py-10">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(212, 175, 55, 0.08)" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </div>
                <p className="text-sm font-sans font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  No templates yet
                </p>
                <p className="text-xs font-sans text-center" style={{ color: "var(--text-muted)" }}>
                  Create one to reuse schedules across projects
                </p>
              </div>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all"
                style={{ borderColor: "var(--border-light)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-light)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(212, 175, 55, 0.08)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                    {t.description && <p className="text-[10px] font-sans mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setApplyingId(t.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all active:scale-95"
                    style={{ background: "var(--gold)", color: "#000" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Apply
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete template "${t.name}"?`)) onDeleteTemplate(t.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer - Create */}
        <div className="px-6 py-4 border-t" style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}>
          {showCreate ? (
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name (e.g. Standard New Build)"
                className="w-full px-3 py-2.5 rounded-lg border text-sm font-sans outline-none transition-all"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoFocus
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg border text-sm font-sans resize-none outline-none transition-all"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 py-2.5 rounded-lg text-sm font-sans font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "var(--gold)", color: "#000", opacity: newName.trim() ? 1 : 0.4 }}
                >
                  Create Template
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-sans border transition-all"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--card-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-sans font-semibold border transition-all"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(212, 175, 55, 0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create New Template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
