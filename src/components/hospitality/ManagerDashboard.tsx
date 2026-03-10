"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import {
  useRequests,
  useProperties,
  useReviewRequest,
  useHMUsers,
} from "@/lib/hospitalityHooks";
import type {
  HMRequestStatus,
  HMRequestWithDetails,
  HMPriority,
} from "@/types/hospitality";
import RequestQueue from "./RequestQueue";
import ApprovalModal from "./ApprovalModal";
import RejectionModal from "./RejectionModal";

type StatusTab = "pending" | "approved" | "rejected";

export default function ManagerDashboard() {
  const { theme, toggleTheme } = useTheme();
  const { properties } = useProperties();
  const { users: staffUsers } = useHMUsers("staff");
  const {
    approveRequest,
    approveWithEdits,
    rejectRequest,
    processing,
  } = useReviewRequest();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusTab>("pending");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  // Compute property IDs for the request query
  const propertyIds = useMemo(() => {
    if (propertyFilter === "all") return undefined;
    return [propertyFilter];
  }, [propertyFilter]);

  const {
    requests,
    loading: requestsLoading,
    refetch: refetchRequests,
  } = useRequests(propertyIds, statusFilter as HMRequestStatus);

  // Modal state
  const [approvalRequest, setApprovalRequest] =
    useState<HMRequestWithDetails | null>(null);
  const [approvalMode, setApprovalMode] = useState<"approve" | "edit">(
    "approve"
  );
  const [rejectionRequest, setRejectionRequest] =
    useState<HMRequestWithDetails | null>(null);

  // Error toast state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  }, []);

  // Action handlers
  const handleApprove = useCallback(
    (request: HMRequestWithDetails) => {
      setApprovalRequest(request);
      setApprovalMode("approve");
    },
    []
  );

  const handleApproveWithEdits = useCallback(
    (request: HMRequestWithDetails) => {
      setApprovalRequest(request);
      setApprovalMode("edit");
    },
    []
  );

  const handleReject = useCallback(
    (request: HMRequestWithDetails) => {
      setRejectionRequest(request);
    },
    []
  );

  const handleConfirmApproval = useCallback(
    async (edits?: {
      priority: HMPriority;
      due_date?: string;
      assigned_to?: string;
      manager_notes?: string;
    }) => {
      if (!approvalRequest) return;
      try {
        if (edits) {
          await approveWithEdits(approvalRequest.id, edits);
        } else {
          await approveRequest(approvalRequest.id);
        }

        // Send SMS notification
        if (approvalRequest.contact_phone) {
          try {
            const propertyName =
              approvalRequest.property?.name || "the property";
            await fetch("/api/hospitality/sms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: approvalRequest.contact_phone,
                message: `Your maintenance request at ${propertyName} has been approved and a task has been created. We'll keep you updated on progress.`,
              }),
            });
          } catch {
            // SMS failure is non-critical
          }
        }

        setApprovalRequest(null);
        refetchRequests();
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Failed to approve request"
        );
      }
    },
    [approvalRequest, approveRequest, approveWithEdits, refetchRequests, showError]
  );

  const handleConfirmRejection = useCallback(
    async (notes: string) => {
      if (!rejectionRequest) return;
      try {
        // Use a placeholder reviewer ID since we don't have auth
        await rejectRequest(rejectionRequest.id, notes, "");

        // Send SMS notification
        if (rejectionRequest.contact_phone) {
          try {
            const propertyName =
              rejectionRequest.property?.name || "the property";
            await fetch("/api/hospitality/sms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: rejectionRequest.contact_phone,
                message: `Your maintenance request at ${propertyName} was not approved: ${notes}`,
              }),
            });
          } catch {
            // SMS failure is non-critical
          }
        }

        setRejectionRequest(null);
        refetchRequests();
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Failed to reject request"
        );
      }
    },
    [rejectionRequest, rejectRequest, refetchRequests, showError]
  );

  const statusTabs: { key: StatusTab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs no-underline"
            style={{ color: "var(--text-muted)" }}
          >
            &larr; Home
          </Link>
        </div>
        <h1
          className="text-base font-semibold tracking-wide"
          style={{
            color: "var(--gold)",
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          Hospitality Management
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/hospitality/tasks"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border no-underline transition-colors"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-secondary)",
            }}
          >
            Task Board
          </Link>
          <Link
            href="/hospitality/admin"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border no-underline transition-colors"
            style={{
              borderColor: "var(--gold)",
              color: "var(--gold)",
            }}
          >
            Admin
          </Link>
          <button
            onClick={toggleTheme}
            className="border px-2.5 py-1 rounded-md text-xs tracking-[1px] uppercase transition-all"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--gold)",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{
          borderColor: "var(--border-light)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* Status Tabs */}
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border-light)" }}
          >
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="px-4 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
                style={{
                  background:
                    statusFilter === tab.key
                      ? "rgba(212, 175, 55, 0.15)"
                      : "transparent",
                  color:
                    statusFilter === tab.key
                      ? "var(--gold)"
                      : "var(--text-muted)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Property Filter */}
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Request Count */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </span>
          {statusFilter === "pending" && requests.length > 0 && (
            <span
              className="min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "var(--gold)", color: "#0a0b0e" }}
            >
              {requests.length}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <RequestQueue
          requests={requests}
          onApprove={handleApprove}
          onApproveWithEdits={handleApproveWithEdits}
          onReject={handleReject}
          loading={requestsLoading}
        />
      </div>

      {/* Error Toast */}
      {errorMsg && (
        <div
          className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm"
          style={{
            background: "rgba(199,49,48,0.95)",
            color: "#fff",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Modals */}
      <ApprovalModal
        request={approvalRequest}
        staffUsers={staffUsers}
        onApprove={handleConfirmApproval}
        onClose={() => setApprovalRequest(null)}
        mode={approvalMode}
        processing={processing}
      />

      <RejectionModal
        request={rejectionRequest}
        onReject={handleConfirmRejection}
        onClose={() => setRejectionRequest(null)}
        processing={processing}
      />
    </div>
  );
}
