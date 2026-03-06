"use client";

import { useState } from "react";
import type { PCContact } from "@/types/paramount";
import { formatPhone } from "@/lib/paramountHooks";

interface ConversationListProps {
  contacts: PCContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewContact: () => void;
  onBulkMessage: () => void;
  loading: boolean;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ConversationList({
  contacts,
  selectedId,
  onSelect,
  onNewContact,
  onBulkMessage,
  loading,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_number.includes(search) ||
      formatPhone(c.phone_number).includes(search)
  );

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{ borderColor: "var(--border-light)", width: 340 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <h2
          className="text-sm font-semibold font-sans tracking-wide"
          style={{ color: "var(--text-primary)" }}
        >
          Messages
        </h2>
        <div className="flex gap-1">
          <button
            onClick={onBulkMessage}
            className="px-2 py-1 rounded text-xs font-sans transition-colors"
            style={{ color: "#42c1c7" }}
            title="Bulk Message"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button
            onClick={onNewContact}
            className="px-2 py-1 rounded text-xs font-sans transition-colors"
            style={{ color: "#42c1c7" }}
            title="New Contact"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg px-3 py-1.5 text-sm outline-none border font-sans"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--border-light)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-32 text-sm font-sans"
            style={{ color: "var(--text-muted)" }}
          >
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-32 text-sm font-sans px-4 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            {search ? "No matching contacts" : "No conversations yet"}
          </div>
        ) : (
          filtered.map((contact) => {
            const isSelected = contact.id === selectedId;
            return (
              <button
                key={contact.id}
                onClick={() => onSelect(contact.id)}
                className="w-full text-left px-4 py-3 border-b transition-colors"
                style={{
                  borderColor: "var(--border-light)",
                  background: isSelected
                    ? "rgba(242, 101, 57, 0.1)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "var(--card-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold font-sans flex-shrink-0"
                      style={{
                        background: isSelected
                          ? "#42c1c7"
                          : "rgba(66, 193, 199, 0.15)",
                        color: isSelected ? "#fff" : "#42c1c7",
                      }}
                    >
                      {contact.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium font-sans truncate"
                        style={{
                          color: isSelected
                            ? "#f26539"
                            : "var(--text-primary)",
                        }}
                      >
                        {contact.name}
                      </p>
                      <p
                        className="text-xs font-sans truncate mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {contact.last_message_preview ||
                          formatPhone(contact.phone_number)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {contact.last_message_at && (
                      <span
                        className="text-[10px] font-sans"
                        style={{ color: contact.unread_count > 0 ? "#f26539" : "var(--text-muted)" }}
                      >
                        {timeAgo(contact.last_message_at)}
                      </span>
                    )}
                    {contact.unread_count > 0 && (
                      <span
                        className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: "#f26539", color: "#fff" }}
                      >
                        {contact.unread_count > 99 ? "99+" : contact.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
