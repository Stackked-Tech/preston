"use client";

import { useState } from "react";
import { useTemplates } from "@/lib/signedToSealedHooks";
import type { STSTemplateConfig, RecipientRole } from "@/types/signedtosealed";

interface TemplateManagerProps {
  onBack: () => void;
}

export default function TemplateManager({ onBack }: TemplateManagerProps) {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configTitle, setConfigTitle] = useState("");
  const [configMessage, setConfigMessage] = useState("");
  const [roles, setRoles] = useState<{ name: string; role: RecipientRole; signing_order: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setConfigTitle("");
    setConfigMessage("");
    setRoles([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (!t) return;
    setEditingId(id);
    setName(t.name);
    setDescription(t.description);
    setConfigTitle(t.envelope_config.title || "");
    setConfigMessage(t.envelope_config.message || "");
    setRoles(t.envelope_config.roles || []);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const config: STSTemplateConfig = {
      title: configTitle,
      message: configMessage,
      roles: roles,
    };
    try {
      if (editingId) {
        await updateTemplate(editingId, { name, description, envelope_config: config });
      } else {
        await createTemplate({ name, description, envelope_config: config });
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await deleteTemplate(id);
  };

  const addRole = () => {
    setRoles([...roles, { name: "", role: "signer", signing_order: roles.length + 1 }]);
  };

  const updateRole = (index: number, updates: Partial<{ name: string; role: RecipientRole; signing_order: number }>) => {
    setRoles(roles.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>Templates</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Save envelope configurations for reuse
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-4 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
            style={{ background: "var(--gold)", color: "#0a0b0e" }}
          >
            + New Template
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="p-6 rounded-lg border mb-8"
          style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
        >
          <h4 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            {editingId ? "Edit Template" : "New Template"}
          </h4>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard NDA"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Default Envelope Title</label>
              <input
                type="text"
                value={configTitle}
                onChange={(e) => setConfigTitle(e.target.value)}
                placeholder="Default title for envelopes using this template"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Default Message</label>
              <textarea
                value={configMessage}
                onChange={(e) => setConfigMessage(e.target.value)}
                placeholder="Default message to recipients"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Roles */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs" style={{ color: "var(--text-muted)" }}>Recipient Roles</label>
                <button onClick={addRole} className="text-xs" style={{ color: "var(--gold)" }}>+ Add Role</button>
              </div>
              {roles.map((role, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={role.name}
                    onChange={(e) => updateRole(i, { name: e.target.value })}
                    placeholder="Role name (e.g., Buyer)"
                    className="flex-1 px-2 py-1.5 rounded border text-sm outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                  <select
                    value={role.role}
                    onChange={(e) => updateRole(i, { role: e.target.value as RecipientRole })}
                    className="px-2 py-1.5 rounded border text-sm outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  >
                    <option value="signer">Signer</option>
                    <option value="cc">CC</option>
                    <option value="in_person">In Person</option>
                  </select>
                  <button onClick={() => removeRole(i)} className="text-xs px-2" style={{ color: "#ef4444" }}>×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="text-xs px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
                style={{ background: "var(--gold)", color: "#0a0b0e", opacity: saving || !name.trim() ? 0.5 : 1 }}
              >
                {saving ? "Saving..." : editingId ? "Update Template" : "Create Template"}
              </button>
              <button
                onClick={resetForm}
                className="text-xs px-3 py-2 rounded-md border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template List */}
      {templates.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <p className="text-lg mb-2" style={{ color: "var(--text-muted)" }}>No templates yet</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Create templates to speed up envelope creation
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 p-4 rounded-lg border"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
            >
              <span className="text-lg">📋</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                {t.description && (
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                )}
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {t.envelope_config.roles?.length || 0} roles defined
                  {t.envelope_config.title && ` · "${t.envelope_config.title}"`}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(t.id)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "#ef4444" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
