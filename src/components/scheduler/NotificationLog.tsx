"use client";

import type { CSNotification, CSSub } from "@/types/scheduler";

interface NotificationLogProps {
  notifications: CSNotification[];
  subs: CSSub[];
  onClose: () => void;
}

export default function NotificationLog({ notifications, subs, onClose }: NotificationLogProps) {
  const subMap = new Map(subs.map((s) => [s.id, s]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border p-6 mx-4 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
            Notification History
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm font-sans text-center py-8" style={{ color: "var(--text-muted)" }}>
            No notifications sent yet
          </p>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const sub = subMap.get(n.sub_id);
              return (
                <div key={n.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--border-light)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-full uppercase"
                        style={{
                          background: n.status === "sent" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: n.status === "sent" ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {n.status}
                      </span>
                      <span className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>
                        {n.channel.toUpperCase()} → {sub?.name || "Unknown"}
                      </span>
                    </div>
                    <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                      {new Date(n.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs font-sans whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
                    {n.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
