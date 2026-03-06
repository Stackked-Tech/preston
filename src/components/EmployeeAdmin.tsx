"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import Link from "next/link";
import {
  useBranches,
  useStaff,
  useNameOverrides,
} from "@/lib/employeeAdminHooks";
import type {
  EAStaff,
  EAStaffInsert,
  EANameOverrideInsert,
} from "@/types/employeeadmin";

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface StaffModalProps {
  staff: EAStaff | null;
  isAdding: boolean;
  branchId: string;
  onSave: (data: EAStaffInsert) => Promise<void>;
  onUpdate: (id: string, data: Partial<EAStaff>) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onClose: () => void;
}

function StaffModal({
  staff,
  isAdding,
  branchId,
  onSave,
  onUpdate,
  onToggleActive,
  onClose,
}: StaffModalProps) {
  const [form, setForm] = useState({
    display_name: staff?.display_name ?? "",
    target_first: staff?.target_first ?? "",
    target_last: staff?.target_last ?? "",
    internal_id: staff?.internal_id?.toString() ?? "",
    station_lease: staff?.station_lease?.toString() ?? "",
    financial_services: staff?.financial_services?.toString() ?? "",
    phorest_fee: staff?.phorest_fee?.toString() ?? "",
    refreshment: staff?.refreshment?.toString() ?? "",
    associate_pay: staff?.associate_pay != null ? staff.associate_pay.toString() : "",
    supervisor: staff?.supervisor ?? "",
    sort_order: staff?.sort_order?.toString() ?? "0",
    email: staff?.email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [localActive, setLocalActive] = useState(staff?.is_active ?? true);

  const canSubmit =
    form.display_name.trim() !== "" &&
    form.target_first.trim() !== "" &&
    form.target_last.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        target_first: form.target_first.trim(),
        target_last: form.target_last.trim(),
        internal_id: Number(form.internal_id) || 0,
        station_lease: Number(form.station_lease) || 0,
        financial_services: Number(form.financial_services) || 0,
        phorest_fee: Number(form.phorest_fee) || 0,
        refreshment: Number(form.refreshment) || 0,
        associate_pay: form.associate_pay.trim() !== "" ? Number(form.associate_pay) : null,
        supervisor: form.supervisor.trim() || null,
        email: form.email.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: localActive,
      };

      if (isAdding) {
        await onSave({ ...payload, branch_id: branchId });
      } else if (staff) {
        await onUpdate(staff.id, payload);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save staff:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!staff) return;
    const next = !localActive;
    try {
      await onToggleActive(staff.id, next);
      setLocalActive(next);
    } catch (err) {
      console.error("Failed to toggle active:", err);
    }
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="font-serif text-xl mb-4"
          style={{ color: "var(--gold)" }}
        >
          {isAdding ? "Add Staff" : "Edit Staff"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label style={labelStyle}>Display Name *</label>
            <input
              style={inputStyle}
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Target First Name *</label>
            <input
              style={inputStyle}
              value={form.target_first}
              onChange={(e) => setForm((f) => ({ ...f, target_first: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Target Last Name *</label>
            <input
              style={inputStyle}
              value={form.target_last}
              onChange={(e) => setForm((f) => ({ ...f, target_last: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>NetSuite Internal ID</label>
            <input
              style={inputStyle}
              type="number"
              value={form.internal_id}
              onChange={(e) => setForm((f) => ({ ...f, internal_id: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Station Lease</label>
            <input
              style={inputStyle}
              type="number"
              value={form.station_lease}
              onChange={(e) => setForm((f) => ({ ...f, station_lease: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Financial Services</label>
            <input
              style={inputStyle}
              type="number"
              value={form.financial_services}
              onChange={(e) => setForm((f) => ({ ...f, financial_services: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Phorest Fee</label>
            <input
              style={inputStyle}
              type="number"
              value={form.phorest_fee}
              onChange={(e) => setForm((f) => ({ ...f, phorest_fee: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Refreshment</label>
            <input
              style={inputStyle}
              type="number"
              value={form.refreshment}
              onChange={(e) => setForm((f) => ({ ...f, refreshment: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Associate Pay</label>
            <input
              style={inputStyle}
              type="number"
              placeholder="Empty = N/A"
              value={form.associate_pay}
              onChange={(e) => setForm((f) => ({ ...f, associate_pay: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Supervisor</label>
            <input
              style={inputStyle}
              placeholder="Empty = N/A"
              value={form.supervisor}
              onChange={(e) => setForm((f) => ({ ...f, supervisor: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Sort Order</label>
            <input
              style={inputStyle}
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label style={labelStyle}>Portal Email</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="employee@example.com"
            />
          </div>
        </div>

        {/* Active toggle — edit mode only */}
        {!isAdding && staff && (
          <div className="mt-4 flex items-center gap-3">
            <button
              className="text-sm px-3 py-1 rounded"
              style={{
                background: localActive ? "rgba(220,38,38,0.15)" : "rgba(34,197,94,0.15)",
                color: localActive ? "#f87171" : "#4ade80",
                border: `1px solid ${localActive ? "rgba(220,38,38,0.3)" : "rgba(34,197,94,0.3)"}`,
              }}
              onClick={handleToggle}
            >
              {localActive ? "Deactivate" : "Activate"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Currently: {localActive ? "Active" : "Inactive"}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-3">
          <button
            className="px-4 py-2 text-sm rounded"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded font-medium"
            style={{
              background: canSubmit ? "var(--gold)" : "var(--input-bg)",
              color: canSubmit ? "#0a0b0e" : "var(--text-muted)",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            disabled={!canSubmit || saving}
            onClick={handleSubmit}
          >
            {saving ? "Saving..." : isAdding ? "Add" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EmployeeAdmin() {
  const { theme, toggleTheme } = useTheme();
  const { branches, loading: branchesLoading } = useBranches();

  const [activeBranch, setActiveBranch] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [editingStaff, setEditingStaff] = useState<EAStaff | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addingOverride, setAddingOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ phorestName: "", staffDisplayName: "" });

  // Set active branch once branches load
  useEffect(() => {
    if (branches.length > 0 && !activeBranch) {
      setActiveBranch(branches[0].branch_id);
    }
  }, [branches, activeBranch]);

  const {
    staff,
    loading: staffLoading,
    addStaff,
    updateStaff,
    toggleActive,
  } = useStaff(activeBranch);

  const {
    overrides,
    loading: overridesLoading,
    addOverride,
    deleteOverride,
  } = useNameOverrides(activeBranch);

  // Counts
  const activeCount = staff.filter((s) => s.is_active).length;
  const inactiveCount = staff.filter((s) => !s.is_active).length;
  const visibleStaff = showInactive ? staff : staff.filter((s) => s.is_active);

  // Override handlers
  const handleAddOverride = async () => {
    if (!overrideForm.phorestName.trim() || !overrideForm.staffDisplayName.trim()) return;
    try {
      const insert: EANameOverrideInsert = {
        branch_id: activeBranch,
        phorest_name: overrideForm.phorestName.trim(),
        staff_display_name: overrideForm.staffDisplayName.trim(),
      };
      await addOverride(insert);
      setOverrideForm({ phorestName: "", staffDisplayName: "" });
      setAddingOverride(false);
    } catch (err) {
      console.error("Failed to add override:", err);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await deleteOverride(id);
    } catch (err) {
      console.error("Failed to delete override:", err);
    }
  };

  // ── Loading state ──
  if (branchesLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--bg-primary)" }}>
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            &larr; Home
          </Link>
          <h1
            className="font-serif text-2xl font-semibold tracking-wide"
            style={{ color: "var(--gold)" }}
          >
            Employee Administration
          </h1>
        </div>
        <button
          onClick={toggleTheme}
          className="text-xl p-2 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
        </button>
      </header>

      {/* ── Branch Tabs ── */}
      <nav
        className="flex gap-1 px-6 pt-4"
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        {branches.map((b) => (
          <button
            key={b.branch_id}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: activeBranch === b.branch_id ? "var(--gold)" : "var(--text-secondary)",
              borderBottom:
                activeBranch === b.branch_id ? "2px solid var(--gold)" : "2px solid transparent",
              background: "transparent",
              marginBottom: "-1px",
            }}
            onClick={() => setActiveBranch(b.branch_id)}
          >
            {b.name}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="px-6 py-6 max-w-6xl mx-auto">
        {staffLoading ? (
          <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
            Loading staff...
          </div>
        ) : (
          <>
            {/* Summary + controls */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}
              </p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                  Show Inactive
                </label>
                <button
                  className="px-3 py-1.5 text-sm rounded font-medium"
                  style={{ background: "var(--gold)", color: "#0a0b0e" }}
                  onClick={() => setIsAdding(true)}
                >
                  + Add Staff
                </button>
              </div>
            </div>

            {/* Staff Table */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    {["Name", "NetSuite ID", "Station Lease", "Fin. Services", "Phorest Fee", "Refreshment"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-medium uppercase px-4 py-3"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleStaff.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No staff members for this branch.
                      </td>
                    </tr>
                  ) : (
                    visibleStaff.map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          opacity: s.is_active ? 1 : 0.5,
                        }}
                        onClick={() => setEditingStaff(s)}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "var(--card-hover)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>
                          <span>{s.display_name}</span>
                          {s.supervisor && (
                            <span
                              className="ml-2 text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(94,234,212,0.1)",
                                color: "#5eead4",
                                border: "1px solid rgba(94,234,212,0.2)",
                              }}
                            >
                              Associate
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {s.internal_id}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {s.station_lease}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {s.financial_services}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {s.phorest_fee}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {s.refreshment}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Name Overrides ── */}
            <section className="mt-8">
              <h2
                className="font-serif text-lg mb-3"
                style={{ color: "var(--text-primary)" }}
              >
                Name Overrides ({overridesLoading ? "..." : overrides.length})
              </h2>

              {overridesLoading ? (
                <div className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading overrides...
                </div>
              ) : (
                <>
                  {overrides.length > 0 && (
                    <div
                      className="rounded-lg overflow-hidden mb-3"
                      style={{
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-secondary)",
                      }}
                    >
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <th
                              className="text-left text-xs font-medium uppercase px-4 py-2"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Phorest Name
                            </th>
                            <th
                              className="text-left text-xs font-medium uppercase px-4 py-2"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Maps To
                            </th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {overrides.map((o) => (
                            <tr
                              key={o.id}
                              style={{ borderBottom: "1px solid var(--border-color)" }}
                            >
                              <td
                                className="px-4 py-2 text-sm"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {o.phorest_name}
                              </td>
                              <td
                                className="px-4 py-2 text-sm"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {o.staff_display_name}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  className="text-sm"
                                  style={{ color: "#f87171" }}
                                  onClick={() => handleDeleteOverride(o.id)}
                                  aria-label={`Delete override ${o.phorest_name}`}
                                >
                                  &times;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Inline add form */}
                  {addingOverride ? (
                    <div className="flex items-end gap-3 mt-2">
                      <div>
                        <label
                          className="block text-xs font-medium mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Phorest Name
                        </label>
                        <input
                          className="rounded text-sm px-3 py-1.5"
                          style={{
                            background: "var(--input-bg)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                          value={overrideForm.phorestName}
                          onChange={(e) =>
                            setOverrideForm((f) => ({ ...f, phorestName: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs font-medium mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Maps To Staff Name
                        </label>
                        <input
                          className="rounded text-sm px-3 py-1.5"
                          style={{
                            background: "var(--input-bg)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                          value={overrideForm.staffDisplayName}
                          onChange={(e) =>
                            setOverrideForm((f) => ({ ...f, staffDisplayName: e.target.value }))
                          }
                        />
                      </div>
                      <button
                        className="px-3 py-1.5 text-sm rounded font-medium"
                        style={{ background: "var(--gold)", color: "#0a0b0e" }}
                        onClick={handleAddOverride}
                      >
                        Add
                      </button>
                      <button
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                        onClick={() => {
                          setAddingOverride(false);
                          setOverrideForm({ phorestName: "", staffDisplayName: "" });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-sm font-medium"
                      style={{ color: "var(--gold)" }}
                      onClick={() => setAddingOverride(true)}
                    >
                      + Add Override
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Staff Modal ── */}
      {(editingStaff || isAdding) && (
        <StaffModal
          staff={isAdding ? null : editingStaff}
          isAdding={isAdding}
          branchId={activeBranch}
          onSave={async (data) => {
            await addStaff(data);
          }}
          onUpdate={async (id, data) => {
            await updateStaff(id, data);
          }}
          onToggleActive={toggleActive}
          onClose={() => {
            setEditingStaff(null);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}
