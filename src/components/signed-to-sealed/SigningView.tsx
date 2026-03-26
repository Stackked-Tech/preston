"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useDocumentUpload, useAuditLog } from "@/lib/signedToSealedHooks";
import type { STSEnvelopeDetail, STSRecipient, STSField, SignatureMethod } from "@/types/signedtosealed";
import { FIELD_TYPE_LABELS } from "@/types/signedtosealed";
import DocumentViewer from "./DocumentViewer";
import SignatureModal from "./SignatureModal";

interface SigningViewProps {
  envelope: STSEnvelopeDetail;
  recipient: STSRecipient;
  isPublic?: boolean;
  onComplete?: () => void;
}

export default function SigningView({ envelope, recipient, isPublic, onComplete }: SigningViewProps) {
  const { getPublicUrl } = useDocumentUpload();
  const { logEvent } = useAuditLog(envelope.id);

  const [currentPage, setCurrentPage] = useState(1);
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of envelope.fields) {
      if (f.field_value) initial[f.id] = f.field_value;
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Submit modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitModalDismissed, setSubmitModalDismissed] = useState(false);

  // ID upload state
  const requireIdUpload = envelope.require_id_upload ?? false;
  const [idFile1, setIdFile1] = useState<File | null>(null);
  const [idFile2, setIdFile2] = useState<File | null>(null);
  const [idUploaded1, setIdUploaded1] = useState(false);
  const [idUploaded2, setIdUploaded2] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const idInput1Ref = useRef<HTMLInputElement>(null);
  const idInput2Ref = useRef<HTMLInputElement>(null);

  const ACCEPTED_ID_TYPES = ".jpg,.jpeg,.png,.heic,.pdf";

  const handleIdFileSelect = async (file: File, docNumber: 1 | 2) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["jpg", "jpeg", "png", "heic", "pdf"].includes(ext)) {
      alert("Please upload an image (JPG, PNG, HEIC) or PDF file.");
      return;
    }
    if (docNumber === 1) setIdFile1(file);
    else setIdFile2(file);

    setIdUploading(true);
    try {
      const filePath = `${envelope.id}/${recipient.id}/id-${docNumber}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("sts-id-uploads")
        .upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Save record to sts_id_uploads table
      await supabase.from("sts_id_uploads").upsert(
        {
          envelope_id: envelope.id,
          recipient_id: recipient.id,
          document_number: docNumber,
          file_path: filePath,
          file_name: file.name,
        },
        { onConflict: "envelope_id,recipient_id,document_number" }
      );

      if (docNumber === 1) setIdUploaded1(true);
      else setIdUploaded2(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload ID document");
      if (docNumber === 1) { setIdFile1(null); setIdUploaded1(false); }
      else { setIdFile2(null); setIdUploaded2(false); }
    } finally {
      setIdUploading(false);
    }
  };

  const idUploadsComplete = !requireIdUpload || (idUploaded1 && idUploaded2);

  // Fields for this recipient
  const myFields = useMemo(
    () => envelope.fields.filter((f) => f.recipient_id === recipient.id),
    [envelope.fields, recipient.id]
  );

  const requiredFields = myFields.filter((f) => f.is_required);
  const filledRequired = requiredFields.filter((f) => fieldValues[f.id]);
  const progress = requiredFields.length > 0 ? (filledRequired.length / requiredFields.length) * 100 : 100;

  const currentDoc = envelope.documents[currentDocIndex];
  const currentDocUrl = currentDoc ? getPublicUrl(currentDoc.file_path) : null;

  // Auto-show submit modal when all required fields are complete
  const prevProgressRef = useRef(progress);
  useEffect(() => {
    if (progress === 100 && prevProgressRef.current < 100 && !submitModalDismissed && !completed) {
      setShowSubmitModal(true);
    }
    prevProgressRef.current = progress;
  }, [progress, submitModalDismissed, completed]);

  // Navigate to next empty required field
  const goToNextField = useCallback(() => {
    const next = myFields.find((f) => f.is_required && !fieldValues[f.id]);
    if (next) {
      const docIdx = envelope.documents.findIndex((d) => d.id === next.document_id);
      if (docIdx >= 0) setCurrentDocIndex(docIdx);
      setCurrentPage(next.page_number);
    }
  }, [myFields, fieldValues, envelope.documents]);

  // Handle field click during signing
  const handleFieldClick = (field: STSField) => {
    if (field.recipient_id !== recipient.id) return;

    if (field.field_type === "signature" || field.field_type === "initials") {
      setActiveFieldId(field.id);
      setShowSignatureModal(true);
    } else if (field.field_type === "date_signed") {
      const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      setFieldValues((prev) => ({ ...prev, [field.id]: now }));
    } else if (field.field_type === "checkbox") {
      setFieldValues((prev) => ({
        ...prev,
        [field.id]: prev[field.id] === "true" ? "false" : "true",
      }));
    } else if (field.field_type === "text") {
      const val = prompt("Enter text:", fieldValues[field.id] || "");
      if (val !== null) {
        setFieldValues((prev) => ({ ...prev, [field.id]: val }));
      }
    } else if (field.field_type === "dropdown") {
      const options = field.dropdown_options || [];
      if (options.length > 0) {
        const val = prompt(`Select one:\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`, fieldValues[field.id] || "");
        if (val !== null) {
          setFieldValues((prev) => ({ ...prev, [field.id]: val }));
        }
      }
    }
  };

  // Signature save
  const handleSignatureSave = (dataUrl: string, method: SignatureMethod, fontFamily?: string) => {
    if (!activeFieldId) return;
    setFieldValues((prev) => ({ ...prev, [activeFieldId]: dataUrl }));
    setActiveFieldId(null);
  };

  // Submit signing
  const handleSubmit = async () => {
    const unfilled = requiredFields.filter((f) => !fieldValues[f.id]);
    if (unfilled.length > 0) {
      alert(`Please complete all required fields. ${unfilled.length} remaining.`);
      return;
    }
    if (!confirm("Are you sure you want to submit your signature? This action is final.")) return;

    setSubmitting(true);
    try {
      // Save all field values
      for (const [fieldId, value] of Object.entries(fieldValues)) {
        await supabase.from("sts_fields").update({ field_value: value }).eq("id", fieldId);
      }

      // Update recipient status
      await supabase
        .from("sts_recipients")
        .update({ status: "signed", signed_at: new Date().toISOString() })
        .eq("id", recipient.id);

      // Log audit event
      await logEvent({
        envelope_id: envelope.id,
        event_type: "recipient_signed",
        actor_name: recipient.name,
        actor_email: recipient.email,
        recipient_id: recipient.id,
        metadata: { field_count: Object.keys(fieldValues).length },
      });

      // Check if all signers have signed
      const { data: allRecipients } = await supabase
        .from("sts_recipients")
        .select("*")
        .eq("envelope_id", envelope.id);

      const signers = (allRecipients || []).filter((r: STSRecipient) => r.role === "signer");
      const allSigned = signers.every((r: STSRecipient) => r.id === recipient.id || r.status === "signed");

      if (allSigned) {
        await supabase
          .from("sts_envelopes")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", envelope.id);

        await logEvent({
          envelope_id: envelope.id,
          event_type: "envelope_completed",
          actor_name: "System",
          actor_email: "",
          recipient_id: null,
          metadata: {},
        });
      } else {
        // Update to in_progress if not already
        await supabase
          .from("sts_envelopes")
          .update({ status: "in_progress" })
          .eq("id", envelope.id);
      }

      setCompleted(true);
      onComplete?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  // Completion screen
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center p-8 rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
          <span className="text-5xl block mb-4">✅</span>
          <h2 className="text-xl font-medium mb-2" style={{ color: "var(--text-primary)" }}>Signing Complete</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Thank you, {recipient.name}. Your signature has been recorded.
          </p>
          {!isPublic && (
            <button
              onClick={onComplete}
              className="mt-4 text-sm px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
              style={{ background: "var(--gold)", color: "#0a0b0e" }}
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // Enrich fields with values for display
  const enrichedFields = envelope.fields.map((f) => ({
    ...f,
    field_value: fieldValues[f.id] || f.field_value,
  }));

  const activeField = activeFieldId ? myFields.find((f) => f.id === activeFieldId) : null;

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
      >
        <div>
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>{envelope.title}</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Signing as <strong>{recipient.name}</strong> ({recipient.email})
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {filledRequired.length} of {requiredFields.length} fields complete
            </p>
            <div className="w-40 h-1.5 rounded-full mt-1" style={{ background: "var(--border-color)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: progress === 100 ? "#10b981" : "var(--gold)" }}
              />
            </div>
          </div>
          <button
            onClick={goToNextField}
            className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Next Field
          </button>
        </div>
      </header>

      {/* Document Tabs */}
      {envelope.documents.length > 1 && (
        <div className="flex gap-1 px-6 py-2 border-b overflow-x-auto" style={{ borderColor: "var(--border-color)" }}>
          {envelope.documents.map((doc, i) => (
            <button
              key={doc.id}
              onClick={() => { setCurrentDocIndex(i); setCurrentPage(1); }}
              className="text-xs px-3 py-1 rounded whitespace-nowrap"
              style={{
                background: currentDocIndex === i ? "var(--gold)" : "transparent",
                color: currentDocIndex === i ? "#0a0b0e" : "var(--text-muted)",
              }}
            >
              {doc.file_name}
            </button>
          ))}
        </div>
      )}

      {/* Document */}
      <div className="flex-1 overflow-hidden">
        {currentDocUrl ? (
          <DocumentViewer
            fileUrl={currentDocUrl}
            fields={enrichedFields.filter((f) => f.document_id === currentDoc?.id)}
            recipients={envelope.recipients}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onFieldClick={handleFieldClick}
            readOnly={true}
            highlightRecipientId={recipient.id}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No document</p>
          </div>
        )}
      </div>

      {/* Submit Bar */}
      <div
        className="flex items-center justify-between px-6 py-4 border-t"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)" }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            By signing, you agree to conduct business electronically.
          </p>
          {progress < 100 && (
            <p className="text-[10px] mt-1" style={{ color: "#f59e0b" }}>
              {requiredFields.length - filledRequired.length} required field{requiredFields.length - filledRequired.length !== 1 ? "s" : ""} remaining — click each field on the document to fill it
            </p>
          )}
        </div>
        {progress === 100 ? (
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-8 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex-shrink-0"
            style={{
              background: "#10b981",
              color: "#fff",
              boxShadow: "0 0 20px #10b98140",
            }}
          >
            Ready to Submit
          </button>
        ) : (
          <button
            disabled
            className="px-8 py-3 rounded-lg text-sm font-semibold flex-shrink-0"
            style={{
              background: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            Complete All Fields to Sign
          </button>
        )}
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-md mx-4 rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
          >
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 text-center">
              <span className="text-4xl block mb-3">
                {requireIdUpload ? "📋" : "✅"}
              </span>
              <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {requireIdUpload && !idUploadsComplete
                  ? "You're almost done!"
                  : "You're all done!"}
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {requireIdUpload && !idUploadsComplete
                  ? "Please upload 2 forms of valid ID to complete your signing."
                  : "All fields have been completed. Click submit to finalize your signature."}
              </p>
            </div>

            {/* ID Uploads (only if required) */}
            {requireIdUpload && (
              <div className="px-6 pb-4 space-y-3">
                {/* ID Document 1 */}
                <input
                  ref={idInput1Ref}
                  type="file"
                  accept={ACCEPTED_ID_TYPES}
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleIdFileSelect(e.target.files[0], 1); }}
                />
                <button
                  onClick={() => idInput1Ref.current?.click()}
                  disabled={idUploading}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:opacity-80"
                  style={{
                    borderColor: idUploaded1 ? "#10b981" : "var(--border-color)",
                    background: idUploaded1 ? "#10b98110" : "var(--bg-primary)",
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    ID Document 1 (e.g., Driver&apos;s License, Passport)
                  </p>
                  {idFile1 ? (
                    <p className="text-xs mt-1" style={{ color: idUploaded1 ? "#10b981" : "var(--gold)" }}>
                      {idUploaded1 ? "✓ Uploaded:" : "⏳ Uploading:"} {idFile1.name}
                    </p>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Click to select file (JPG, PNG, HEIC, or PDF)
                    </p>
                  )}
                </button>

                {/* ID Document 2 */}
                <input
                  ref={idInput2Ref}
                  type="file"
                  accept={ACCEPTED_ID_TYPES}
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleIdFileSelect(e.target.files[0], 2); }}
                />
                <button
                  onClick={() => idInput2Ref.current?.click()}
                  disabled={idUploading}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:opacity-80"
                  style={{
                    borderColor: idUploaded2 ? "#10b981" : "var(--border-color)",
                    background: idUploaded2 ? "#10b98110" : "var(--bg-primary)",
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    ID Document 2 (e.g., Social Security Card, Passport)
                  </p>
                  {idFile2 ? (
                    <p className="text-xs mt-1" style={{ color: idUploaded2 ? "#10b981" : "var(--gold)" }}>
                      {idUploaded2 ? "✓ Uploaded:" : "⏳ Uploading:"} {idFile2.name}
                    </p>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Click to select file (JPG, PNG, HEIC, or PDF)
                    </p>
                  )}
                </button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowSubmitModal(false); setSubmitModalDismissed(true); }}
                className="flex-1 px-4 py-3 rounded-lg text-sm border transition-all hover:opacity-80"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                Go Back
              </button>
              <button
                onClick={() => { setShowSubmitModal(false); handleSubmit(); }}
                disabled={submitting || !idUploadsComplete}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  background: idUploadsComplete ? "#10b981" : "var(--border-color)",
                  color: idUploadsComplete ? "#fff" : "var(--text-muted)",
                  opacity: submitting ? 0.5 : 1,
                  boxShadow: idUploadsComplete ? "0 0 20px #10b98140" : "none",
                }}
              >
                {submitting ? "Submitting..." : "Submit Signature"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => { setShowSignatureModal(false); setActiveFieldId(null); }}
        onSave={handleSignatureSave}
        type={activeField?.field_type === "initials" ? "initials" : "signature"}
        signerName={recipient.name}
      />
    </div>
  );
}
