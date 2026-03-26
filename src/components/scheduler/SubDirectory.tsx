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

const TRADE_COLORS: Record<string, string> = {
  "General": "#6b7280",
  "Excavation": "#92400e",
  "Foundation": "#78716c",
  "Framing": "#b45309",
  "Roofing": "#dc2626",
  "Plumbing": "#2563eb",
  "Electrical": "#eab308",
  "HVAC": "#0891b2",
  "Insulation": "#f472b6",
  "Drywall": "#a3a3a3",
  "Painting": "#8b5cf6",
  "Flooring": "#a16207",
  "Tile": "#0d9488",
  "Cabinetry": "#7c3aed",
  "Concrete": "#57534e",
  "Masonry": "#9a3412",
  "Siding": "#15803d",
  "Windows & Doors": "#4f46e5",
  "Landscaping": "#16a34a",
  "Cleanup": "#64748b",
};

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

  const inputClass = "px-3 py-2.5 rounded-lg border text-sm font-sans outline-none transition-all";
  const inputStyle = { background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" };
  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--gold)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212, 175, 55, 0.1)";
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--border-color)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border mx-4 max-h-[85vh] overflow-hidden flex flex-col"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(212, 175, 55, 0.1)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                Subcontractor Directory
              </h3>
              <p className="text-[10px] font-sans" style={{ color: "var(--text-muted)" }}>{subs.length} subcontractors</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all active:scale-95"
              style={{
                background: showForm ? "transparent" : "var(--gold)",
                color: showForm ? "var(--text-muted)" : "#000",
                border: showForm ? "1px solid var(--border-color)" : "1px solid var(--gold)",
              }}
            >
              {showForm ? (
                <>Cancel</>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Sub
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--card-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b" style={{ borderColor: "var(--border-light)" }}>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, trade, or company..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm font-sans outline-none transition-all"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Add/Edit form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mx-6 mt-4 p-4 rounded-xl border space-y-3" style={{ borderColor: "var(--gold)", background: "rgba(212, 175, 55, 0.03)" }}>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--gold)" }}>
                {editId ? "Edit Subcontractor" : "New Subcontractor"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" required
                  className={inputClass} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company"
                  className={inputClass} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                <select value={trade} onChange={(e) => setTrade(e.target.value)}
                  className={inputClass} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur}>
                  {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone *" required
                  className={inputClass} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                  className={`${inputClass} col-span-2`} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2}
                className="w-full px-3 py-2.5 rounded-lg border text-sm font-sans resize-none outline-none transition-all"
                style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              <button type="submit" disabled={!name.trim() || !phone.trim()}
                className="w-full py-2.5 rounded-lg text-sm font-sans font-semibold transition-all active:scale-[0.98]"
                style={{ background: "var(--gold)", color: "#000", opacity: name.trim() && phone.trim() ? 1 : 0.4 }}>
                {editId ? "Update Sub" : "Add Sub"}
              </button>
            </form>
          )}

          {/* Sub cards */}
          <div className="p-6 space-y-3">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-10">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(212, 175, 55, 0.08)" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p className="text-sm font-sans font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  {search ? "No matching subcontractors" : "No subcontractors yet"}
                </p>
                <p className="text-xs font-sans" style={{ color: "var(--text-muted)" }}>
                  {search ? "Try a different search term" : "Add your first subcontractor to get started"}
                </p>
              </div>
            )}
            {filtered.map((sub) => {
              const tradeColor = TRADE_COLORS[sub.trade] || "#6b7280";
              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all"
                  style={{ borderColor: "var(--border-light)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-light)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-sans font-bold"
                      style={{ background: `${tradeColor}15`, color: tradeColor }}
                    >
                      {sub.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-sans font-medium" style={{ color: "var(--text-primary)" }}>{sub.name}</span>
                        <span
                          className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${tradeColor}15`, color: tradeColor }}
                        >
                          {sub.trade}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {sub.company && (
                          <span className="text-[10px] font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                            {sub.company}
                          </span>
                        )}
                        <span className="text-[10px] font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          {sub.phone}
                        </span>
                        {sub.email && (
                          <span className="text-[10px] font-sans flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                            </svg>
                            {sub.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <button
                      onClick={() => handleCopyLink(sub.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-medium border transition-all"
                      style={{
                        borderColor: copiedLink === sub.id ? "#22c55e" : "var(--border-color)",
                        color: copiedLink === sub.id ? "#22c55e" : "var(--text-muted)",
                        background: copiedLink === sub.id ? "rgba(34, 197, 94, 0.08)" : "transparent",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {copiedLink === sub.id ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
                        )}
                      </svg>
                      {copiedLink === sub.id ? "Copied!" : "Portal"}
                    </button>
                    <button
                      onClick={() => handleEdit(sub)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold)"; e.currentTarget.style.background = "rgba(212,175,55,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete ${sub.name}?`)) onDeleteSub(sub.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
