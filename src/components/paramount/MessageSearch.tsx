"use client";

import { useState, useRef, useEffect } from "react";
import type { SearchResult } from "@/lib/paramountHooks";
import { formatPhone } from "@/lib/paramountHooks";

interface MessageSearchProps {
  open: boolean;
  onClose: () => void;
  results: SearchResult[];
  searching: boolean;
  onSearch: (query: string) => void;
  onSelectContact: (contactId: string) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: "rgba(242, 101, 57, 0.25)",
          color: "inherit",
          borderRadius: 2,
          padding: "0 1px",
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function MessageSearch({
  open,
  onClose,
  results,
  searching,
  onSearch,
  onSelectContact,
}: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl border shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
          maxHeight: "60vh",
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border-light)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search all messages..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "var(--text-primary)" }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); onSearch(""); }}
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-0.5 rounded border"
            style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
              Searching...
            </div>
          ) : !query.trim() ? (
            <div className="flex items-center justify-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
              Type to search across all messages
            </div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
              No messages found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelectContact(r.contact_id);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 border-b transition-colors"
                style={{ borderColor: "var(--border-light)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--card-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium" style={{ color: "#42c1c7" }}>
                    {r.pc_contacts?.name || "Unknown"}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {r.pc_contacts ? formatPhone(r.pc_contacts.phone_number) : ""}
                  </span>
                  <span
                    className="text-[10px] ml-auto"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {new Date(r.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                  <span
                    className="text-[10px] mr-1"
                    style={{ color: r.direction === "outbound" ? "#f26539" : "var(--text-muted)" }}
                  >
                    {r.direction === "outbound" ? "You:" : "Them:"}
                  </span>
                  {highlightMatch(r.body, query)}
                </p>
              </button>
            ))
          )}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t text-center" style={{ borderColor: "var(--border-light)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {results.length} result{results.length !== 1 ? "s" : ""}{results.length >= 50 ? " (showing first 50)" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
