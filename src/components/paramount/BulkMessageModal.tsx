"use client";

import { useState, useEffect } from "react";
import type { PCContact } from "@/types/paramount";
import { formatPhone } from "@/lib/paramountHooks";

interface BulkMessageModalProps {
  contacts: PCContact[];
  open: boolean;
  onClose: () => void;
  onSend: (contactIds: string[], body: string) => Promise<void>;
  sending: boolean;
  progress: { sent: number; failed: number; total: number } | null;
}

export default function BulkMessageModal({
  contacts,
  open,
  onClose,
  onSend,
  sending,
  progress,
}: BulkMessageModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const activeContacts = contacts.filter((c) => c.is_active);
  const allTags = Array.from(
    new Set(activeContacts.flatMap((c) => c.tags || []))
  ).sort();
  const filtered = activeContacts.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_number.includes(search);
    const matchesTag = !filterTag || c.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setBody("");
      setSearch("");
      setFilterTag(null);
    }
  }, [open]);

  const selectByTag = (tag: string) => {
    setFilterTag(tag);
    const tagContacts = activeContacts.filter((c) => c.tags?.includes(tag));
    setSelectedIds(new Set(tagContacts.map((c) => c.id)));
  };

  if (!open) return null;

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleSend = async () => {
    if (selectedIds.size === 0 || !body.trim()) return;
    await onSend(Array.from(selectedIds), body.trim());
  };

  const allSelected =
    filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-sans"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl border shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-light)" }}
        >
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Bulk Message
          </h3>
          <button
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: "var(--text-muted)" }}
          >
            &times;
          </button>
        </div>

        {/* Message */}
        <div
          className="px-5 py-3 border-b"
          style={{ borderColor: "var(--border-light)" }}
        >
          <label
            className="text-xs font-medium mb-1 block"
            style={{ color: "var(--text-secondary)" }}
          >
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex justify-between mt-1">
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {body.length} / 1600 characters
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {Math.ceil(body.length / 160) || 0} SMS segment
              {Math.ceil(body.length / 160) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Contact Selection */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-5 py-2 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={toggleAll}
              className="text-xs font-medium whitespace-nowrap"
              style={{ color: "#42c1c7" }}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          {/* Tag quick-select */}
          {allTags.length > 0 && (
            <div className="px-5 pb-1 flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    filterTag === tag ? setFilterTag(null) : selectByTag(tag)
                  }
                  className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                  style={{
                    background:
                      filterTag === tag
                        ? "rgba(242,101,57,0.15)"
                        : "rgba(255,204,50,0.12)",
                    color: filterTag === tag ? "#f26539" : "#b8960f",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div
            className="text-xs px-5 pb-1"
            style={{ color: "var(--text-muted)" }}
          >
            {selectedIds.size} of {activeContacts.length} selected
            {filterTag && (
              <span style={{ color: "#f26539" }}> (filtered by: {filterTag})</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-3">
            {filtered.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-3 py-2 cursor-pointer border-b"
                style={{ borderColor: "var(--border-light)" }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "#f26539" }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {contact.name}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatPhone(contact.phone_number)}
                  </p>
                </div>
                {contact.tags?.length > 0 && (
                  <div className="flex gap-1">
                    {contact.tags.slice(0, 2).map((tag) => (
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
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t flex items-center justify-between"
          style={{ borderColor: "var(--border-light)" }}
        >
          {progress ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Sent: {progress.sent} · Failed: {progress.failed} · Total:{" "}
              {progress.total}
            </p>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{
                borderColor: "var(--border-light)",
                color: "var(--text-secondary)",
              }}
            >
              {progress ? "Done" : "Cancel"}
            </button>
            {!progress && (
              <button
                onClick={handleSend}
                disabled={sending || selectedIds.size === 0 || !body.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{
                  background: "#f26539",
                  color: "#fff",
                  opacity:
                    sending || selectedIds.size === 0 || !body.trim()
                      ? 0.5
                      : 1,
                }}
              >
                {sending
                  ? "Sending..."
                  : `Send to ${selectedIds.size} contact${selectedIds.size !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
