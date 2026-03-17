"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import {
  useProperties,
  useHMUsers,
  useUserProperties,
} from "@/lib/hospitalityHooks";
import type { HMProperty, HMPropertyInsert } from "@/types/hospitality";
import AddressAutocomplete from "./AddressAutocomplete";

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
// QR CODE CELL
// ═══════════════════════════════════════════════════════════════════════════════

function QRCodeCell({ property }: { property: HMProperty }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showQR, setShowQR] = useState(false);

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/hospitality/request/${property.qr_code_id}`;

  useEffect(() => {
    QRCode.toDataURL(qrUrl, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [qrUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${property.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>QR Code - ${property.name}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;}
      img{max-width:300px;}h2{margin-bottom:8px;}p{color:#666;font-size:14px;}</style></head>
      <body><h2>${property.name}</h2><p>Scan to submit a maintenance request</p>
      <img src="${qrDataUrl}" /><script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div>
      <button
        onClick={() => setShowQR(!showQR)}
        className="text-xs px-2 py-1 rounded border transition-all"
        style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
      >
        {showQR ? "Hide QR" : "Show QR"}
      </button>
      {showQR && qrDataUrl && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <img src={qrDataUrl} alt={`QR code for ${property.name}`} className="w-[200px] h-[200px]" />
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="text-xs px-2 py-1 rounded border transition-all"
              style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
            >
              Download
            </button>
            <button
              onClick={handlePrint}
              className="text-xs px-2 py-1 rounded border transition-all"
              style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
            >
              Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════════════════════

function PropertyAssignments({ propertyId }: { propertyId: string }) {
  const { users } = useHMUsers();
  const { userProperties, assignProperty, unassignProperty, refetch } = useUserProperties();

  const assignedUPs = userProperties.filter((up) => up.property_id === propertyId);
  const assignedUserIds = new Set(assignedUPs.map((up) => up.user_id));
  const unassignedUsers = users.filter((u) => u.is_active && !assignedUserIds.has(u.id));

  const handleAssign = async (userId: string) => {
    try {
      await assignProperty(userId, propertyId);
      refetch();
    } catch (err) {
      console.error("Failed to assign user:", err);
    }
  };

  const handleUnassign = async (upId: string) => {
    try {
      await unassignProperty(upId);
      refetch();
    } catch (err) {
      console.error("Failed to unassign user:", err);
    }
  };

  return (
    <div className="mt-2">
      <p className="text-xs font-sans mb-1" style={{ color: "var(--text-muted)" }}>
        Assigned Users:
      </p>
      <div className="flex flex-wrap gap-1 mb-2">
        {assignedUPs.length === 0 && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>None</span>
        )}
        {assignedUPs.map((up) => {
          const user = users.find((u) => u.id === up.user_id);
          return (
            <span
              key={up.id}
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(212,175,55,0.1)", color: "var(--gold)", border: "1px solid rgba(212,175,55,0.2)" }}
            >
              {user?.name || "Unknown"} ({user?.role || "?"})
              <button
                onClick={() => handleUnassign(up.id)}
                className="ml-0.5 hover:opacity-70"
                style={{ color: "var(--gold)" }}
              >
                x
              </button>
            </span>
          );
        })}
      </div>
      {unassignedUsers.length > 0 && (
        <select
          onChange={(e) => {
            if (e.target.value) handleAssign(e.target.value);
            e.target.value = "";
          }}
          style={{ ...inputStyle, maxWidth: "200px", fontSize: "0.75rem" }}
          defaultValue=""
        >
          <option value="">+ Assign user...</option>
          {unassignedUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface PropertyFormProps {
  property: HMProperty | null;
  onSave: (data: HMPropertyInsert) => Promise<unknown>;
  onUpdate: (id: string, data: Partial<HMPropertyInsert>) => Promise<unknown>;
  onClose: () => void;
}

function PropertyFormModal({ property, onSave, onUpdate, onClose }: PropertyFormProps) {
  const isEditing = !!property;
  const [form, setForm] = useState({
    name: property?.name ?? "",
    address: property?.address ?? "",
    city: property?.city ?? "",
    state: property?.state ?? "",
    zip: property?.zip ?? "",
    lat: property?.lat?.toString() ?? "",
    lng: property?.lng?.toString() ?? "",
    notes: property?.notes ?? "",
    hourly_rate: property?.hourly_rate?.toString() ?? "",
    is_retainer: property?.is_retainer ?? false,
    retainer_amount: property?.retainer_amount?.toString() ?? "",
    retainer_start_date: property?.retainer_start_date ?? "",
    retainer_end_date: property?.retainer_end_date ?? "",
  });
  const [saving, setSaving] = useState(false);

  const canSubmit = form.name.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const payload: HMPropertyInsert = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        notes: form.notes.trim() || null,
        is_active: true,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        is_retainer: form.is_retainer,
        retainer_amount: form.retainer_amount ? parseFloat(form.retainer_amount) : null,
        retainer_start_date: form.retainer_start_date || null,
        retainer_end_date: form.retainer_end_date || null,
      };

      if (isEditing && property) {
        await onUpdate(property.id, payload);
      } else {
        await onSave(payload);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save property:", err);
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
        className="w-full max-w-lg rounded-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl mb-4" style={{ color: "var(--gold)" }}>
          {isEditing ? "Edit Property" : "Add Property"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Property name"
            />
          </div>
          <div className="col-span-2">
            <AddressAutocomplete
              value={form.address}
              onChange={(val) => setForm((f) => ({ ...f, address: val }))}
              onSelect={(result) =>
                setForm((f) => ({
                  ...f,
                  address: result.address,
                  city: result.city,
                  state: result.state,
                  zip: result.zip,
                  lat: result.lat.toString(),
                  lng: result.lng.toString(),
                }))
              }
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input
              style={inputStyle}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input
              style={inputStyle}
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Zip</label>
            <input
              style={inputStyle}
              value={form.zip}
              onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Latitude</label>
            <input
              style={inputStyle}
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
              readOnly
              tabIndex={-1}
            />
          </div>
          <div>
            <label style={labelStyle}>Longitude</label>
            <input
              style={inputStyle}
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
              readOnly
              tabIndex={-1}
            />
          </div>
          {/* Billing Section */}
          <div className="col-span-2 border-t pt-3 mt-1" style={{ borderColor: "var(--border-light)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--gold)" }}>
              Billing
            </p>
          </div>

          {/* Retainer Toggle */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, is_retainer: !f.is_retainer }))}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{
                  background: form.is_retainer ? "var(--gold)" : "var(--input-bg)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform"
                  style={{
                    background: form.is_retainer ? "#0a0b0e" : "var(--text-muted)",
                    transform: form.is_retainer ? "translateX(20px)" : "translateX(3px)",
                  }}
                />
              </div>
              <span style={{ ...labelStyle, marginBottom: 0 }}>
                On Retainer
              </span>
            </label>
          </div>

          {/* Hourly Rate (shown when NOT on retainer) */}
          {!form.is_retainer && (
            <div className="col-span-2">
              <label style={labelStyle}>Hourly Rate ($)</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                value={form.hourly_rate}
                onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Retainer Fields (shown when on retainer) */}
          {form.is_retainer && (
            <>
              <div className="col-span-2">
                <label style={labelStyle}>Retainer Amount ($)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.retainer_amount}
                  onChange={(e) => setForm((f) => ({ ...f, retainer_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.retainer_start_date}
                  onChange={(e) => setForm((f) => ({ ...f, retainer_start_date: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Renewal / Expiry Date</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.retainer_end_date}
                  onChange={(e) => setForm((f) => ({ ...f, retainer_end_date: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="col-span-2">
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
            {saving ? "Saving..." : isEditing ? "Update" : "Add Property"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export default function PropertyManager() {
  const { properties, loading, addProperty, updateProperty, togglePropertyActive } = useProperties();
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<HMProperty | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleEdit = useCallback((property: HMProperty) => {
    setEditingProperty(property);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingProperty(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span style={{ color: "var(--gold)" }}>Loading properties...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
          Properties ({properties.length})
        </h2>
        <button
          onClick={() => { setEditingProperty(null); setShowForm(true); }}
          className="px-4 py-2 rounded-md text-sm font-sans transition-all"
          style={{ background: "var(--gold)", color: "#0a0b0e", fontWeight: 600 }}
        >
          + Add Property
        </button>
      </div>

      <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-tertiary)" }}>
              <th className="text-left px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Name</th>
              <th className="text-left px-4 py-3 font-sans font-medium hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>Address</th>
              <th className="text-left px-4 py-3 font-sans font-medium hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>City/State</th>
              <th className="text-left px-4 py-3 font-sans font-medium hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>Billing</th>
              <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Status</th>
              <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>QR</th>
              <th className="text-center px-4 py-3 font-sans font-medium" style={{ color: "var(--text-secondary)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p, i) => (
              <tr
                key={p.id}
                style={{ background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--card-bg)" }}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className="text-left hover:opacity-80 transition-all"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                  {p.address || "-"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                  {[p.city, p.state].filter(Boolean).join(", ") || "-"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>
                  {p.is_retainer ? (
                    <span className="text-xs">
                      <span className="font-medium" style={{ color: "var(--gold)" }}>Retainer</span>
                      {p.retainer_amount != null && ` $${p.retainer_amount.toLocaleString()}`}
                    </span>
                  ) : p.hourly_rate != null ? (
                    <span className="text-xs">${p.hourly_rate}/hr</span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: p.is_active ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.1)",
                      color: p.is_active ? "#4ade80" : "#9ca3af",
                      border: `1px solid ${p.is_active ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.2)"}`,
                    }}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <QRCodeCell property={p} />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-xs px-2 py-1 rounded border transition-all"
                      style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePropertyActive(p.id, !p.is_active)}
                      className="text-xs px-2 py-1 rounded border transition-all"
                      style={{
                        borderColor: "var(--border-color)",
                        color: p.is_active ? "#f87171" : "#4ade80",
                      }}
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No properties yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded property details (assignments) */}
      {expandedId && (
        <div
          className="mt-2 p-4 rounded-lg border"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
        >
          <h3 className="text-sm font-sans font-medium mb-2" style={{ color: "var(--gold)" }}>
            {properties.find((p) => p.id === expandedId)?.name} - User Assignments
          </h3>
          <PropertyAssignments propertyId={expandedId} />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <PropertyFormModal
          property={editingProperty}
          onSave={addProperty}
          onUpdate={updateProperty}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
