"use client";

import { useEffect, useRef, useState } from "react";
import type { PCContact, PCMessage, PCScheduledMessage } from "@/types/paramount";
import { formatPhone } from "@/lib/paramountHooks";

interface MessageThreadProps {
  contact: PCContact | null;
  messages: PCMessage[];
  loading: boolean;
  sending: boolean;
  onSend: (body: string) => void;
  onEditContact: () => void;
  scheduled: PCScheduledMessage[];
  onSchedule: (body: string, scheduledAt: string) => Promise<void>;
  onCancelScheduled: (id: string) => Promise<void>;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function shouldShowDateSeparator(
  msg: PCMessage,
  prevMsg: PCMessage | null
): boolean {
  if (!prevMsg) return true;
  const d1 = new Date(msg.created_at).toDateString();
  const d2 = new Date(prevMsg.created_at).toDateString();
  return d1 !== d2;
}

function smsSegments(text: string): number {
  if (!text) return 0;
  // Simple heuristic: GSM-7 = 160 chars, Unicode = 70 chars per segment
  const isGsm = /^[\x20-\x7E\n\r]*$/.test(text);
  const limit = isGsm ? 160 : 70;
  return Math.ceil(text.length / limit);
}

function StatusIcon({ status }: { status: PCMessage["status"] }) {
  if (status === "delivered") {
    return (
      <span title="Delivered" style={{ color: "rgba(255,255,255,0.7)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 12 7 17 12 12" />
          <polyline points="10 12 15 17 22 6" />
        </svg>
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span title="Sent" style={{ color: "rgba(255,255,255,0.5)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 12 10 17 20 7" />
        </svg>
      </span>
    );
  }
  if (status === "failed" || status === "undelivered") {
    return (
      <span title={status === "failed" ? "Failed" : "Undelivered"} style={{ color: "#fca5a5" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </span>
    );
  }
  if (status === "queued") {
    return (
      <span title="Queued" style={{ color: "rgba(255,255,255,0.4)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </span>
    );
  }
  return null;
}

export default function MessageThread({
  contact,
  messages,
  loading,
  sending,
  onSend,
  onEditContact,
  scheduled,
  onSchedule,
  onCancelScheduled,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (contact) inputRef.current?.focus();
    setShowSchedule(false);
    setScheduleDate("");
  }, [contact]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !contact || sending) return;
    onSend(text);
    setInput("");
  };

  const handleSchedule = async () => {
    const text = input.trim();
    if (!text || !contact || !scheduleDate || scheduling) return;
    try {
      setScheduling(true);
      await onSchedule(text, scheduleDate);
      setInput("");
      setShowSchedule(false);
      setScheduleDate("");
    } catch {
      // Error handled in hook
    } finally {
      setScheduling(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // No contact selected
  if (!contact) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "rgba(242, 101, 57, 0.1)" }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f26539" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Select a conversation to start messaging
        </p>
      </div>
    );
  }

  const segments = smsSegments(input);

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: "rgba(66, 193, 199, 0.15)", color: "#42c1c7" }}
          >
            {contact.name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {contact.name}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatPhone(contact.phone_number)}
            </p>
          </div>
        </div>
        <button
          onClick={onEditContact}
          className="text-xs px-3 py-1 rounded-md border transition-colors"
          style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#42c1c7")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
        >
          Edit
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-muted)" }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sm" style={{ color: "var(--text-muted)" }}>
            <p>No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const isOutbound = msg.direction === "outbound";
            const showDate = shouldShowDateSeparator(msg, prevMsg);
            const showTail = !prevMsg || prevMsg.direction !== msg.direction || showDate;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center justify-center my-4">
                    <span
                      className="text-[10px] px-3 py-1 rounded-full"
                      style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}
                    >
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} ${showTail ? "mt-2" : "mt-0.5"}`}>
                  <div
                    className="max-w-[70%] px-3.5 py-2 text-sm leading-relaxed"
                    style={{
                      background: isOutbound ? "#f26539" : "var(--bg-tertiary)",
                      color: isOutbound ? "#ffffff" : "var(--text-primary)",
                      borderRadius: isOutbound
                        ? showTail ? "18px 18px 4px 18px" : "18px 4px 4px 18px"
                        : showTail ? "18px 18px 18px 4px" : "4px 18px 18px 4px",
                    }}
                  >
                    <p className="whitespace-pre-wrap break-words m-0">{msg.body}</p>
                    <p
                      className="text-[10px] mt-1 m-0 flex items-center gap-1"
                      style={{
                        color: isOutbound ? "rgba(255,255,255,0.6)" : "var(--text-muted)",
                        justifyContent: isOutbound ? "flex-end" : "flex-start",
                      }}
                    >
                      {formatTime(msg.created_at)}
                      {isOutbound && <StatusIcon status={msg.status} />}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scheduled messages bar */}
      {scheduled.length > 0 && (
        <div
          className="px-4 py-2 border-t flex flex-wrap gap-2"
          style={{ borderColor: "var(--border-light)", background: "var(--bg-secondary)" }}
        >
          <span className="text-[10px] uppercase tracking-wider self-center" style={{ color: "var(--text-muted)" }}>
            Scheduled:
          </span>
          {scheduled.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,204,50,0.15)", color: "#b8960f" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="max-w-[120px] truncate">{s.body}</span>
              <span className="opacity-60">
                {new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" "}
                {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
              <button
                onClick={() => onCancelScheduled(s.id)}
                className="opacity-50 hover:opacity-100"
                title="Cancel"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Schedule picker (inline) */}
      {showSchedule && (
        <div
          className="px-4 py-2 border-t flex items-center gap-3"
          style={{ borderColor: "var(--border-light)", background: "var(--bg-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42c1c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            className="text-sm rounded-lg border px-2 py-1 outline-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleSchedule}
            disabled={!scheduleDate || !input.trim() || scheduling}
            className="text-xs font-medium px-3 py-1 rounded-lg transition-opacity"
            style={{
              background: "#f26539",
              color: "#fff",
              opacity: !scheduleDate || !input.trim() || scheduling ? 0.5 : 1,
            }}
          >
            {scheduling ? "Scheduling..." : "Schedule"}
          </button>
          <button
            onClick={() => { setShowSchedule(false); setScheduleDate(""); }}
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border-light)" }}>
        <div
          className="flex items-end gap-2 rounded-2xl border px-3 py-2"
          style={{ background: "var(--input-bg)", borderColor: "var(--border-light)" }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none outline-none text-sm bg-transparent"
            style={{ color: "var(--text-primary)", maxHeight: 120, minHeight: 24 }}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "24px";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          {/* Schedule button */}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity"
            style={{
              color: showSchedule ? "#f26539" : "var(--text-muted)",
              opacity: input.trim() ? 1 : 0.4,
            }}
            title="Schedule message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity"
            style={{
              background: input.trim() && !sending ? "#f26539" : "var(--border-light)",
              opacity: input.trim() && !sending ? 1 : 0.5,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        {/* Character counter */}
        {input.length > 0 && (
          <div className="flex justify-end gap-3 mt-1 px-1">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {input.length} chars
            </span>
            <span className="text-[10px]" style={{ color: segments > 1 ? "#f26539" : "var(--text-muted)" }}>
              {segments} SMS segment{segments !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
