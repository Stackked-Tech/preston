"use client";

import { useState } from "react";
import type { PCBroadcast, PCBroadcastRecipient } from "@/types/paramount";
import { formatPhone } from "@/lib/paramountHooks";

interface BroadcastHistoryProps {
  broadcasts: PCBroadcast[];
  loading: boolean;
  onFetchRecipients: (broadcastId: string) => Promise<
    (PCBroadcastRecipient & {
      pc_contacts: { name: string; phone_number: string } | null;
    })[]
  >;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BroadcastHistory({
  broadcasts,
  loading,
  onFetchRecipients,
}: BroadcastHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<
    (PCBroadcastRecipient & {
      pc_contacts: { name: string; phone_number: string } | null;
    })[]
  >([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingRecipients(true);
    try {
      const data = await onFetchRecipients(id);
      setRecipients(data);
    } finally {
      setLoadingRecipients(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-3 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="pc-heading text-sm font-semibold tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Broadcast History
          </h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {broadcasts.length} broadcast{broadcasts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-40 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Loading broadcasts...
          </div>
        ) : broadcasts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No broadcasts sent yet
          </div>
        ) : (
          broadcasts.map((bc) => (
            <div key={bc.id}>
              <button
                onClick={() => handleExpand(bc.id)}
                className="w-full text-left px-6 py-4 border-b transition-colors"
                style={{ borderColor: "var(--border-light)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--card-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {bc.name || "Untitled Broadcast"}
                    </p>
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {bc.body}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatDate(bc.sent_at)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(66,193,199,0.12)",
                        color: "#42c1c7",
                      }}
                    >
                      {bc.recipient_count} recipient
                      {bc.recipient_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: expandedId === bc.id ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s",
                    }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span
                    className="text-[10px] ml-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {expandedId === bc.id ? "Hide" : "Show"} recipients
                  </span>
                </div>
              </button>

              {/* Expanded recipients */}
              {expandedId === bc.id && (
                <div
                  className="px-6 py-3 border-b"
                  style={{
                    borderColor: "var(--border-light)",
                    background: "var(--bg-secondary)",
                  }}
                >
                  {loadingRecipients ? (
                    <p
                      className="text-xs py-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Loading...
                    </p>
                  ) : recipients.length === 0 ? (
                    <p
                      className="text-xs py-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No recipient data
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {recipients.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-xs py-1"
                        >
                          <div className="flex items-center gap-2">
                            <span style={{ color: "var(--text-primary)" }}>
                              {r.pc_contacts?.name || "Unknown"}
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>
                              {r.pc_contacts
                                ? formatPhone(r.pc_contacts.phone_number)
                                : ""}
                            </span>
                          </div>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background:
                                r.status === "delivered"
                                  ? "rgba(66,193,199,0.12)"
                                  : r.status === "failed"
                                    ? "rgba(199,49,48,0.1)"
                                    : r.status === "sent"
                                      ? "rgba(255,204,50,0.15)"
                                      : "var(--card-bg)",
                              color:
                                r.status === "delivered"
                                  ? "#42c1c7"
                                  : r.status === "failed"
                                    ? "#c73130"
                                    : r.status === "sent"
                                      ? "#b8960f"
                                      : "var(--text-muted)",
                            }}
                          >
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
