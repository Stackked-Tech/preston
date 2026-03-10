"use client";

import { useState, useCallback } from "react";
import { useHMUsers, useUserProperties } from "@/lib/hospitalityHooks";
import type { HMUser } from "@/types/hospitality";

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.75rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
  display: "block",
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROPERTY BADGES
// ═══════════════════════════════════════════════════════════════════════════════

function UserPropertyBadges({ userId }: { userId: string }) {
  const { userProperties } = useUserProperties(userId);

  if (userProperties.length === 0) {
    return <span className="text-xs" style={{ color: "var(--text-muted)" }}>None</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {userProperties.map((up) => (
        <span
          key={up.id}
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(212,175,55,0.1)",
            color: "var(--gold)",
            border: "1px solid rgba(212,175,55,0.2)",
          }}
        >
          {up.property?.name || "Unknown"}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD USER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface AddUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "staff" as "manager" | "staff",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = form.name.trim() !== "" && form.email.trim() !== "" && form.password.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hospitality/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl mb-4" style={{ color: "var(--gold)" }}>
          Add User
        </h2>

        {error && (
          <div
            className="mb-3 p-2 rounded text-sm"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 555-5555"
            />
          </div>
          <div>
            <label style={labelStyle}>Role *</label>
            <select
              style={inputStyle}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "manager" | "staff" }))}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Initial Password *</label>
            <input
              style={inputStyle}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Password"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-sans"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-4 py-2 rounded-md text-sm font-sans transition-all"
            style={{
              background: canSubmit ? "var(--gold)" : "var(--input-bg)",
              color: canSubmit ? "#0a0b0e" : "var(--text-muted)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT USER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface EditUserModalProps {
  user: HMUser;
  onSave: (id: string, data: Partial<HMUser>) => Promise<unknown>;
  onClose: () => void;
}

function EditUserModal({ user, onSave, onClose }: EditUserModalProps) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email || "",
    phone: user.phone || "",
    role: user.role as "manager" | "staff",
  });
  const [saving, setSaving] = useState(false);

  const canSubmit = form.name.trim() !== "" && form.email.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await onSave(user.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
      });
      onClose();
    } catch (err) {
      console.error("Failed to update user:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl mb-4" style={{ color: "var(--gold)" }}>
          Edit User
        </h2>

        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <select
              style={inputStyle}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "manager" | "staff" }))}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-sans"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-4 py-2 rounded-md text-sm font-sans transition-all"
            style={{
              background: canSubmit ? "var(--gold)" : "var(--input-bg)",
              color: canSubmit ? "#0a0b0e" : "var(--text-muted)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export default function UserManager() {
  const { users, loading, updateUser, toggleUserActive, refetch } = useHMUsers();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<HMUser | null>(null);

  const handleResetPassword = useCallback(async (userId: string) => {
    try {
      await updateUser(userId, { must_reset_password: true } as Partial<HMUser>);
    } catch (err) {
      console.error("Failed to flag password reset:", err);
    }
  }, [updateUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span style={{ color: "var(--gold)" }}>Loading users...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
          Users ({users.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-md text-sm font-sans transition-all"
          style={{ background: "var(--gold)", color: "#0a0b0e", fontWeight: 600 }}
        >
          + Add User
        </button>
      </div>

      <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-tertiary)" }}>
              <th className="text-left px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Name</th>
              <th className="text-left px-4 py-3 font-sans font-medium hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>Email</th>
              <th className="text-left px-4 py-3 font-sans font-medium hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>Phone</th>
              <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Role</th>
              <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Status</th>
              <th className="text-left px-4 py-3 font-sans font-medium hidden xl:table-cell" style={{ color: "var(--text-secondary)" }}>Properties</th>
              <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr
                key={u.id}
                style={{ background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--card-bg)" }}
              >
                <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{u.name}</td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>{u.email || "-"}</td>
                <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{u.phone || "-"}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: u.role === "manager" ? "rgba(212,175,55,0.1)" : "rgba(96,165,250,0.1)",
                      color: u.role === "manager" ? "var(--gold)" : "#60a5fa",
                      border: `1px solid ${u.role === "manager" ? "rgba(212,175,55,0.2)" : "rgba(96,165,250,0.2)"}`,
                    }}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: u.is_active ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.1)",
                      color: u.is_active ? "#4ade80" : "#9ca3af",
                      border: `1px solid ${u.is_active ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"}`,
                    }}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <UserPropertyBadges userId={u.id} />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-xs px-2 py-1 rounded border transition-all"
                      style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleUserActive(u.id, !u.is_active)}
                      className="text-xs px-2 py-1 rounded border transition-all"
                      style={{
                        borderColor: "var(--border-color)",
                        color: u.is_active ? "#f87171" : "#4ade80",
                      }}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="text-xs px-2 py-1 rounded border transition-all"
                      style={{ borderColor: "var(--border-color)", color: "#f59e0b" }}
                      title="Force password reset on next login"
                    >
                      Reset PW
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No users yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={refetch}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onSave={updateUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}
