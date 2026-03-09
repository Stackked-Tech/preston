"use client";

import { useState } from "react";
import {
  useTemplateDetail,
  useTemplateDocuments,
  useTemplateFields,
  createEnvelopeFromTemplate,
} from "@/lib/signedToSealedHooks";
import type { RecipientRole } from "@/types/signedtosealed";

interface RoleMappingModalProps {
  isOpen: boolean;
  templateId: string;
  onClose: () => void;
  onCreated: (envelopeId: string) => void;
}

export default function RoleMappingModal({
  isOpen,
  templateId,
  onClose,
  onCreated,
}: RoleMappingModalProps) {
  const { template, loading: loadingTemplate } = useTemplateDetail(templateId);
  const { documents, loading: loadingDocs } = useTemplateDocuments(templateId);
  const { fields, loading: loadingFields } = useTemplateFields(templateId);

  const roles = template?.envelope_config?.roles ?? [];

  const [mappings, setMappings] = useState<
    Record<string, { name: string; email: string }>
  >({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const loading = loadingTemplate || loadingDocs || loadingFields;

  const updateMapping = (
    roleName: string,
    field: "name" | "email",
    value: string
  ) => {
    setMappings((prev) => ({
      ...prev,
      [roleName]: {
        name: prev[roleName]?.name ?? "",
        email: prev[roleName]?.email ?? "",
        [field]: value,
      },
    }));
  };

  const allFilled = roles.every((r) => {
    const m = mappings[r.name];
    return m && m.name.trim() && m.email.trim();
  });

  const handleCreate = async () => {
    if (!template || !allFilled) return;
    setCreating(true);
    setError(null);
    try {
      const roleMappings = roles.map((r) => ({
        roleName: r.name,
        name: mappings[r.name].name.trim(),
        email: mappings[r.name].email.trim(),
        role: r.role as RecipientRole,
        signing_order: r.signing_order,
      }));

      const envelopeId = await createEnvelopeFromTemplate(
        template,
        documents,
        fields,
        roleMappings
      );
      onCreated(envelopeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create envelope");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-lg border shadow-xl"
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <h2
              className="text-base font-medium tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              Create from {template?.name ?? "Template"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Map each role to a real person
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-all hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: "var(--text-muted)" }}
            >
              Loading template...
            </p>
          ) : roles.length === 0 ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: "var(--text-muted)" }}
            >
              This template has no roles defined.
            </p>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.name}
                  className="p-4 rounded-lg border"
                  style={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <p
                    className="text-xs font-medium tracking-[1px] uppercase mb-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {role.name}{" "}
                    <span className="normal-case tracking-normal font-normal">
                      ({role.role})
                    </span>
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label
                        className="text-[10px] block mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Name
                      </label>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={mappings[role.name]?.name ?? ""}
                        onChange={(e) =>
                          updateMapping(role.name, "name", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-md border text-sm outline-none"
                        style={{
                          background: "var(--input-bg)",
                          borderColor: "var(--border-color)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        className="text-[10px] block mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="email@example.com"
                        value={mappings[role.name]?.email ?? ""}
                        onChange={(e) =>
                          updateMapping(role.name, "email", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-md border text-sm outline-none"
                        style={{
                          background: "var(--input-bg)",
                          borderColor: "var(--border-color)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs mt-3 text-center" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: "var(--border-color)" }}
        >
          <button
            onClick={onClose}
            disabled={creating}
            className="text-xs px-4 py-2 rounded-md border transition-all hover:opacity-80"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!allFilled || creating || loading}
            className="text-xs px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: !allFilled || creating || loading ? 0.5 : 1,
            }}
          >
            {creating ? "Creating..." : "Create Envelope"}
          </button>
        </div>
      </div>
    </div>
  );
}
