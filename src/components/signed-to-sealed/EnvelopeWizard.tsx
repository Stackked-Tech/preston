"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useEnvelopes,
  useEnvelopeDetail,
  useDocumentUpload,
  useRecipients,
  useFields,
  useAuditLog,
} from "@/lib/signedToSealedHooks";
import type { STSDocument, FieldType, RecipientRole } from "@/types/signedtosealed";
import { RECIPIENT_COLORS } from "@/types/signedtosealed";
import RecipientManager from "./RecipientManager";
import DocumentViewer from "./DocumentViewer";
import FieldPalette from "./FieldPalette";

interface EnvelopeWizardProps {
  envelopeId: string | null;
  onComplete: (sentEnvelopeId?: string) => void;
  onCancel: () => void;
}

const STEPS = ["Upload Documents", "Add Recipients", "Place Fields", "Review & Send"];

export default function EnvelopeWizard({ envelopeId, onComplete, onCancel }: EnvelopeWizardProps) {
  const { createEnvelope, updateEnvelope, sendEnvelope } = useEnvelopes();
  const { uploadDocument, updatePageCount, deleteDocument, getPublicUrl } = useDocumentUpload();
  const { logEvent } = useAuditLog(envelopeId);

  const [activeEnvelopeId, setActiveEnvelopeId] = useState<string | null>(envelopeId);
  const { detail, refetch: refetchDetail } = useEnvelopeDetail(activeEnvelopeId);
  const { recipients, addRecipient, updateRecipient, removeRecipient, refetch: refetchRecipients } = useRecipients(activeEnvelopeId);
  const { fields, addField, updateField, removeField, refetch: refetchFields } = useFields(activeEnvelopeId);

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState<STSDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // Field placement state
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Sync from detail — only set title/message on first load, always sync documents
  const initialSynced = useRef(false);
  useEffect(() => {
    if (detail) {
      if (!initialSynced.current) {
        setTitle(detail.title);
        setMessage(detail.message);
        initialSynced.current = true;
      }
      setDocuments(detail.documents);
    }
  }, [detail]);

  // Auto-create envelope on mount if new
  useEffect(() => {
    if (!activeEnvelopeId) {
      createEnvelope({ title: "Untitled Envelope", message: "", status: "draft", created_by: "" })
        .then((env) => {
          setActiveEnvelopeId(env.id);
        })
        .catch(() => {
          // Table may not exist yet — user needs to run the SQL schema
        });
    }
  }, [activeEnvelopeId, createEnvelope]);

  // Auto-save title/message changes
  const saveMetadata = useCallback(async () => {
    if (!activeEnvelopeId) return;
    await updateEnvelope(activeEnvelopeId, { title: title || "Untitled Envelope", message });
  }, [activeEnvelopeId, title, message, updateEnvelope]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeEnvelopeId || !e.target.files) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        if (file.type !== "application/pdf") {
          alert(`${file.name} is not a PDF. Only PDF files are supported.`);
          continue;
        }
        const doc = await uploadDocument(activeEnvelopeId, file, documents.length);
        setDocuments((prev) => [...prev, doc]);
      }
      refetchDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveDoc = async (doc: STSDocument) => {
    if (!confirm(`Remove ${doc.file_name}?`)) return;
    await deleteDocument(doc.id, doc.file_path);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    refetchDetail();
  };

  // Add recipient handler
  const handleAddRecipient = async (name: string, email: string, role: RecipientRole, order: number, color: string) => {
    if (!activeEnvelopeId) return;
    await addRecipient({
      envelope_id: activeEnvelopeId,
      name,
      email,
      role,
      signing_order: order,
      status: "pending",
      color_hex: color,
    });
  };

  // Field drop handler
  const handleDropField = async (fieldType: FieldType, recipientId: string, page: number, xPct: number, yPct: number) => {
    if (!activeEnvelopeId || documents.length === 0) return;
    const doc = documents[selectedDocIndex];
    if (!doc) return;

    let width = 25;
    let height = 6;
    if (fieldType === "signature") { width = 30; height = 12; }
    else if (fieldType === "initials") { width = 15; height = 10; }
    else if (fieldType === "date_signed") { width = 25; height = 6; }
    else if (fieldType === "text") { width = 30; height = 6; }
    else if (fieldType === "checkbox") { width = 5; height = 5; }
    else if (fieldType === "dropdown") { width = 30; height = 6; }

    await addField({
      envelope_id: activeEnvelopeId,
      document_id: doc.id,
      recipient_id: recipientId,
      field_type: fieldType,
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
    await updateField(fieldId, { x_position: xPct, y_position: yPct });
  };

  // Field resize handler
  const handleFieldResize = async (fieldId: string, width: number, height: number) => {
    await updateField(fieldId, { width, height });
  };

  const handlePageCountLoad = (count: number) => {
    if (documents[selectedDocIndex]) {
      updatePageCount(documents[selectedDocIndex].id, count);
    }
  };

  // Send
  const handleSend = async () => {
    if (!activeEnvelopeId) return;
    if (recipients.filter((r) => r.role === "signer").length === 0) {
      alert("Add at least one signer before sending.");
      return;
    }
    if (fields.length === 0) {
      alert("Place at least one field before sending.");
      return;
    }
    setSending(true);
    try {
      await saveMetadata();
      await sendEnvelope(activeEnvelopeId);
      await logEvent({
        envelope_id: activeEnvelopeId,
        event_type: "envelope_sent",
        actor_name: "Admin",
        actor_email: "",
        recipient_id: null,
        metadata: { recipient_count: recipients.length, field_count: fields.length },
      });
      onComplete(activeEnvelopeId);
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    await saveMetadata();
    onComplete();
  };

  const canProceed = () => {
    if (step === 0) return documents.length > 0;
    if (step === 1) return recipients.filter((r) => r.role === "signer").length > 0;
    if (step === 2) return fields.length > 0;
    return true;
  };

  const currentDocUrl = documents[selectedDocIndex]
    ? getPublicUrl(documents[selectedDocIndex].file_path)
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
                {i < step ? "✓" : i + 1}
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
          onClick={handleSaveDraft}
          className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
        >
          Save Draft
        </button>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-hidden">
        {/* Step 0: Upload Documents */}
        {step === 0 && (
          <div className="px-6 sm:px-10 py-8 overflow-auto h-full">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>Envelope Details</h3>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Set a title and upload your documents</p>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Envelope title"
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Message to Recipients</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Optional message..."
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
                  <span className="text-lg">📄</span>
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
                <span className="text-2xl">📎</span>
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

        {/* Step 1: Add Recipients */}
        {step === 1 && (
          <div className="px-6 sm:px-10 py-8 overflow-auto h-full">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>Add Recipients</h3>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Add the people who need to sign or receive this envelope</p>
              <RecipientManager
                recipients={recipients}
                onAdd={handleAddRecipient}
                onUpdate={(id, updates) => updateRecipient(id, updates)}
                onRemove={removeRecipient}
              />
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
                      onClick={() => { setSelectedDocIndex(i); setCurrentPage(1); }}
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
                recipients={recipients}
                selectedRecipientId={selectedRecipientId}
                onSelectRecipient={setSelectedRecipientId}
                fields={fields.filter((f) => f.document_id === documents[selectedDocIndex]?.id)}
                onRemoveField={removeField}
              />
            </div>

            {/* Document Viewer */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 px-4 py-1 border-b" style={{ borderColor: "var(--border-color)" }}>
                <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>−</button>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>+</button>
              </div>
              {currentDocUrl ? (
                <DocumentViewer
                  fileUrl={currentDocUrl}
                  fields={fields.filter((f) => f.document_id === documents[selectedDocIndex]?.id)}
                  recipients={recipients}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onPageCountLoad={handlePageCountLoad}
                  onDropField={handleDropField}
                  onFieldMove={handleFieldMove}
                  onFieldResize={handleFieldResize}
                  onFieldClick={(f) => setSelectedRecipientId(f.recipient_id)}
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

        {/* Step 3: Review & Send */}
        {step === 3 && (
          <div className="px-6 sm:px-10 py-8 overflow-auto h-full">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>Review & Send</h3>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Confirm everything looks correct before sending</p>

              <div className="space-y-6">
                {/* Envelope Info */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}>
                  <p className="text-xs tracking-[1px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>Envelope</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{title || "Untitled"}</p>
                  {message && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{message}</p>}
                </div>

                {/* Documents */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}>
                  <p className="text-xs tracking-[1px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Documents ({documents.length})
                  </p>
                  {documents.map((doc) => (
                    <p key={doc.id} className="text-sm" style={{ color: "var(--text-primary)" }}>
                      📄 {doc.file_name}
                    </p>
                  ))}
                </div>

                {/* Recipients */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}>
                  <p className="text-xs tracking-[1px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Recipients ({recipients.length})
                  </p>
                  {recipients.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 rounded-full" style={{ background: r.color_hex }} />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {r.name} ({r.email}) — {r.role}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Fields */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}>
                  <p className="text-xs tracking-[1px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Fields ({fields.length})
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {fields.length} field{fields.length !== 1 ? "s" : ""} placed across {documents.length} document{documents.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending || recipients.length === 0 || fields.length === 0}
                  className="w-full py-3 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                  style={{
                    background: "var(--gold)",
                    color: "#0a0b0e",
                    opacity: sending || recipients.length === 0 || fields.length === 0 ? 0.5 : 1,
                  }}
                >
                  {sending ? "Sending..." : "Send Envelope"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation (not on step 2 - it uses sidebar) */}
      {step !== 2 && (
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
        >
          <button
            onClick={() => { if (step > 0) setStep(step - 1); else onCancel(); }}
            className="text-xs px-4 py-2 rounded-md border transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 3 && (
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
          )}
        </div>
      )}

      {/* Step 2 bottom nav (alongside sidebar layout) */}
      {step === 2 && (
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
        >
          <button
            onClick={() => setStep(1)}
            className="text-xs px-4 py-2 rounded-md border transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {fields.length} field{fields.length !== 1 ? "s" : ""} placed
            </span>
            <button
              onClick={() => { saveMetadata(); setStep(3); }}
              disabled={fields.length === 0}
              className="text-xs px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
              style={{
                background: "var(--gold)",
                color: "#0a0b0e",
                opacity: fields.length === 0 ? 0.5 : 1,
              }}
            >
              Next Step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
