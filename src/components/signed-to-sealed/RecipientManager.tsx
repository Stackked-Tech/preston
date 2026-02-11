"use client";

import { useState } from "react";
import type { STSRecipient, RecipientRole } from "@/types/signedtosealed";
import { RECIPIENT_COLORS } from "@/types/signedtosealed";

interface RecipientManagerProps {
  recipients: STSRecipient[];
  onAdd: (name: string, email: string, role: RecipientRole, signingOrder: number, colorHex: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; email?: string; role?: RecipientRole; signing_order?: number }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export default function RecipientManager({ recipients, onAdd, onUpdate, onRemove, readOnly }: RecipientManagerProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RecipientRole>("signer");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<RecipientRole>("signer");

  const nextColor = RECIPIENT_COLORS[recipients.length % RECIPIENT_COLORS.length];
  const nextOrder = recipients.length + 1;

  const handleAdd = async () => {
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    try {
      await onAdd(name.trim(), email.trim(), role, nextOrder, nextColor);
      setName("");
      setEmail("");
      setRole("signer");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (r: STSRecipient) => {
    setEditingId(r.id);
    setEditName(r.name);
    setEditEmail(r.email);
    setEditRole(r.role);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editEmail.trim()) return;
    await onUpdate(editingId, { name: editName.trim(), email: editEmail.trim(), role: editRole });
    setEditingId(null);
  };

  return (
    <div>
      <h3 className="text-xs tracking-[2px] uppercase mb-4" style={{ color: "var(--text-muted)" }}>
        Recipients ({recipients.length})
      </h3>

      {/* Recipient List */}
      <div className="space-y-2 mb-4">
        {recipients.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 p-3 rounded-lg border"
            style={{ background: "var(--card-bg)", borderColor: r.color_hex + "40" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: r.color_hex }}
            >
              {r.name.charAt(0).toUpperCase()}
            </div>

            {editingId === r.id ? (
              <div className="flex-1 flex flex-col sm:flex-row gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 rounded border text-sm outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                />
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="flex-1 px-2 py-1 rounded border text-sm outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                />
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as RecipientRole)}
                  className="px-2 py-1 rounded border text-sm outline-none"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  <option value="signer">Signer</option>
                  <option value="cc">CC</option>
                  <option value="in_person">In Person</option>
                </select>
                <button onClick={handleSaveEdit} className="text-xs px-2 py-1 rounded" style={{ color: "#10b981" }}>Save</button>
                <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {r.name}
                    <span className="text-xs ml-2 opacity-60">({r.role})</span>
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{r.email}</p>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  #{r.signing_order}
                </span>
                {!readOnly && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(r)} className="text-xs px-2 py-1 rounded hover:opacity-80" style={{ color: "var(--text-muted)" }}>Edit</button>
                    <button onClick={() => onRemove(r.id)} className="text-xs px-2 py-1 rounded hover:opacity-80" style={{ color: "#ef4444" }}>Remove</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add New */}
      {!readOnly && (
        <div
          className="p-4 rounded-lg border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Add Recipient</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RecipientRole)}
              className="px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="signer">Signer</option>
              <option value="cc">CC</option>
              <option value="in_person">In Person</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={adding || !name.trim() || !email.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{
                background: "var(--gold)",
                color: "#0a0b0e",
                opacity: adding || !name.trim() || !email.trim() ? 0.5 : 1,
              }}
            >
              {adding ? "..." : "Add"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 rounded-full" style={{ background: nextColor }} />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Will be assigned color above · Signing order #{nextOrder}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
