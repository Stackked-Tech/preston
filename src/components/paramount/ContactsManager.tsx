"use client";

import { useState } from "react";
import type { PCContact } from "@/types/paramount";
import { formatPhone } from "@/lib/paramountHooks";

interface ContactsManagerProps {
  contacts: PCContact[];
  loading: boolean;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => Promise<void>;
  onMessage: (id: string) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ContactsManager({
  contacts,
  loading,
  onEdit,
  onAdd,
  onDelete,
  onMessage,
}: ContactsManagerProps) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(contacts.flatMap((c) => c.tags || []))
  ).sort();

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_number.includes(search) ||
      formatPhone(c.phone_number).includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
    const matchesTag = !filterTag || c.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden font-sans"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-4 px-6 py-3 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none w-full max-w-sm"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
          {allTags.length > 0 && (
            <select
              value={filterTag || ""}
              onChange={(e) => setFilterTag(e.target.value || null)}
              className="rounded-lg border px-3 py-1.5 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "#f26539", color: "#fff" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Contact
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-40 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Loading contacts...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {search || filterTag
              ? "No contacts match your filters"
              : "No contacts yet — add your first one above"}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--border-light)" }}
              >
                {["Name", "Phone", "Email", "Tags", "Last Message", ""].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-6 py-2.5 text-[10px] font-semibold tracking-wider uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b transition-colors cursor-pointer"
                  style={{ borderColor: "var(--border-light)" }}
                  onClick={() => onEdit(contact.id)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--card-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {/* Name */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{
                          background: "rgba(66, 193, 199, 0.12)",
                          color: "#42c1c7",
                        }}
                      >
                        {contact.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {contact.name}
                      </span>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-6 py-3">
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatPhone(contact.phone_number)}
                    </span>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-3">
                    <span
                      className="text-sm"
                      style={{
                        color: contact.email
                          ? "var(--text-secondary)"
                          : "var(--text-muted)",
                      }}
                    >
                      {contact.email || "—"}
                    </span>
                  </td>

                  {/* Tags */}
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: "rgba(255,204,50,0.15)",
                            color: "#b8960f",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Last Message */}
                  <td className="px-6 py-3">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatDate(contact.last_message_at)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMessage(contact.id);
                        }}
                        className="p-1.5 rounded-md transition-colors"
                        title="Send Message"
                        style={{ color: "#42c1c7" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(66,193,199,0.1)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(contact.id);
                        }}
                        className="p-1.5 rounded-md transition-colors"
                        title="Edit Contact"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--card-hover)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Delete ${contact.name} and all their messages?`
                            )
                          ) {
                            onDelete(contact.id);
                          }
                        }}
                        className="p-1.5 rounded-md transition-colors"
                        title="Delete Contact"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(199,49,48,0.1)";
                          e.currentTarget.style.color = "#c73130";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--text-muted)";
                        }}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
