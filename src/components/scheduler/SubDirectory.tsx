"use client";

import { useState } from "react";
import type { CSSub, CSSubInsert } from "@/types/scheduler";

interface SubDirectoryProps {
  subs: CSSub[];
  onCreateSub: (sub: CSSubInsert) => Promise<unknown>;
  onUpdateSub: (id: string, updates: Partial<CSSub>) => Promise<unknown>;
  onDeleteSub: (id: string) => Promise<unknown>;
  onGenerateLink: (subId: string) => Promise<string>;
  onClose: () => void;
}

const TRADES = [
  "General",
  "Excavation",
  "Foundation",
  "Framing",
  "Roofing",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Insulation",
  "Drywall",
  "Painting",
  "Flooring",
  "Tile",
  "Cabinetry",
  "Concrete",
  "Masonry",
  "Siding",
  "Windows & Doors",
  "Landscaping",
  "Cleanup",
];

export default function SubDirectory({ subs, onCreateSub, onUpdateSub, onDeleteSub, onGenerateLink, onClose }: SubDirectoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState("General");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const filtered = subs.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.trade.toLowerCase().includes(search.toLowerCase()) ||
      (s.company || "").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setName("");
    setCompany("");
    setTrade("General");
    setPhone("");
    setEmail("");
    setNotes("");
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    if (editId) {
      await onUpdateSub(editId, { name: name.trim(), company: company.trim() || null, trade, phone: phone.trim(), email: email.trim() || null, notes: notes.trim() || null });
    } else {
      await onCreateSub({ name: name.trim(), company: company.trim() || null, trade, phone: phone.trim(), email: email.trim() || null, notes: notes.trim() || null });
    }
    resetForm();
  };

  const handleEdit = (sub: CSSub) => {
    setEditId(sub.id);
    setName(sub.name);
    setCompany(sub.company || "");
    setTrade(sub.trade);
    setPhone(sub.phone);
    setEmail(sub.email || "");
    setNotes(sub.notes || "");
    setShowForm(true);
  };

  const handleCopyLink = async (subId: string) => {
    const token = await onGenerateLink(subId);
    const link = `${window.location.origin}/scheduler/sub/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(subId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border p-6 mx-4 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
            Subcontractor Directory
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
              className="px-3 py-1 rounded-lg text-xs font-sans font-medium border"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
            >
              {showForm ? "Cancel" : "+ Add Sub"}
            </button>
            <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subs..."
          className="w-full px-3 py-2 rounded-lg border text-sm font-sans mb-4"
          style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
        />

        {/* Add/Edit form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg border mb-4" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" required
                className="px-3 py-2 rounded-lg border text-sm font-sans"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} />
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company"
                className="px-3 py-2 rounded-lg border text-sm font-sans"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} />
              <select value={trade} onChange={(e) => setTrade(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm font-sans"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}>
                {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone *" required
                className="px-3 py-2 rounded-lg border text-sm font-sans"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                className="px-3 py-2 rounded-lg border text-sm font-sans col-span-2"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2}
              className="w-full px-3 py-2 rounded-lg border text-sm font-sans resize-none"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} />
            <button type="submit" disabled={!name.trim() || !phone.trim()}
              className="w-full py-2 rounded-lg text-sm font-sans font-medium"
              style={{ background: "var(--gold)", color: "#000" }}>
              {editId ? "Update Sub" : "Add Sub"}
            </button>
          </form>
        )}

        {/* Sub list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-xs font-sans text-center py-8" style={{ color: "var(--text-muted)" }}>
              {search ? "No matching subcontractors" : "No subcontractors yet"}
            </p>
          )}
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border"
              style={{ borderColor: "var(--border-light)" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>{sub.name}</span>
                  <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-full" style={{ background: "rgba(212, 175, 55, 0.15)", color: "var(--gold)" }}>
                    {sub.trade}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {sub.company && <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>{sub.company}</span>}
                  <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>📱 {sub.phone}</span>
                  {sub.email && <span className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>✉ {sub.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleCopyLink(sub.id)}
                  className="px-2 py-1 rounded text-[10px] font-sans border"
                  style={{ borderColor: "var(--border-color)", color: copiedLink === sub.id ? "#22c55e" : "var(--text-muted)" }}
                >
                  {copiedLink === sub.id ? "✓ Copied" : "🔗 Portal Link"}
                </button>
                <button onClick={() => handleEdit(sub)} className="px-2 py-1 rounded text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>
                  ✏️
                </button>
                <button
                  onClick={() => { if (confirm(`Delete ${sub.name}?`)) onDeleteSub(sub.id); }}
                  className="px-2 py-1 rounded text-[10px] font-sans"
                  style={{ color: "#ef4444" }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
