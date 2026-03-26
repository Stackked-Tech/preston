"use client";

import { useState } from "react";
import type { CSSub } from "@/types/scheduler";
import { formatDateShort } from "@/lib/schedulerHooks";

interface ScheduleChange {
  taskId: string;
  subId: string;
  taskName: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
}

interface NotificationReviewProps {
  changes: ScheduleChange[];
  subs: CSSub[];
  projectName: string;
  onSend: (subIds: string[]) => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
}

export default function NotificationReview({ changes, subs, projectName, onSend, onSkip, onClose }: NotificationReviewProps) {
  const subMap = new Map(subs.map((s) => [s.id, s]));

  // Group changes by sub
  const bySubId = new Map<string, ScheduleChange[]>();
  for (const c of changes) {
    const existing = bySubId.get(c.subId) || [];
    existing.push(c);
    bySubId.set(c.subId, existing);
  }

  const subIds = Array.from(bySubId.keys());
  const [selected, setSelected] = useState<Set<string>>(new Set(subIds));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const toggleSub = (subId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === subIds.length) setSelected(new Set());
    else setSelected(new Set(subIds));
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await onSend(Array.from(selected));
      setSent(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error("Send notifications error:", err);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          className="w-full max-w-md rounded-2xl border p-8 mx-4 text-center"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-lg font-serif font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Notifications Sent!
          </h3>
          <p className="text-sm font-sans" style={{ color: "var(--text-muted)" }}>
            {selected.size} sub{selected.size !== 1 ? "s" : ""} notified of schedule changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border mx-4 max-h-[85vh] overflow-hidden flex flex-col"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(212, 175, 55, 0.1)" }}>
                <span className="text-lg">🔔</span>
              </div>
              <div>
                <h3 className="text-base font-serif font-semibold m-0" style={{ color: "var(--text-primary)" }}>
                  Review Schedule Changes
                </h3>
                <p className="text-xs font-sans m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {projectName} · {changes.length} task{changes.length !== 1 ? "s" : ""} affected
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "var(--text-muted)", background: "var(--border-light)" }}>✕</button>
          </div>
        </div>

        {/* Info banner */}
        <div className="px-6 py-3" style={{ background: "rgba(212, 175, 55, 0.04)" }}>
          <p className="text-xs font-sans m-0" style={{ color: "var(--text-muted)" }}>
            The following schedule changes will affect subcontractors. Select which subs to notify via SMS{bySubId.size > 0 && Array.from(bySubId.keys()).some((id) => subMap.get(id)?.email) ? " and email" : ""}.
          </p>
        </div>

        {/* Sub list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Select all */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-sans font-medium" style={{ color: "var(--gold)" }}>
              <div
                className="w-4 h-4 rounded border flex items-center justify-center transition-all duration-200"
                style={{
                  borderColor: selected.size === subIds.length ? "var(--gold)" : "var(--border-color)",
                  background: selected.size === subIds.length ? "var(--gold)" : "transparent",
                }}
              >
                {selected.size === subIds.length && <span className="text-[10px] text-black">✓</span>}
              </div>
              {selected.size === subIds.length ? "Deselect All" : "Select All"}
            </button>
            <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
              {selected.size} of {subIds.length} selected
            </span>
          </div>

          <div className="space-y-3">
            {subIds.map((subId) => {
              const sub = subMap.get(subId);
              const subChanges = bySubId.get(subId) || [];
              const isSelected = selected.has(subId);

              return (
                <div
                  key={subId}
                  className="rounded-xl border transition-all duration-200"
                  style={{
                    borderColor: isSelected ? "rgba(212, 175, 55, 0.3)" : "var(--border-light)",
                    background: isSelected ? "rgba(212, 175, 55, 0.03)" : "var(--card-bg)",
                  }}
                >
                  {/* Sub header */}
                  <button
                    onClick={() => toggleSub(subId)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <div
                      className="w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 flex-shrink-0"
                      style={{
                        borderColor: isSelected ? "var(--gold)" : "var(--border-color)",
                        background: isSelected ? "var(--gold)" : "transparent",
                      }}
                    >
                      {isSelected && <span className="text-xs text-black font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>
                          {sub?.name || "Unknown Sub"}
                        </span>
                        <span className="text-[9px] font-sans px-1.5 py-0.5 rounded-full" style={{ background: "rgba(212, 175, 55, 0.12)", color: "var(--gold)" }}>
                          {sub?.trade}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                          📱 {sub?.phone}
                        </span>
                        {sub?.email && (
                          <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                            ✉ {sub.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
                      {subChanges.length} change{subChanges.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {/* Change details */}
                  <div className="px-4 pb-3 pt-0 ml-8">
                    {subChanges.map((change) => (
                      <div key={change.taskId} className="flex items-center gap-2 py-1.5 border-t" style={{ borderColor: "var(--border-light)" }}>
                        <span className="text-xs font-sans flex-1" style={{ color: "var(--text-primary)" }}>
                          {change.taskName}
                        </span>
                        <span className="text-[10px] font-sans line-through" style={{ color: "#ef4444", opacity: 0.7 }}>
                          {formatDateShort(change.oldStart)}–{formatDateShort(change.oldEnd)}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>→</span>
                        <span className="text-[10px] font-sans font-medium" style={{ color: "#22c55e" }}>
                          {formatDateShort(change.newStart)}–{formatDateShort(change.newEnd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-sans font-semibold uppercase tracking-wider transition-all duration-200"
            style={{
              background: "var(--gold)",
              color: "#000",
              opacity: sending || selected.size === 0 ? 0.4 : 1,
              boxShadow: selected.size > 0 ? "0 2px 8px rgba(212, 175, 55, 0.25)" : "none",
            }}
          >
            {sending ? "Sending..." : `Notify ${selected.size} Sub${selected.size !== 1 ? "s" : ""}`}
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2.5 rounded-xl text-sm font-sans font-medium border transition-all duration-200"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Skip — Save Without Notifying
          </button>
        </div>
      </div>
    </div>
  );
}
