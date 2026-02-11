"use client";

import { useAuditLog } from "@/lib/signedToSealedHooks";
import type { STSEnvelopeDetail } from "@/types/signedtosealed";

interface AuditTrailProps {
  envelopeId: string;
  envelope?: STSEnvelopeDetail;
}

const EVENT_ICONS: Record<string, string> = {
  envelope_created: "📝",
  envelope_sent: "📤",
  envelope_completed: "✅",
  envelope_voided: "🚫",
  recipient_viewed: "👀",
  recipient_signed: "✍️",
  recipient_declined: "❌",
  field_updated: "📋",
};

const EVENT_LABELS: Record<string, string> = {
  envelope_created: "Envelope Created",
  envelope_sent: "Envelope Sent",
  envelope_completed: "Envelope Completed",
  envelope_voided: "Envelope Voided",
  recipient_viewed: "Document Viewed",
  recipient_signed: "Document Signed",
  recipient_declined: "Signing Declined",
  field_updated: "Field Updated",
};

export default function AuditTrail({ envelopeId, envelope }: AuditTrailProps) {
  const { entries, loading } = useAuditLog(envelopeId);

  const formatDate = (d: string) => {
    return new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading audit trail...</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>Audit Trail</h3>
      <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
        Chronological record of all actions for this envelope
      </p>

      {/* Certificate of Completion */}
      {envelope?.status === "completed" && (
        <div
          className="p-6 rounded-lg border mb-8"
          style={{ background: "#10b98110", borderColor: "#10b981" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🏆</span>
            <div>
              <h4 className="text-sm font-medium" style={{ color: "#10b981" }}>Certificate of Completion</h4>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                All parties have signed this envelope
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p style={{ color: "var(--text-muted)" }}>Envelope</p>
              <p style={{ color: "var(--text-primary)" }}>{envelope.title}</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>Envelope ID</p>
              <p className="font-mono text-[10px]" style={{ color: "var(--text-primary)" }}>{envelope.id}</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>Completed</p>
              <p style={{ color: "var(--text-primary)" }}>
                {envelope.completed_at ? formatDate(envelope.completed_at) : "—"}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>Signers</p>
              <p style={{ color: "var(--text-primary)" }}>
                {envelope.recipients.filter((r) => r.role === "signer").map((r) => r.name).join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No audit events recorded yet</p>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div
            className="absolute left-4 top-0 bottom-0 w-px"
            style={{ background: "var(--border-color)" }}
          />

          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="flex gap-4 relative">
                {/* Dot */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 relative z-10"
                  style={{ background: "var(--bg-secondary)", border: "2px solid var(--border-color)" }}
                >
                  {EVENT_ICONS[entry.event_type] || "📌"}
                </div>

                {/* Content */}
                <div
                  className="flex-1 p-3 rounded-lg border"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {EVENT_LABELS[entry.event_type] || entry.event_type}
                    </p>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {entry.actor_name}
                    {entry.actor_email && ` (${entry.actor_email})`}
                  </p>
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <div className="mt-2 text-[10px] font-mono p-2 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>
                      {Object.entries(entry.metadata).map(([k, v]) => (
                        <span key={k} className="mr-3">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
