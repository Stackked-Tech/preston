"use client";

import { useState } from "react";
import type { HMRequestWithDetails, HMUrgency } from "@/types/hospitality";

interface RequestReviewCardProps {
  request: HMRequestWithDetails;
  onApprove: () => void;
  onApproveWithEdits: () => void;
  onReject: () => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const URGENCY_STYLES: Record<
  HMUrgency,
  { bg: string; color: string; label: string }
> = {
  routine: {
    bg: "rgba(255,255,255,0.08)",
    color: "var(--text-secondary)",
    label: "Routine",
  },
  urgent: {
    bg: "rgba(245, 158, 11, 0.15)",
    color: "#f59e0b",
    label: "Urgent",
  },
  emergency: {
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
    label: "Emergency",
  },
};

export default function RequestReviewCard({
  request,
  onApprove,
  onApproveWithEdits,
  onReject,
}: RequestReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const urgencyStyle = URGENCY_STYLES[request.urgency];
  const isActionable = request.status === "pending";

  return (
    <div
      className="rounded-xl border transition-all cursor-pointer"
      style={{
        borderColor:
          request.urgency === "emergency"
            ? "rgba(239, 68, 68, 0.3)"
            : "var(--border-light)",
        background: "var(--card-bg)",
      }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--card-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--card-bg)";
      }}
    >
      <div className="p-4">
        {/* Top Row: Property + Time */}
        <div className="flex items-start justify-between mb-2">
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {request.property?.name || "Unknown Property"}
          </h3>
          <span
            className="text-[10px] flex-shrink-0 ml-2"
            style={{ color: "var(--text-muted)" }}
          >
            {timeAgo(request.created_at)}
          </span>
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-2 mb-3">
          {/* Urgency Badge */}
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              request.urgency === "emergency" ? "animate-pulse" : ""
            }`}
            style={{
              background: urgencyStyle.bg,
              color: urgencyStyle.color,
            }}
          >
            {urgencyStyle.label}
          </span>

          {/* Category Badge */}
          {request.category && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border"
              style={{
                borderColor: "var(--gold)",
                color: "var(--gold)",
              }}
            >
              {request.category.label}
            </span>
          )}

          {/* Requester Type */}
          {request.requester_type && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "var(--text-muted)",
              }}
            >
              {request.requester_type.label}
            </span>
          )}
        </div>

        {/* Description */}
        <p
          className={`text-sm leading-relaxed mb-2 ${
            expanded ? "" : "line-clamp-3"
          }`}
          style={{ color: "var(--text-secondary)" }}
        >
          {request.description}
        </p>

        {/* Contact Phone */}
        {request.contact_phone && (
          <p
            className="text-xs mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Contact: {request.contact_phone}
          </p>
        )}

        {/* Manager Notes (for approved/rejected) */}
        {request.manager_notes && (
          <div
            className="text-xs mt-2 p-2 rounded-lg"
            style={{
              background: "rgba(212, 175, 55, 0.08)",
              color: "var(--text-secondary)",
            }}
          >
            <span
              className="font-medium"
              style={{ color: "var(--gold)" }}
            >
              Manager Notes:
            </span>{" "}
            {request.manager_notes}
          </div>
        )}

        {/* Reviewer info (for reviewed requests) */}
        {request.reviewed_at && (
          <p
            className="text-[10px] mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Reviewed {timeAgo(request.reviewed_at)}
            {request.reviewer ? ` by ${request.reviewer.name}` : ""}
          </p>
        )}
      </div>

      {/* Action Buttons (only for pending) */}
      {isActionable && (
        <div
          className="flex items-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: "var(--border-light)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onReject}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: "rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Reject
          </button>
          <button
            onClick={onApproveWithEdits}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: "var(--gold)",
              color: "var(--gold)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(212, 175, 55, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Approve with Edits
          </button>
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
