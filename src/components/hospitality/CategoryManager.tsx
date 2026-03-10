"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { HMCategory, HMCategoryInsert } from "@/types/hospitality";

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
// HOOK: useAllCategories — fetches ALL categories (active + inactive) for admin
// ═══════════════════════════════════════════════════════════════════════════════

function useAllCategories() {
  const [categories, setCategories] = useState<HMCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("hm_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setCategories((data || []) as HMCategory[]);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addCategory = async (cat: HMCategoryInsert): Promise<void> => {
    const { data, error } = await supabase
      .from("hm_categories")
      .insert(cat)
      .select()
      .single();
    if (error) throw error;
    setCategories((prev) =>
      [...prev, data as HMCategory].sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const updateCategory = async (id: string, updates: Partial<HMCategoryInsert>): Promise<void> => {
    const { data, error } = await supabase
      .from("hm_categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setCategories((prev) =>
      prev
        .map((c) => (c.id === id ? (data as HMCategory) : c))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const toggleActive = async (id: string, is_active: boolean): Promise<void> => {
    const { error } = await supabase
      .from("hm_categories")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active } : c))
    );
  };

  return { categories, loading, addCategory, updateCategory, toggleActive, refetch: fetchAll };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export default function CategoryManager() {
  const { categories, loading, addCategory, updateCategory, toggleActive } = useAllCategories();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newLabel.trim() || adding) return;
    setAdding(true);
    try {
      const maxSort = categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order))
        : 0;
      await addCategory({
        label: newLabel.trim(),
        sort_order: maxSort + 1,
        is_active: true,
      });
      setNewLabel("");
    } catch (err) {
      console.error("Failed to add category:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editLabel.trim()) return;
    try {
      await updateCategory(id, { label: editLabel.trim() });
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update category:", err);
    }
  };

  const handleMoveUp = async (cat: HMCategory, index: number) => {
    if (index === 0) return;
    const prev = categories[index - 1];
    try {
      await updateCategory(cat.id, { sort_order: prev.sort_order });
      await updateCategory(prev.id, { sort_order: cat.sort_order });
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  };

  const handleMoveDown = async (cat: HMCategory, index: number) => {
    if (index >= categories.length - 1) return;
    const next = categories[index + 1];
    try {
      await updateCategory(cat.id, { sort_order: next.sort_order });
      await updateCategory(next.id, { sort_order: cat.sort_order });
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span style={{ color: "var(--gold)" }}>Loading categories...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
          Categories ({categories.length})
        </h2>
      </div>

      {/* Add form */}
      <div className="flex gap-2 mb-4">
        <input
          style={{ ...inputStyle, flex: 1, maxWidth: "300px" }}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New category name..."
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

      {/* Category list */}
      <div className="flex flex-col gap-1">
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{
              background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--card-bg)",
              border: "1px solid var(--border-color)",
              opacity: cat.is_active ? 1 : 0.5,
            }}
          >
            {/* Sort order */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => handleMoveUp(cat, i)}
                disabled={i === 0}
                className="text-xs leading-none transition-all"
                style={{ color: i === 0 ? "var(--text-muted)" : "var(--text-secondary)" }}
              >
                &#9650;
              </button>
              <button
                onClick={() => handleMoveDown(cat, i)}
                disabled={i >= categories.length - 1}
                className="text-xs leading-none transition-all"
                style={{ color: i >= categories.length - 1 ? "var(--text-muted)" : "var(--text-secondary)" }}
              >
                &#9660;
              </button>
            </div>

            {/* Label */}
            <div className="flex-1">
              {editingId === cat.id ? (
                <div className="flex gap-2">
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(cat.id); if (e.key === "Escape") setEditingId(null); }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleEditSave(cat.id)}
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
                  onClick={() => { setEditingId(cat.id); setEditLabel(cat.label); }}
                  className="text-left text-sm hover:opacity-80 transition-all"
                  style={{ color: "var(--text-primary)" }}
                >
                  {cat.label}
                </button>
              )}
            </div>

            {/* Status badge */}
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: cat.is_active ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.1)",
                color: cat.is_active ? "#4ade80" : "#9ca3af",
                border: `1px solid ${cat.is_active ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"}`,
              }}
            >
              {cat.is_active ? "Active" : "Inactive"}
            </span>

            {/* Toggle */}
            <button
              onClick={() => toggleActive(cat.id, !cat.is_active)}
              className="text-xs px-2 py-1 rounded border transition-all"
              style={{
                borderColor: "var(--border-color)",
                color: cat.is_active ? "#f87171" : "#4ade80",
              }}
            >
              {cat.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
            No categories yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
