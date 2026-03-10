"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { HMRequesterType, HMRequesterTypeInsert } from "@/types/hospitality";

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  outline: "none",
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: useAllRequesterTypes — fetches ALL (active + inactive) for admin
// ═══════════════════════════════════════════════════════════════════════════════

function useAllRequesterTypes() {
  const [requesterTypes, setRequesterTypes] = useState<HMRequesterType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("hm_requester_types")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setRequesterTypes((data || []) as HMRequesterType[]);
    } catch (err) {
      console.error("Failed to fetch requester types:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addRequesterType = async (rt: HMRequesterTypeInsert): Promise<void> => {
    const { data, error } = await supabase
      .from("hm_requester_types")
      .insert(rt)
      .select()
      .single();
    if (error) throw error;
    setRequesterTypes((prev) =>
      [...prev, data as HMRequesterType].sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const updateRequesterType = async (id: string, updates: Partial<HMRequesterTypeInsert>): Promise<void> => {
    const { data, error } = await supabase
      .from("hm_requester_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setRequesterTypes((prev) =>
      prev
        .map((rt) => (rt.id === id ? (data as HMRequesterType) : rt))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const toggleActive = async (id: string, is_active: boolean): Promise<void> => {
    const { error } = await supabase
      .from("hm_requester_types")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    setRequesterTypes((prev) =>
      prev.map((rt) => (rt.id === id ? { ...rt, is_active } : rt))
    );
  };

  return { requesterTypes, loading, addRequesterType, updateRequesterType, toggleActive, refetch: fetchAll };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUESTER TYPE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export default function RequesterTypeManager() {
  const { requesterTypes, loading, addRequesterType, updateRequesterType, toggleActive } = useAllRequesterTypes();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newLabel.trim() || adding) return;
    setAdding(true);
    try {
      const maxSort = requesterTypes.length > 0
        ? Math.max(...requesterTypes.map((rt) => rt.sort_order))
        : 0;
      await addRequesterType({
        label: newLabel.trim(),
        sort_order: maxSort + 1,
        is_active: true,
      });
      setNewLabel("");
    } catch (err) {
      console.error("Failed to add requester type:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editLabel.trim()) return;
    try {
      await updateRequesterType(id, { label: editLabel.trim() });
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update requester type:", err);
    }
  };

  const handleMoveUp = async (rt: HMRequesterType, index: number) => {
    if (index === 0) return;
    const prev = requesterTypes[index - 1];
    try {
      await updateRequesterType(rt.id, { sort_order: prev.sort_order });
      await updateRequesterType(prev.id, { sort_order: rt.sort_order });
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  };

  const handleMoveDown = async (rt: HMRequesterType, index: number) => {
    if (index >= requesterTypes.length - 1) return;
    const next = requesterTypes[index + 1];
    try {
      await updateRequesterType(rt.id, { sort_order: next.sort_order });
      await updateRequesterType(next.id, { sort_order: rt.sort_order });
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span style={{ color: "var(--gold)" }}>Loading requester types...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
          Requester Types ({requesterTypes.length})
        </h2>
      </div>

      {/* Add form */}
      <div className="flex gap-2 mb-4">
        <input
          style={{ ...inputStyle, flex: 1, maxWidth: "300px" }}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New requester type..."
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button
          onClick={handleAdd}
          disabled={!newLabel.trim() || adding}
          className="px-4 py-2 rounded-md text-sm font-sans transition-all"
          style={{
            background: newLabel.trim() ? "var(--gold)" : "var(--input-bg)",
            color: newLabel.trim() ? "#0a0b0e" : "var(--text-muted)",
            opacity: adding ? 0.7 : 1,
          }}
        >
          {adding ? "Adding..." : "+ Add"}
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-1">
        {requesterTypes.map((rt, i) => (
          <div
            key={rt.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{
              background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--card-bg)",
              border: "1px solid var(--border-color)",
              opacity: rt.is_active ? 1 : 0.5,
            }}
          >
            {/* Sort controls */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => handleMoveUp(rt, i)}
                disabled={i === 0}
                className="text-xs leading-none transition-all"
                style={{ color: i === 0 ? "var(--text-muted)" : "var(--text-secondary)" }}
              >
                &#9650;
              </button>
              <button
                onClick={() => handleMoveDown(rt, i)}
                disabled={i >= requesterTypes.length - 1}
                className="text-xs leading-none transition-all"
                style={{ color: i >= requesterTypes.length - 1 ? "var(--text-muted)" : "var(--text-secondary)" }}
              >
                &#9660;
              </button>
            </div>

            {/* Label */}
            <div className="flex-1">
              {editingId === rt.id ? (
                <div className="flex gap-2">
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(rt.id); if (e.key === "Escape") setEditingId(null); }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleEditSave(rt.id)}
                    className="text-xs px-2 py-1 rounded border"
                    style={{ borderColor: "var(--border-color)", color: "#4ade80" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-2 py-1 rounded border"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(rt.id); setEditLabel(rt.label); }}
                  className="text-left text-sm hover:opacity-80 transition-all"
                  style={{ color: "var(--text-primary)" }}
                >
                  {rt.label}
                </button>
              )}
            </div>

            {/* Status badge */}
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: rt.is_active ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.1)",
                color: rt.is_active ? "#4ade80" : "#9ca3af",
                border: `1px solid ${rt.is_active ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"}`,
              }}
            >
              {rt.is_active ? "Active" : "Inactive"}
            </span>

            {/* Toggle */}
            <button
              onClick={() => toggleActive(rt.id, !rt.is_active)}
              className="text-xs px-2 py-1 rounded border transition-all"
              style={{
                borderColor: "var(--border-color)",
                color: rt.is_active ? "#f87171" : "#4ade80",
              }}
            >
              {rt.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
        {requesterTypes.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
            No requester types yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
