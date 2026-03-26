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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border mx-4 max-h-[85vh] overflow-hidden flex flex-col"
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
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                Notification History
              </h3>
              <p className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                {notifications.length} {notifications.length === 1 ? "notification" : "notifications"} sent
              </p>
            </div>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(212, 175, 55, 0.08)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <p className="text-sm font-sans font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                No notifications yet
              </p>
              <p className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>
                Notifications will appear here when schedule changes are sent
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div
                className="absolute left-[15px] top-0 bottom-0 w-px"
                style={{ background: "var(--border-light)" }}
              />

              <div className="space-y-4">
                {notifications.map((n) => {
                  const sub = subMap.get(n.sub_id);
                  const isSent = n.status === "sent";
                  return (
                    <div key={n.id} className="relative flex gap-4 pl-1">
                      {/* Timeline dot */}
                      <div
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 z-10"
                        style={{
                          background: isSent ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          border: `2px solid var(--bg-primary)`,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          stroke={isSent ? "#22c55e" : "#ef4444"}
                        >
                          {isSent ? (
                            <polyline points="20 6 9 17 4 12" />
                          ) : (
                            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                          )}
                        </svg>
                      </div>

                      {/* Content card */}
                      <div
                        className="flex-1 p-3.5 rounded-xl border transition-all"
                        style={{ borderColor: "var(--border-light)" }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={{
                                background: isSent ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                color: isSent ? "#22c55e" : "#ef4444",
                              }}
                            >
                              {n.status}
                            </span>
                            <span className="text-xs font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              {n.channel.toUpperCase()} → {sub?.name || "Unknown"}
                            </span>
                          </div>
                          <span className="text-[10px] font-sans tabular-nums" style={{ color: "var(--text-muted)" }}>
                            {new Date(n.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs font-sans whitespace-pre-line leading-relaxed" style={{ color: "var(--text-primary)" }}>
                          {n.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
