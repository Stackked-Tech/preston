"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import Link from "next/link";
import {
  useBranches,
  useStaff,
  useNameOverrides,
  useTemplates,
  onboardEmployee,
} from "@/lib/employeeAdminHooks";
import type {
  EABranch,
  EAStaff,
  EAStaffInsert,
  EAStaffStatus,
  EANameOverrideInsert,
  OnboardEmployeeRequest,
} from "@/types/employeeadmin";

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_BADGE_STYLES: Record<EAStaffStatus, { bg: string; color: string; border: string }> = {
  active: { bg: "rgba(34,197,94,0.1)", color: "#4ade80", border: "rgba(34,197,94,0.2)" },
  onboarding: { bg: "rgba(212,175,55,0.1)", color: "#d4af37", border: "rgba(212,175,55,0.2)" },
  inactive: { bg: "rgba(156,163,175,0.1)", color: "#9ca3af", border: "rgba(156,163,175,0.2)" },
  terminated: { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" },
};

function StatusBadge({ status }: { status: EAStaffStatus }) {
  const s = STATUS_BADGE_STYLES[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}

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
    status: (staff?.status || 'active') as string,
    exclude_from_payroll: staff?.exclude_from_payroll ?? false,
  });
  const [saving, setSaving] = useState(false);

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
        is_active: form.status === 'active' || form.status === 'onboarding',
        exclude_from_payroll: form.exclude_from_payroll,
        status: form.status as EAStaffStatus,
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

        {/* Status dropdown — edit mode only */}
        {!isAdding && staff && (
          <div className="mt-4">
            <label style={labelStyle}>Status</label>
            <select
              className="text-sm"
              style={{
                ...inputStyle,
              }}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        )}

        {/* Exclude from Payroll toggle */}
        <div className="mt-4">
          <label
            className="flex items-center gap-3 cursor-pointer select-none"
            style={{ color: "var(--text-secondary)" }}
          >
            <div
              className="relative inline-flex items-center rounded-full transition-colors"
              style={{
                width: 36,
                height: 20,
                background: form.exclude_from_payroll ? "var(--gold)" : "var(--border-color)",
              }}
              onClick={() => setForm((f) => ({ ...f, exclude_from_payroll: !f.exclude_from_payroll }))}
            >
              <div
                className="absolute rounded-full bg-white transition-transform"
                style={{
                  width: 16,
                  height: 16,
                  top: 2,
                  left: form.exclude_from_payroll ? 18 : 2,
                }}
              />
            </div>
            <span className="text-sm">Exclude from Payroll</span>
          </label>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Staff excluded from payroll will still appear in Employee Admin but won&apos;t show in Payout Suite.
          </p>
        </div>

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
// ONBOARD MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface OnboardModalProps {
  branchId: string;
  branches: EABranch[];
  onSuccess: () => void;
  onClose: () => void;
}

function OnboardModal({ branchId, branches, onSuccess, onClose }: OnboardModalProps) {
  const { templates, loading: templatesLoading } = useTemplates();
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    branch_id: branchId,
    template_id: "",
    target_first: "",
    target_last: "",
    station_lease: "",
    financial_services: "-100",
    phorest_fee: "-10",
    refreshment: "-10",
    associate_pay: "",
    supervisor: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parts = form.display_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      setForm((f) => ({ ...f, target_first: parts[0], target_last: parts[parts.length - 1] }));
    } else if (parts.length === 1 && parts[0]) {
      setForm((f) => ({ ...f, target_first: parts[0], target_last: "" }));
    }
  }, [form.display_name]);

  const canSubmit = form.display_name.trim() !== "" && form.email.trim() !== "" && form.template_id !== "" && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: OnboardEmployeeRequest = {
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        branch_id: form.branch_id,
        template_id: form.template_id,
        target_first: form.target_first.trim(),
        target_last: form.target_last.trim(),
        station_lease: Number(form.station_lease) || 0,
        financial_services: Number(form.financial_services) || 0,
        phorest_fee: Number(form.phorest_fee) || 0,
        refreshment: Number(form.refreshment) || 0,
        ...(form.associate_pay.trim() !== "" && { associate_pay: Number(form.associate_pay) }),
        ...(form.supervisor.trim() !== "" && { supervisor: form.supervisor.trim() }),
      };
      await onboardEmployee(payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to onboard employee");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--input-bg)", border: "1px solid var(--border-color)",
    color: "var(--text-primary)", borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem", width: "100%", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    color: "var(--text-secondary)", fontSize: "0.75rem",
    fontWeight: 500, marginBottom: "0.25rem", display: "block",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl mb-1" style={{ color: "var(--gold)" }}>Onboard New Employee</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Creates account, sends invite email, and assigns onboarding document</p>

        {error && (
          <div className="rounded-md p-3 mb-4 text-sm" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Jane Smith" />
          </div>
          <div className="col-span-2">
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            <select className="text-sm" style={inputStyle} value={form.branch_id} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
              {branches.map((b) => (<option key={b.branch_id} value={b.branch_id}>{b.name}</option>))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Onboarding Template *</label>
            <select className="text-sm" style={inputStyle} value={form.template_id} onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}>
              <option value="">Select template...</option>
              {templatesLoading ? (<option disabled>Loading...</option>) : (
                templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))
              )}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Station Lease</label>
            <input style={inputStyle} type="number" value={form.station_lease} onChange={(e) => setForm((f) => ({ ...f, station_lease: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Financial Services</label>
            <input style={inputStyle} type="number" value={form.financial_services} onChange={(e) => setForm((f) => ({ ...f, financial_services: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Phorest Fee</label>
            <input style={inputStyle} type="number" value={form.phorest_fee} onChange={(e) => setForm((f) => ({ ...f, phorest_fee: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Refreshment</label>
            <input style={inputStyle} type="number" value={form.refreshment} onChange={(e) => setForm((f) => ({ ...f, refreshment: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Associate Pay</label>
            <input style={inputStyle} type="number" placeholder="Empty = N/A" value={form.associate_pay} onChange={(e) => setForm((f) => ({ ...f, associate_pay: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Supervisor</label>
            <input style={inputStyle} placeholder="Empty = N/A" value={form.supervisor} onChange={(e) => setForm((f) => ({ ...f, supervisor: e.target.value }))} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button className="px-4 py-2 text-sm rounded" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }} onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 text-sm rounded font-medium" style={{ background: canSubmit ? "var(--gold)" : "var(--input-bg)", color: canSubmit ? "#0a0b0e" : "var(--text-muted)", cursor: canSubmit ? "pointer" : "not-allowed" }} disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Creating..." : "Onboard Employee"}
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
  const [isOnboarding, setIsOnboarding] = useState(false);
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
    refetch,
  } = useStaff(activeBranch);

  const {
    overrides,
    loading: overridesLoading,
    addOverride,
    deleteOverride,
  } = useNameOverrides(activeBranch);

  // Counts
  const activeCount = staff.filter((s) => s.status === 'active' || s.status === 'onboarding').length;
  const inactiveCount = staff.filter((s) => s.status === 'inactive' || s.status === 'terminated').length;
  const visibleStaff = showInactive ? staff : staff.filter((s) => s.status === 'active' || s.status === 'onboarding');

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
                  onClick={() => setIsOnboarding(true)}
                >
                  Onboard New Employee
                </button>
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
                    {["Name", "Status", "Onboarding Doc", "NetSuite ID", "Station Lease", "Fin. Services", "Phorest Fee", "Refreshment"].map(
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
                        colSpan={8}
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
                          {s.exclude_from_payroll && (
                            <span
                              className="ml-2 text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(212,175,55,0.1)",
                                color: "#d4af37",
                                border: "1px solid rgba(212,175,55,0.2)",
                              }}
                            >
                              No Payroll
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={s.status || 'active'} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {s.onboarding_envelope_id ? (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={
                              s.status !== 'onboarding'
                                ? { background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }
                                : { background: "rgba(212,175,55,0.1)", color: "#d4af37", border: "1px solid rgba(212,175,55,0.2)" }
                            }>
                              {s.status === 'onboarding' ? 'Pending' : 'Signed'}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>&mdash;</span>
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

      {isOnboarding && (
        <OnboardModal
          branchId={activeBranch}
          branches={branches}
          onSuccess={() => refetch()}
          onClose={() => setIsOnboarding(false)}
        />
      )}
    </div>
  );
}
