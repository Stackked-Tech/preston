"use client";

import { useState, useEffect } from "react";
import type { PCContact } from "@/types/paramount";

interface ContactModalProps {
  contact: PCContact | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    phone_number: string;
    email: string;
    notes: string;
    tags: string[];
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function ContactModal({
  contact,
  open,
  onClose,
  onSave,
  onDelete,
}: ContactModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setPhone(contact.phone_number);
      setEmail(contact.email || "");
      setNotes(contact.notes || "");
      setTags(contact.tags || []);
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setTags([]);
    }
    setError(null);
  }, [contact, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        phone_number: phone.trim(),
        email: email.trim() || "",
        notes: notes.trim(),
        tags,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-sans"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="rounded-xl border shadow-2xl w-full max-w-md mx-4"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
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
            {contact ? "Edit Contact" : "New Contact"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: "var(--text-muted)" }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(199,49,48,0.1)", color: "#c73130" }}>
              {error}
            </p>
          )}

          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag..."
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-light)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: "rgba(66,193,199,0.12)", color: "#42c1c7" }}
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(255,204,50,0.15)",
                      color: "#b8960f",
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-xs leading-none opacity-60 hover:opacity-100"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
          <div>
            {contact && onDelete && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm("Delete this contact and all messages?")) {
                    await onDelete(contact.id);
                    onClose();
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "#c73130" }}
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border transition-colors"
              style={{
                borderColor: "var(--border-light)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                background: "#f26539",
                color: "#fff",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : contact ? "Update" : "Add Contact"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
