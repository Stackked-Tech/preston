"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useTemplates,
  useTemplateDetail,
  useTemplateDocuments,
  useTemplateFields,
} from "@/lib/signedToSealedHooks";
import type {
  STSRecipient,
  STSField,
  STSTemplateDocument,
  STSTemplateField,
  FieldType,
  RecipientRole,
  RecipientStatus,
  FillMode,
} from "@/types/signedtosealed";
import { RECIPIENT_COLORS, FIELD_DEFAULT_SIZES } from "@/types/signedtosealed";
import { supabase } from "@/lib/supabase";
import DocumentViewer from "./DocumentViewer";
import FieldPalette from "./FieldPalette";

interface TemplateBuilderProps {
  templateId: string | null; // null = creating new template
  onComplete: () => void;
  onCancel: () => void;
}

interface TemplateRole {
  name: string;
  role: RecipientRole;
  signing_order: number;
}

const STEPS = ["Details & Upload", "Roles", "Place Fields"];

export default function TemplateBuilder({ templateId, onComplete, onCancel }: TemplateBuilderProps) {
  const { createTemplate, updateTemplate } = useTemplates();

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const { template } = useTemplateDetail(activeTemplateId);
  const { documents, uploadTemplateDocument, updatePageCount, deleteTemplateDocument, getPublicUrl } = useTemplateDocuments(activeTemplateId);
  const { fields: templateFields, addTemplateField, updateTemplateField, removeTemplateField } = useTemplateFields(activeTemplateId);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [roles, setRoles] = useState<TemplateRole[]>([]);
  const [uploading, setUploading] = useState(false);

  // Field placement state
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Fill mode popover state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Role editing state
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleType, setNewRoleType] = useState<RecipientRole>("signer");
  const [editingRoleIndex, setEditingRoleIndex] = useState<number | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleType, setEditRoleType] = useState<RecipientRole>("signer");

  // Track auto-created templates for cleanup on cancel
  const wasAutoCreated = useRef(false);
  const creatingRef = useRef(false);

  // Sync from loaded template — only on first load
  const initialSynced = useRef(false);
  useEffect(() => {
    if (template && !initialSynced.current) {
      setName(template.name);
      setDescription(template.description);
      setDefaultTitle(template.envelope_config?.title || "");
      setDefaultMessage(template.envelope_config?.message || "");
      setRoles(template.envelope_config?.roles || []);
      initialSynced.current = true;
    }
  }, [template]);

  // Auto-create template on mount if new
  useEffect(() => {
    if (!activeTemplateId && !creatingRef.current) {
      creatingRef.current = true;
      createTemplate({
        name: "Untitled Template",
        description: "",
        envelope_config: { title: "", message: "", roles: [] },
      })
        .then((t) => {
          setActiveTemplateId(t.id);
          wasAutoCreated.current = true;
        })
        .catch(() => {
          creatingRef.current = false;
        });
    }
  }, [activeTemplateId, createTemplate]);

  // Save metadata helper
  const saveMetadata = useCallback(async () => {
    if (!activeTemplateId) return;
    await updateTemplate(activeTemplateId, {
      name: name || "Untitled Template",
      description,
      envelope_config: {
        title: defaultTitle,
        message: defaultMessage,
        roles,
      },
    });
  }, [activeTemplateId, name, description, defaultTitle, defaultMessage, roles, updateTemplate]);

  // Cancel handler — cleans up auto-created template if user never did meaningful work
  const handleCancel = async () => {
    if (wasAutoCreated.current && activeTemplateId) {
      // Delete any uploaded docs from storage first
      for (const doc of documents) {
        await supabase.storage.from("sts-documents").remove([doc.file_path]);
      }
      await supabase.from("sts_templates").delete().eq("id", activeTemplateId);
    }
    onCancel();
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTemplateId || !e.target.files) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        if (file.type !== "application/pdf") {
          alert(`${file.name} is not a PDF. Only PDF files are supported.`);
          continue;
        }
        await uploadTemplateDocument(file, documents.length);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveDoc = async (doc: STSTemplateDocument) => {
    if (!confirm(`Remove ${doc.file_name}?`)) return;
    await deleteTemplateDocument(doc.id, doc.file_path);
  };

  // Role CRUD
  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const order = roles.length > 0 ? Math.max(...roles.map((r) => r.signing_order)) + 1 : 1;
    setRoles((prev) => [...prev, { name: newRoleName.trim(), role: newRoleType, signing_order: order }]);
    setNewRoleName("");
    setNewRoleType("signer");
  };

  const handleUpdateRole = (index: number) => {
    if (!editRoleName.trim()) return;
    setRoles((prev) =>
      prev.map((r, i) => (i === index ? { ...r, name: editRoleName.trim(), role: editRoleType } : r))
    );
    setEditingRoleIndex(null);
  };

  const handleRemoveRole = (index: number) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const startEditRole = (index: number) => {
    setEditingRoleIndex(index);
    setEditRoleName(roles[index].name);
    setEditRoleType(roles[index].role);
  };

  // Create pseudo-recipients from roles for DocumentViewer/FieldPalette
  const pseudoRecipients: STSRecipient[] = roles.map((role, i) => ({
    id: role.name,
    envelope_id: "",
    name: role.name,
    email: "",
    role: role.role,
    signing_order: role.signing_order,
    status: "pending" as RecipientStatus,
    color_hex: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length],
    access_token: "",
    viewed_at: null,
    signed_at: null,
    created_at: "",
    updated_at: "",
  }));

  // Map template fields to STSField format for DocumentViewer
  const fieldsAsSTSFields: STSField[] = templateFields
    .filter((f) => f.template_document_id === documents[selectedDocIndex]?.id)
    .map((f) => ({
      id: f.id,
      envelope_id: "",
      document_id: f.template_document_id,
      recipient_id: f.role_name,
      field_type: f.field_type,
      page_number: f.page_number,
      x_position: f.x_position,
      y_position: f.y_position,
      width: f.width,
      height: f.height,
      is_required: f.is_required,
      dropdown_options: f.dropdown_options,
      field_value: null,
      fill_mode: f.fill_mode,
      label: f.label,
      created_at: f.created_at,
    }));

  // Field drop handler
  const handleDropField = async (fieldType: FieldType, roleName: string, page: number, xPct: number, yPct: number) => {
    if (!activeTemplateId || documents.length === 0) return;
    const doc = documents[selectedDocIndex];
    if (!doc) return;

    const { width, height } = FIELD_DEFAULT_SIZES[fieldType];

    await addTemplateField({
      template_id: activeTemplateId,
      template_document_id: doc.id,
      role_name: roleName,
      field_type: fieldType,
      fill_mode: "recipient",
      label: "",
      page_number: page,
      x_position: xPct,
      y_position: yPct,
      width,
      height,
      is_required: true,
      dropdown_options: [],
    });
  };

  // Field move handler
  const handleFieldMove = async (fieldId: string, xPct: number, yPct: number) => {
    await updateTemplateField(fieldId, { x_position: xPct, y_position: yPct });
  };

  // Field resize handler
  const handleFieldResize = async (fieldId: string, width: number, height: number) => {
    await updateTemplateField(fieldId, { width, height });
  };

  const handlePageCountLoad = (count: number) => {
    if (documents[selectedDocIndex]) {
      updatePageCount(documents[selectedDocIndex].id, count);
    }
  };

  // Field click — show fill mode popover
  const handleFieldClick = (field: STSField) => {
    setSelectedRecipientId(field.recipient_id);
    setEditingFieldId(editingFieldId === field.id ? null : field.id);
  };

  // Update fill mode on a template field
  const handleFillModeChange = async (fieldId: string, fillMode: FillMode) => {
    await updateTemplateField(fieldId, { fill_mode: fillMode });
  };

  // Update label on a template field
  const handleLabelChange = async (fieldId: string, label: string) => {
    await updateTemplateField(fieldId, { label });
  };

  // Save template (final step)
  const handleSaveTemplate = async () => {
    await saveMetadata();
    onComplete();
  };

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0 && documents.length > 0;
    if (step === 1) return roles.length > 0;
    return true;
  };

  const currentDocUrl = documents[selectedDocIndex]
    ? getPublicUrl(documents[selectedDocIndex].file_path)
    : null;

  // Find the template field for the currently editing field popover
  const editingField = editingFieldId
    ? templateFields.find((f) => f.id === editingFieldId) || null
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => { if (i <= step) { saveMetadata(); setStep(i); } }}
              className="flex items-center gap-2 text-xs transition-all"
              style={{ color: i === step ? "var(--gold)" : i < step ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: i <= step ? "var(--gold)" : "var(--border-color)",
                  color: i <= step ? "#0a0b0e" : "var(--text-muted)",
                }}
              >
                {i < step ? "\u2713" : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px" style={{ background: i < step ? "var(--gold)" : "var(--border-color)" }} />
            )}
          </div>
        ))}
        <div className="flex-1" />
        <button
          onClick={handleCancel}
          className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
        >
          Cancel
        </button>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-hidden">
        {/* Step 0: Details + Upload */}
        {step === 0 && (
          <div className="px-6 sm:px-10 py-8 overflow-auto h-full">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>Template Details</h3>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Set a name, description, and upload your documents</p>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Template Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. New Client Agreement"
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description of this template..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Default Envelope Title</label>
                  <input
                    type="text"
                    value={defaultTitle}
                    onChange={(e) => setDefaultTitle(e.target.value)}
                    placeholder="Title used when creating envelopes from this template"
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Default Message</label>
                  <textarea
                    value={defaultMessage}
                    onChange={(e) => setDefaultMessage(e.target.value)}
                    placeholder="Default message to recipients..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <h4 className="text-xs tracking-[2px] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
                Documents ({documents.length})
              </h4>

              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 mb-2 rounded-lg border"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                >
                  <span className="text-lg">{"\uD83D\uDCC4"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{doc.file_name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{(doc.file_size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    onClick={() => handleRemoveDoc(doc)}
                    className="text-xs px-2 py-1 rounded hover:opacity-80"
                    style={{ color: "#ef4444" }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <label
                className="flex flex-col items-center gap-2 p-8 mt-2 rounded-lg border-2 border-dashed cursor-pointer transition-all hover:opacity-80"
                style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}
              >
                <span className="text-2xl">{"\uD83D\uDCCE"}</span>
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {uploading ? "Uploading..." : "Click to upload PDF files"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>PDF format only</span>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 1: Roles */}
        {step === 1 && (
          <div className="px-6 sm:px-10 py-8 overflow-auto h-full">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>Recipient Roles</h3>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Define the roles that will be filled when creating envelopes from this template</p>

              {/* Existing Roles */}
              <div className="space-y-2 mb-6">
                {roles.map((role, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: RECIPIENT_COLORS[index % RECIPIENT_COLORS.length] }}
                    >
                      {role.name.charAt(0).toUpperCase()}
                    </div>

                    {editingRoleIndex === index ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                          className="flex-1 px-2 py-1 rounded border text-sm outline-none"
                          style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdateRole(index); }}
                        />
                        <select
                          value={editRoleType}
                          onChange={(e) => setEditRoleType(e.target.value as RecipientRole)}
                          className="px-2 py-1 rounded border text-xs outline-none"
                          style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                        >
                          <option value="signer">Signer</option>
                          <option value="cc">CC</option>
                          <option value="in_person">In Person</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole(index)}
                          className="text-xs px-2 py-1 rounded font-medium"
                          style={{ background: "var(--gold)", color: "#0a0b0e" }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRoleIndex(null)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{role.name}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {role.role === "signer" ? "Signer" : role.role === "cc" ? "CC" : "In Person"} &middot; Order {role.signing_order}
                          </p>
                        </div>
                        <button
                          onClick={() => startEditRole(index)}
                          className="text-xs px-2 py-1 rounded hover:opacity-80"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveRole(index)}
                          className="text-xs px-2 py-1 rounded hover:opacity-80"
                          style={{ color: "#ef4444" }}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {roles.length === 0 && (
                  <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                    No roles added yet. Add at least one role below.
                  </p>
                )}
              </div>

              {/* Add Role Form */}
              <div
                className="p-4 rounded-lg border"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
              >
                <p className="text-xs tracking-[1px] uppercase mb-3" style={{ color: "var(--text-muted)" }}>Add Role</p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Role Name</label>
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g. Client, Witness, Manager"
                      className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddRole(); }}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Type</label>
                    <select
                      value={newRoleType}
                      onChange={(e) => setNewRoleType(e.target.value as RecipientRole)}
                      className="px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                    >
                      <option value="signer">Signer</option>
                      <option value="cc">CC</option>
                      <option value="in_person">In Person</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddRole}
                    disabled={!newRoleName.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                    style={{
                      background: "var(--gold)",
                      color: "#0a0b0e",
                      opacity: newRoleName.trim() ? 1 : 0.5,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Place Fields */}
        {step === 2 && (
          <div className="flex h-full">
            {/* Sidebar */}
            <div
              className="w-64 flex-shrink-0 border-r overflow-auto"
              style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
            >
              {/* Document Tabs */}
              {documents.length > 1 && (
                <div className="px-4 py-2 border-b flex gap-1 overflow-x-auto" style={{ borderColor: "var(--border-color)" }}>
                  {documents.map((doc, i) => (
                    <button
                      key={doc.id}
                      onClick={() => { setSelectedDocIndex(i); setCurrentPage(1); setEditingFieldId(null); }}
                      className="text-[10px] px-2 py-1 rounded whitespace-nowrap"
                      style={{
                        background: selectedDocIndex === i ? "var(--gold)" : "transparent",
                        color: selectedDocIndex === i ? "#0a0b0e" : "var(--text-muted)",
                      }}
                    >
                      {doc.file_name}
                    </button>
                  ))}
                </div>
              )}
              <FieldPalette
                recipients={pseudoRecipients}
                selectedRecipientId={selectedRecipientId}
                onSelectRecipient={setSelectedRecipientId}
                fields={fieldsAsSTSFields.map((f) => ({
                  id: f.id,
                  field_type: f.field_type,
                  recipient_id: f.recipient_id,
                  page_number: f.page_number,
                }))}
                onRemoveField={removeTemplateField}
              />
            </div>

            {/* Document Viewer + Fill Mode Popover */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 px-4 py-1 border-b" style={{ borderColor: "var(--border-color)" }}>
                <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>{"\u2212"}</button>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>+</button>

                {/* Fill Mode Popover (inline in toolbar when a field is selected) */}
                {editingField && (
                  <>
                    <div className="w-px h-4 mx-2" style={{ background: "var(--border-color)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fill mode:</span>
                    <button
                      onClick={() => handleFillModeChange(editingField.id, "sender")}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition-all"
                      style={{
                        background: editingField.fill_mode === "sender" ? "var(--gold)" : "transparent",
                        color: editingField.fill_mode === "sender" ? "#0a0b0e" : "var(--text-muted)",
                        border: editingField.fill_mode === "sender" ? "none" : "1px solid var(--border-color)",
                      }}
                    >
                      Sender
                    </button>
                    <button
                      onClick={() => handleFillModeChange(editingField.id, "recipient")}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition-all"
                      style={{
                        background: editingField.fill_mode === "recipient" ? "var(--gold)" : "transparent",
                        color: editingField.fill_mode === "recipient" ? "#0a0b0e" : "var(--text-muted)",
                        border: editingField.fill_mode === "recipient" ? "none" : "1px solid var(--border-color)",
                      }}
                    >
                      Recipient
                    </button>
                    {editingField.fill_mode === "sender" && (
                      <>
                        <div className="w-px h-4 mx-1" style={{ background: "var(--border-color)" }} />
                        <input
                          type="text"
                          defaultValue={editingField.label}
                          key={editingField.id}
                          onBlur={(e) => handleLabelChange(editingField.id, e.target.value)}
                          placeholder="Label for sender..."
                          className="text-[10px] px-2 py-0.5 rounded border outline-none w-40"
                          style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                        />
                      </>
                    )}
                    <button
                      onClick={() => setEditingFieldId(null)}
                      className="text-[10px] px-1 hover:opacity-80"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {"\u2715"}
                    </button>
                  </>
                )}
              </div>
              {currentDocUrl ? (
                <DocumentViewer
                  fileUrl={currentDocUrl}
                  fields={fieldsAsSTSFields}
                  recipients={pseudoRecipients}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onPageCountLoad={handlePageCountLoad}
                  onDropField={handleDropField}
                  onFieldMove={handleFieldMove}
                  onFieldResize={handleFieldResize}
                  onFieldClick={handleFieldClick}
                  onDeleteField={removeTemplateField}
                  highlightRecipientId={selectedRecipientId}
                  zoom={zoom}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No document to display</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {step !== 2 && (
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
        >
          <button
            onClick={() => { if (step > 0) setStep(step - 1); else handleCancel(); }}
            className="text-xs px-4 py-2 rounded-md border transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={() => { saveMetadata(); setStep(step + 1); }}
            disabled={!canProceed()}
            className="text-xs px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: canProceed() ? 1 : 0.5,
            }}
          >
            Next Step
          </button>
        </div>
      )}

      {/* Step 2 bottom nav */}
      {step === 2 && (
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
        >
          <button
            onClick={() => { setEditingFieldId(null); setStep(1); }}
            className="text-xs px-4 py-2 rounded-md border transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {templateFields.length} field{templateFields.length !== 1 ? "s" : ""} placed
            </span>
            <button
              onClick={handleSaveTemplate}
              className="text-xs px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
              style={{
                background: "var(--gold)",
                color: "#0a0b0e",
              }}
            >
              Save Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
