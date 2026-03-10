"use client";

import { useState, useEffect } from "react";
import type { HMRequestWithDetails } from "@/types/hospitality";

interface RejectionModalProps {
  request: HMRequestWithDetails | null;
  onReject: (notes: string) => Promise<void>;
  onClose: () => void;
  processing: boolean;
}

export default function RejectionModal({
  request,
  onReject,
  onClose,
  processing,
}: RejectionModalProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when request changes
  useEffect(() => {
    if (request) {
      setNotes("");
      setError(null);
    }
  }, [request]);

  if (!request) return null;

  const propertyName = request.property?.name || "the property";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Rejection notes are required");
      return;
    }
    try {
      setError(null);
      await onReject(notes.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-sans"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
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
            style={{ color: "#ef4444" }}
          >
            Reject Request
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

        {/* Request Summary */}
        <div
          className="px-5 py-3 border-b"
          style={{
            borderColor: "var(--border-light)",
            background: "var(--card-bg)",
          }}
        >
          <p
            className="text-sm font-medium mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {propertyName}
          </p>
          {request.category && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border inline-block mb-2"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
            >
              {request.category.label}
            </span>
          )}
          <p
            className="text-xs line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {request.description}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {error && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{ background: "rgba(199,49,48,0.1)", color: "#c73130" }}
            >
              {error}
            </p>
          )}

          {/* Rejection Notes */}
          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Rejection Notes *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why this request is being rejected..."
              rows={4}
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* SMS Preview */}
          {request.contact_phone && notes.trim() && (
            <div
              className="rounded-lg p-3 border"
              style={{
                borderColor: "var(--border-light)",
                background: "var(--card-bg)",
              }}
            >
              <p
                className="text-[10px] font-medium uppercase tracking-wider mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                SMS Preview
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                To: {request.contact_phone}
              </p>
              <p
                className="text-xs mt-1 italic"
                style={{ color: "var(--text-secondary)" }}
              >
                &ldquo;Your maintenance request at {propertyName} was not
                approved: {notes.trim()}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
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
            disabled={processing || !notes.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: "#ef4444",
              color: "#fff",
              opacity: processing || !notes.trim() ? 0.6 : 1,
            }}
          >
            {processing ? "Sending..." : "Send Rejection"}
          </button>
        </div>
      </form>
    </div>
  );
}
