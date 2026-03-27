"use client";

import { useState } from "react";
import { useEnvelopeDetail, useAuditLog, useEnvelopes, useDocumentUpload, useRecipients, sanitizeEmail } from "@/lib/signedToSealedHooks";
import type { STSRecipient, EnvelopeStatus } from "@/types/signedtosealed";
import { STATUS_LABELS, FIELD_TYPE_LABELS } from "@/types/signedtosealed";
import { generateSigningEmail } from "@/lib/signingEmailTemplate";
import AuditTrail from "./AuditTrail";
import DocumentViewer from "./DocumentViewer";

interface EnvelopeDetailProps {
  envelopeId: string;
  onBack: () => void;
  onEdit: () => void;
}

const STATUS_COLORS: Record<EnvelopeStatus, string> = {
  draft: "#6b7280",
  sent: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#10b981",
  voided: "#ef4444",
};

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "#6b7280",
  viewed: "#3b82f6",
  signed: "#10b981",
  declined: "#ef4444",
};

export default function EnvelopeDetail({ envelopeId, onBack, onEdit }: EnvelopeDetailProps) {
  const { detail, loading, refetch } = useEnvelopeDetail(envelopeId);
  const { logEvent } = useAuditLog(envelopeId);
  const { updateEnvelope, sendEnvelope, voidEnvelope } = useEnvelopes();
  const { updateRecipient } = useRecipients(envelopeId);
  const { getPublicUrl } = useDocumentUpload();
  const [showAudit, setShowAudit] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [viewDocIndex, setViewDocIndex] = useState(0);
  const [viewPage, setViewPage] = useState(1);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailPreviewRecipient, setEmailPreviewRecipient] = useState<string | null>(null);
  const [sendingEmailTo, setSendingEmailTo] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");

  const handleSend = async () => {
    if (!detail) return;
    if (detail.recipients.length === 0) {
      alert("Add at least one recipient before sending.");
      return;
    }
    if (!confirm("Send this envelope to all recipients?")) return;
    setActionLoading(true);
    try {
      await sendEnvelope(detail.id);
      await logEvent({
        envelope_id: detail.id,
        event_type: "envelope_sent",
        actor_name: detail.created_by || "Admin",
        actor_email: "",
        recipient_id: null,
        metadata: { recipient_count: detail.recipients.length },
      });
      refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!detail || !voidReason.trim()) return;
    setActionLoading(true);
    try {
      await voidEnvelope(detail.id, voidReason);
      await logEvent({
        envelope_id: detail.id,
        event_type: "envelope_voided",
        actor_name: detail.created_by || "Admin",
        actor_email: "",
        recipient_id: null,
        metadata: { reason: voidReason },
      });
      setShowVoidModal(false);
      setVoidReason("");
      refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await updateEnvelope(detail.id, {
        status: "completed" as EnvelopeStatus,
        completed_at: new Date().toISOString(),
      });
      await logEvent({
        envelope_id: detail.id,
        event_type: "envelope_completed",
        actor_name: "System",
        actor_email: "",
        recipient_id: null,
        metadata: {},
      });
      refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const getSigningLink = (r: STSRecipient) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/signed-to-sealed/sign?token=${r.access_token}`;
  };

  const copyLink = async (r: STSRecipient) => {
    await navigator.clipboard.writeText(getSigningLink(r));
    alert(`Signing link copied for ${r.name}`);
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const startEditEmail = (r: STSRecipient) => {
    setEditingEmailId(r.id);
    setEditEmailValue(r.email || "");
  };

  const saveEmail = async (r: STSRecipient) => {
    const trimmed = sanitizeEmail(editEmailValue);
    if (!trimmed || !isValidEmail(trimmed)) {
      alert("Please enter a valid email address.");
      return;
    }
    try {
      await updateRecipient(r.id, { email: trimmed });
      refetch();
      setEditingEmailId(null);
    } catch {
      alert("Failed to update email");
    }
  };

  const previewEmail = (r: STSRecipient) => {
    if (!detail) return;
    const recipientFields = detail.fields.filter((f) => f.recipient_id === r.id);
    const html = generateSigningEmail({
      recipientName: r.name,
      senderName: detail.created_by || "WHB Companies",
      envelopeTitle: detail.title || "Untitled Envelope",
      envelopeMessage: detail.message || "",
      signingLink: getSigningLink(r),
      documentCount: detail.documents.length,
      fieldCount: recipientFields.length,
    });
    setEmailPreviewHtml(html);
    setEmailPreviewRecipient(r.name);
  };

  const copyEmailHtml = async () => {
    if (!emailPreviewHtml) return;
    await navigator.clipboard.writeText(emailPreviewHtml);
    alert("Email HTML copied to clipboard");
  };

  const sendEmail = async (r: STSRecipient) => {
    if (!detail) return;
    if (!r.email || !isValidEmail(r.email)) {
      alert(`No valid email address for ${r.name}. Click the email below their name to add or fix it.`);
      return;
    }
    const recipientFields = detail.fields.filter((f) => f.recipient_id === r.id);
    setSendingEmailTo(r.id);
    try {
      const res = await fetch("/api/signed-to-sealed/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: r.name,
          recipientEmail: r.email,
          senderName: detail.created_by || "WHB Companies",
          envelopeTitle: detail.title || "Untitled Envelope",
          envelopeMessage: detail.message || "",
          signingLink: getSigningLink(r),
          documentCount: detail.documents.length,
          fieldCount: recipientFields.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Failed to send: ${data.error}`);
      } else {
        alert(`Email sent to ${r.email}`);
      }
    } catch {
      alert("Failed to send email");
    } finally {
      setSendingEmailTo(null);
    }
  };

  const sendAllEmails = async () => {
    if (!detail) return;
    const signers = detail.recipients.filter(
      (r) => r.role === "signer" && r.status !== "signed" && r.email && isValidEmail(r.email)
    );
    if (signers.length === 0) {
      alert("No eligible recipients with valid emails to send to.");
      return;
    }
    if (!confirm(`Send signing invitation emails to ${signers.length} recipient${signers.length > 1 ? "s" : ""}?`)) return;
    setSendingAll(true);
    const results: { name: string; success: boolean }[] = [];
    for (const r of signers) {
      const recipientFields = detail.fields.filter((f) => f.recipient_id === r.id);
      setSendingEmailTo(r.id);
      try {
        const res = await fetch("/api/signed-to-sealed/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientName: r.name,
            recipientEmail: r.email,
            senderName: detail.created_by || "WHB Companies",
            envelopeTitle: detail.title || "Untitled Envelope",
            envelopeMessage: detail.message || "",
            signingLink: getSigningLink(r),
            documentCount: detail.documents.length,
            fieldCount: recipientFields.length,
          }),
        });
        results.push({ name: r.name, success: res.ok });
      } catch {
        results.push({ name: r.name, success: false });
      }
    }
    setSendingEmailTo(null);
    setSendingAll(false);
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);
    if (failed.length === 0) {
      alert(`All ${sent} email${sent > 1 ? "s" : ""} sent successfully.`);
    } else {
      alert(`${sent} sent, ${failed.length} failed: ${failed.map((f) => f.name).join(", ")}`);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading envelope...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "#ef4444" }}>Envelope not found</p>
      </div>
    );
  }

  if (showAudit) {
    return (
      <div className="px-6 sm:px-10 py-8">
        <button
          onClick={() => setShowAudit(false)}
          className="text-sm mb-4 px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
        >
          &larr; Back to Envelope
        </button>
        <AuditTrail envelopeId={envelopeId} envelope={detail} />
      </div>
    );
  }

  if (showDocument && detail.documents.length > 0) {
    const viewDoc = detail.documents[viewDocIndex];
    return (
      <div className="flex flex-col h-[calc(100vh-73px)]">
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowDocument(false); setViewDocIndex(0); setViewPage(1); }}
              className="text-sm px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
              style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
            >
              &larr; Back
            </button>
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {detail.title} — Signed Document
            </h3>
          </div>
          {detail.documents.length > 1 && (
            <div className="flex gap-1">
              {detail.documents.map((doc, i) => (
                <button
                  key={doc.id}
                  onClick={() => { setViewDocIndex(i); setViewPage(1); }}
                  className="text-xs px-3 py-1 rounded"
                  style={{
                    background: viewDocIndex === i ? "var(--gold)" : "transparent",
                    color: viewDocIndex === i ? "#0a0b0e" : "var(--text-muted)",
                  }}
                >
                  {doc.file_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <DocumentViewer
            fileUrl={getPublicUrl(viewDoc.file_path)}
            fields={detail.fields.filter((f) => f.document_id === viewDoc.id)}
            recipients={detail.recipients}
            currentPage={viewPage}
            onPageChange={setViewPage}
            readOnly={true}
            highlightRecipientId={null}
          />
        </div>
      </div>
    );
  }

  const allSigned = detail.recipients.filter((r) => r.role === "signer").every((r) => r.status === "signed");
  const canComplete = (detail.status === "sent" || detail.status === "in_progress") && allSigned;

  return (
    <div className="px-6 sm:px-10 py-8">
      {/* Title & Status */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
              {detail.title || "Untitled Envelope"}
            </h2>
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium tracking-wide uppercase"
              style={{
                background: STATUS_COLORS[detail.status] + "20",
                color: STATUS_COLORS[detail.status],
              }}
            >
              {STATUS_LABELS[detail.status]}
            </span>
          </div>
          {detail.message && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{detail.message}</p>
          )}
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Created {formatDate(detail.created_at)}
            {detail.sent_at && ` · Sent ${formatDate(detail.sent_at)}`}
            {detail.completed_at && ` · Completed ${formatDate(detail.completed_at)}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {detail.documents.length > 0 && (
            <button
              onClick={() => setShowDocument(true)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
              style={{ background: "var(--gold)", color: "#0a0b0e" }}
            >
              View Document
            </button>
          )}
          <button
            onClick={() => setShowAudit(true)}
            className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Audit Trail
          </button>
          {detail.status === "draft" && (
            <>
              <button
                onClick={onEdit}
                className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                Edit
              </button>
              <button
                onClick={handleSend}
                disabled={actionLoading}
                className="text-xs px-4 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
                style={{ background: "var(--gold)", color: "#0a0b0e" }}
              >
                {actionLoading ? "Sending..." : "Send"}
              </button>
            </>
          )}
          {canComplete && (
            <button
              onClick={handleMarkComplete}
              disabled={actionLoading}
              className="text-xs px-4 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
              style={{ background: "#10b981", color: "#fff" }}
            >
              {actionLoading ? "..." : "Mark Complete"}
            </button>
          )}
          {(detail.status === "sent" || detail.status === "in_progress") && (
            <button
              onClick={() => setShowVoidModal(true)}
              className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              Void
            </button>
          )}
        </div>
      </div>

      {/* Signing Links — prominent section when envelope is sent/in_progress */}
      {(detail.status === "sent" || detail.status === "in_progress") && detail.recipients.filter((r) => r.role === "signer").length > 0 && (
        <section
          className="mb-8 p-5 rounded-lg border"
          style={{ background: "var(--card-bg)", borderColor: "var(--gold)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔗</span>
              <h3 className="text-sm font-medium" style={{ color: "var(--gold)" }}>Signing Links</h3>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Share these links with recipients to sign
              </span>
            </div>
            {detail.recipients.filter((r) => r.role === "signer" && r.status !== "signed").length > 1 && (
              <button
                onClick={sendAllEmails}
                disabled={sendingAll}
                className="text-xs px-4 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
                style={{ background: "#10b981", color: "#fff", opacity: sendingAll ? 0.5 : 1 }}
              >
                {sendingAll ? "Sending All..." : "Send All Emails"}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {detail.recipients.filter((r) => r.role === "signer").map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-light)" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: r.color_hex }}
                >
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                  {editingEmailId === r.id ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="email"
                        value={editEmailValue}
                        onChange={(e) => setEditEmailValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEmail(r); if (e.key === "Escape") setEditingEmailId(null); }}
                        autoFocus
                        className="text-xs px-2 py-0.5 rounded border outline-none"
                        style={{ background: "var(--input-bg)", borderColor: "var(--gold)", color: "var(--text-primary)", width: "220px" }}
                        placeholder="recipient@example.com"
                      />
                      <button onClick={() => saveEmail(r)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "#10b981" }}>Save</button>
                      <button onClick={() => setEditingEmailId(null)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-[10px] truncate cursor-pointer hover:underline"
                      style={{ color: r.email && isValidEmail(r.email) ? "var(--text-muted)" : "#ef4444", background: "none", border: "none", padding: 0 }}
                      onClick={() => startEditEmail(r)}
                      title="Click to edit email"
                    >
                      <span>{r.email || "No email — click to add"}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                  )}
                  <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                    {getSigningLink(r)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.status === "signed" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase" style={{ background: "#10b98120", color: "#10b981" }}>
                      Signed
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => previewEmail(r)}
                        className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                      >
                        Preview Email
                      </button>
                      <button
                        onClick={() => sendEmail(r)}
                        disabled={sendingEmailTo === r.id}
                        className="text-xs px-3 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
                        style={{ background: "#10b981", color: "#fff", opacity: sendingEmailTo === r.id ? 0.5 : 1 }}
                      >
                        {sendingEmailTo === r.id ? "Sending..." : "Send Email"}
                      </button>
                      <button
                        onClick={() => copyLink(r)}
                        className="text-xs px-3 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
                        style={{ background: "var(--gold)", color: "#0a0b0e" }}
                      >
                        Copy Link
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Documents */}
      <section className="mb-8">
        <h3 className="text-xs tracking-[2px] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Documents ({detail.documents.length})
        </h3>
        {detail.documents.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No documents uploaded</p>
        ) : (
          <div className="space-y-2">
            {detail.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
              >
                <span className="text-lg">📄</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{doc.file_name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {doc.page_count} page{doc.page_count !== 1 ? "s" : ""} · {(doc.file_size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <a
                  href={getPublicUrl(doc.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "var(--gold)" }}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recipients */}
      <section className="mb-8">
        <h3 className="text-xs tracking-[2px] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Recipients ({detail.recipients.length})
        </h3>
        {detail.recipients.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No recipients added</p>
        ) : (
          <div className="space-y-2">
            {detail.recipients.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: r.color_hex }}
                >
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {r.name}
                    <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                      ({r.role}) · Order #{r.signing_order}
                    </span>
                  </p>
                  {editingEmailId === r.id ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="email"
                        value={editEmailValue}
                        onChange={(e) => setEditEmailValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEmail(r); if (e.key === "Escape") setEditingEmailId(null); }}
                        autoFocus
                        className="text-xs px-2 py-0.5 rounded border outline-none"
                        style={{ background: "var(--input-bg)", borderColor: "var(--gold)", color: "var(--text-primary)", width: "220px" }}
                        placeholder="recipient@example.com"
                      />
                      <button onClick={() => saveEmail(r)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "#10b981" }}>Save</button>
                      <button onClick={() => setEditingEmailId(null)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>Cancel</button>
                    </div>
                  ) : (
                    <p
                      className="text-xs truncate cursor-pointer hover:underline"
                      style={{ color: r.email && isValidEmail(r.email) ? "var(--text-muted)" : "#ef4444" }}
                      onClick={() => startEditEmail(r)}
                      title="Click to edit email"
                    >
                      {r.email || "No email — click to add"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase"
                    style={{
                      background: RECIPIENT_STATUS_COLORS[r.status] + "20",
                      color: RECIPIENT_STATUS_COLORS[r.status],
                    }}
                  >
                    {r.status}
                  </span>
                  {(detail.status === "sent" || detail.status === "in_progress") && r.role === "signer" && r.status !== "signed" && (
                    <button
                      onClick={() => copyLink(r)}
                      className="text-xs px-2 py-1 rounded hover:opacity-80"
                      style={{ color: "var(--gold)" }}
                    >
                      Copy Link
                    </button>
                  )}
                  {r.signed_at && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Signed {formatDate(r.signed_at)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fields Summary */}
      <section className="mb-8">
        <h3 className="text-xs tracking-[2px] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Fields ({detail.fields.length})
        </h3>
        {detail.fields.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No fields placed</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {detail.fields.map((f) => {
              const r = detail.recipients.find((rec) => rec.id === f.recipient_id);
              return (
                <div
                  key={f.id}
                  className="p-3 rounded-lg border"
                  style={{ background: "var(--card-bg)", borderColor: r?.color_hex || "var(--border-light)" }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {FIELD_TYPE_LABELS[f.field_type]}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Page {f.page_number} · {r?.name || "Unknown"}
                  </p>
                  {f.field_value && (
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--gold)" }}>
                      {f.field_type === "checkbox" ? (f.field_value === "true" ? "Checked" : "Unchecked") : f.field_value}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Void Reason */}
      {detail.status === "voided" && detail.void_reason && (
        <section className="mb-8 p-4 rounded-lg border" style={{ borderColor: "#ef4444", background: "#ef444410" }}>
          <p className="text-xs tracking-[1px] uppercase mb-1" style={{ color: "#ef4444" }}>Void Reason</p>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>{detail.void_reason}</p>
        </section>
      )}

      {/* Email Preview Modal */}
      {emailPreviewHtml && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-xl border w-full max-w-2xl max-h-[90vh] flex flex-col"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Email Preview — {emailPreviewRecipient}
                </h3>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  This is what the recipient will receive
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyEmailHtml}
                  className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                >
                  Copy HTML
                </button>
                <button
                  onClick={() => { setEmailPreviewHtml(null); setEmailPreviewRecipient(null); }}
                  className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-light)" }}>
                <iframe
                  srcDoc={emailPreviewHtml}
                  title="Email Preview"
                  className="w-full border-0"
                  style={{ height: "600px", background: "#0f1012" }}
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="rounded-xl border p-6 w-full max-w-md"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>Void Envelope</h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              This will cancel the envelope and notify all recipients. This action cannot be undone.
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowVoidModal(false); setVoidReason(""); }}
                className="text-xs px-3 py-1.5 rounded-md border"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim() || actionLoading}
                className="text-xs px-4 py-1.5 rounded-md font-medium transition-all"
                style={{ background: "#ef4444", color: "#fff", opacity: !voidReason.trim() ? 0.5 : 1 }}
              >
                {actionLoading ? "Voiding..." : "Void Envelope"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
