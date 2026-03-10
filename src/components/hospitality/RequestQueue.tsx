"use client";

import type { HMRequestWithDetails } from "@/types/hospitality";
import RequestReviewCard from "./RequestReviewCard";

interface RequestQueueProps {
  requests: HMRequestWithDetails[];
  onApprove: (request: HMRequestWithDetails) => void;
  onApproveWithEdits: (request: HMRequestWithDetails) => void;
  onReject: (request: HMRequestWithDetails) => void;
  loading: boolean;
}

const URGENCY_RANK: Record<string, number> = {
  emergency: 3,
  urgent: 2,
  routine: 1,
};

export default function RequestQueue({
  requests,
  onApprove,
  onApproveWithEdits,
  onReject,
  loading,
}: RequestQueueProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border animate-pulse"
            style={{
              borderColor: "var(--border-light)",
              background: "var(--card-bg)",
              height: 220,
            }}
          >
            <div className="p-5">
              <div
                className="h-4 w-2/3 rounded mb-3"
                style={{ background: "var(--border-light)" }}
              />
              <div
                className="h-3 w-1/3 rounded mb-4"
                style={{ background: "var(--border-light)" }}
              />
              <div
                className="h-3 w-full rounded mb-2"
                style={{ background: "var(--border-light)" }}
              />
              <div
                className="h-3 w-4/5 rounded mb-2"
                style={{ background: "var(--border-light)" }}
              />
              <div
                className="h-3 w-3/5 rounded"
                style={{ background: "var(--border-light)" }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-4 opacity-40"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p className="text-sm font-medium mb-1">No requests found</p>
        <p className="text-xs">
          Requests matching the current filters will appear here.
        </p>
      </div>
    );
  }

  // Sort: emergency first, then urgent, then routine; within same urgency, newest first
  const sorted = [...requests].sort((a, b) => {
    const urgencyDiff =
      (URGENCY_RANK[b.urgency] || 0) - (URGENCY_RANK[a.urgency] || 0);
    if (urgencyDiff !== 0) return urgencyDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sorted.map((request) => (
        <RequestReviewCard
          key={request.id}
          request={request}
          onApprove={() => onApprove(request)}
          onApproveWithEdits={() => onApproveWithEdits(request)}
          onReject={() => onReject(request)}
        />
      ))}
    </div>
  );
}
