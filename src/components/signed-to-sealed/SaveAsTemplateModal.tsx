"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { STSRecipient, STSDocument, STSField } from "@/types/signedtosealed";

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: STSRecipient[];
  documents: STSDocument[];
  fields: STSField[];
  title: string;
  message: string;
  onSaved: () => void;
}

export default function SaveAsTemplateModal({
  isOpen,
  onClose,
  recipients,
  documents,
  fields,
  title,
  message,
  onSaved,
}: SaveAsTemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [roleNames, setRoleNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    recipients.forEach((r) => {
      initial[r.id] = "";
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError("Template name is required");
      return;
    }

    // Validate all role names are filled
    for (const r of recipients) {
      if (!roleNames[r.id]?.trim()) {
        setError(`Please enter a role name for ${r.name}`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Create template record
      const roles = recipients.map((r) => ({
        name: roleNames[r.id],
        role: r.role,
        signing_order: r.signing_order,
      }));

      const { data: template, error: templateError } = await supabase
        .from("sts_templates")
        .insert({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          envelope_config: { title, message, roles },
        })
        .select()
        .single();

      if (templateError) throw templateError;
      if (!template) throw new Error("Failed to create template");

      // 2. Copy documents to template storage
      const docIdMap: Record<string, string> = {};

      for (const doc of documents) {
        const newPath = `templates/${template.id}/${Date.now()}_${doc.file_name}`;
        const { error: copyError } = await supabase.storage
          .from("sts-documents")
          .copy(doc.file_path, newPath);
        if (copyError) throw copyError;

        const { data: templateDoc, error: docError } = await supabase
          .from("sts_template_documents")
          .insert({
            template_id: template.id,
            file_name: doc.file_name,
            file_path: newPath,
            file_size: doc.file_size,
            page_count: doc.page_count,
            sort_order: doc.sort_order,
          })
          .select()
          .single();

        if (docError) throw docError;
        if (!templateDoc) throw new Error("Failed to create template document");
        docIdMap[doc.id] = templateDoc.id;
      }

      // 3. Clone fields to template fields
      for (const field of fields) {
        const templateDocId = docIdMap[field.document_id];
        const recipient = recipients.find((r) => r.id === field.recipient_id);
        const roleName = recipient ? roleNames[recipient.id] : "Unknown";
        if (!templateDocId) continue;

        const { error: fieldError } = await supabase
          .from("sts_template_fields")
          .insert({
            template_id: template.id,
            template_document_id: templateDocId,
            role_name: roleName,
            field_type: field.field_type,
            fill_mode: "recipient",
            label: "",
            page_number: field.page_number,
            x_position: field.x_position,
            y_position: field.y_position,
            width: field.width,
            height: field.height,
            is_required: field.is_required,
            dropdown_options: field.dropdown_options,
          });

        if (fieldError) throw fieldError;
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
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
          <h2
            className="text-base font-medium tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Save as Template
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-all hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Template Name */}
          <div>
            <label
              className="text-xs block mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Template Name *
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard Purchase Agreement"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              className="text-xs block mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Description
            </label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Role Names */}
          {recipients.length > 0 && (
            <div>
              <label
                className="text-xs tracking-[1px] uppercase block mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Name each role
              </label>
              <div className="space-y-3">
                {recipients.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border-light)",
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: r.color_hex }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {r.name} ({r.role})
                      </p>
                      <input
                        type="text"
                        value={roleNames[r.id] || ""}
                        onChange={(e) =>
                          setRoleNames((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        placeholder={`e.g., Buyer, Seller, Witness...`}
                        className="w-full px-2 py-1.5 rounded border text-xs outline-none"
                        style={{
                          background: "var(--input-bg)",
                          borderColor: "var(--border-color)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs" style={{ color: "#ef4444" }}>
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
            disabled={saving}
            className="text-xs px-4 py-2 rounded-md border transition-all hover:opacity-80"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="text-xs px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: saving || !templateName.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
