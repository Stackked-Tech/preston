"use client";

import { useState, useMemo } from "react";
import type { STSEnvelope, EnvelopeStatus } from "@/types/signedtosealed";
import { STATUS_LABELS } from "@/types/signedtosealed";

interface DashboardProps {
  envelopes: STSEnvelope[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => Promise<void>;
}

const TAB_FILTERS: { label: string; value: EnvelopeStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Voided", value: "voided" },
];

const STATUS_COLORS: Record<EnvelopeStatus, string> = {
  draft: "#6b7280",
  sent: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#10b981",
  voided: "#ef4444",
};

export default function Dashboard({ envelopes, loading, onOpen, onCreate, onDelete }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<EnvelopeStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = envelopes;
    if (activeTab !== "all") {
      result = result.filter((e) => e.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.created_by.toLowerCase().includes(q) ||
          e.message.toLowerCase().includes(q)
      );
    }
    return result;
  }, [envelopes, activeTab, search]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { all: envelopes.length };
    for (const e of envelopes) {
      counts[e.status] = (counts[e.status] || 0) + 1;
    }
    return counts;
  }, [envelopes]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this envelope? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading envelopes...</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
        {(["draft", "sent", "in_progress", "completed", "voided"] as EnvelopeStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setActiveTab(s)}
            className="p-4 rounded-lg border text-left transition-all hover:opacity-90"
            style={{
              background: activeTab === s ? "var(--card-hover)" : "var(--card-bg)",
              borderColor: activeTab === s ? STATUS_COLORS[s] : "var(--border-light)",
            }}
          >
            <p className="text-2xl font-semibold" style={{ color: STATUS_COLORS[s] }}>
              {stats[s] || 0}
            </p>
            <p className="text-[10px] tracking-[1px] uppercase mt-1" style={{ color: "var(--text-muted)" }}>
              {STATUS_LABELS[s]}
            </p>
          </button>
        ))}
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-1 flex-wrap">
          {TAB_FILTERS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                background: activeTab === tab.value ? "var(--gold)" : "transparent",
                color: activeTab === tab.value ? "#0a0b0e" : "var(--text-muted)",
              }}
            >
              {tab.label} {stats[tab.value] !== undefined ? `(${stats[tab.value]})` : `(${stats[tab.value] || 0})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search envelopes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 rounded-lg border text-sm outline-none"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Envelope List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg mb-2" style={{ color: "var(--text-muted)" }}>
            {search ? "No envelopes match your search" : "No envelopes yet"}
          </p>
          {!search && (
            <button
              onClick={onCreate}
              className="text-sm px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
              style={{ background: "var(--gold)", color: "#0a0b0e" }}
            >
              Create your first envelope
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((envelope) => (
            <div
              key={envelope.id}
              className="flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:opacity-90"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-light)",
              }}
              onClick={() => onOpen(envelope.id)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_COLORS[envelope.status] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {envelope.title || "Untitled Envelope"}
                </p>
                {envelope.message && (
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {envelope.message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide uppercase"
                  style={{
                    background: STATUS_COLORS[envelope.status] + "20",
                    color: STATUS_COLORS[envelope.status],
                  }}
                >
                  {STATUS_LABELS[envelope.status]}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatDate(envelope.updated_at)}
                </span>
                {envelope.status === "draft" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(envelope.id);
                    }}
                    disabled={deleting === envelope.id}
                    className="text-xs px-2 py-1 rounded hover:opacity-80 transition-all"
                    style={{ color: "#ef4444" }}
                  >
                    {deleting === envelope.id ? "..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
