"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTaskDetail, useTaskActions } from "@/lib/hospitalityHooks";
import type { HMTaskStatus, HMPhotoType } from "@/types/hospitality";
import TaskStatusBar from "./TaskStatusBar";
import TranslateButton from "./TranslateButton";

interface TaskDetailProps {
  taskId: string;
  currentUser: { id: string; name: string };
  onBack: () => void;
}

type Tab = "details" | "activity" | "photos" | "time" | "materials";

const TABS: { value: Tab; label: string }[] = [
  { value: "details", label: "Details" },
  { value: "activity", label: "Activity" },
  { value: "photos", label: "Photos" },
  { value: "time", label: "Time" },
  { value: "materials", label: "Materials" },
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function storageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/hospitality/${path}`;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / 86400000
  );

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ${mins} min`;
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function TaskDetail({
  taskId,
  currentUser,
  onBack,
}: TaskDetailProps) {
  const {
    task,
    notes,
    photos,
    timeLogs,
    materials,
    loading,
    error,
    refetch,
  } = useTaskDetail(taskId);

  const actions = useTaskActions(taskId);

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);

  // Activity tab state
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Photo tab state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const beforeFileRef = useRef<HTMLInputElement>(null);
  const duringFileRef = useRef<HTMLInputElement>(null);
  const afterFileRef = useRef<HTMLInputElement>(null);

  // Time tab state
  const [elapsed, setElapsed] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [addingTime, setAddingTime] = useState(false);
  const [togglingTimer, setTogglingTimer] = useState(false);

  // Materials tab state
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matCost, setMatCost] = useState("");
  const [matNotes, setMatNotes] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [removingMaterial, setRemovingMaterial] = useState<string | null>(null);

  // Find active timer
  const activeTimer = timeLogs.find((l) => !l.ended_at);

  // Update elapsed time for active timer
  useEffect(() => {
    if (!activeTimer) {
      setElapsed("");
      return;
    }
    const interval = setInterval(() => {
      setElapsed(formatElapsed(activeTimer.started_at));
    }, 1000);
    setElapsed(formatElapsed(activeTimer.started_at));
    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStatusChange = useCallback(
    async (status: HMTaskStatus) => {
      try {
        await actions.updateStatus(status);
        // If completed, send SMS to requester
        if (status === "completed" && task?.request?.contact_phone) {
          try {
            await fetch("/api/hospitality/sms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: task.request.contact_phone,
                message: `Your maintenance request has been completed. Thank you for your patience!`,
              }),
            });
          } catch {
            // SMS failure is non-blocking
          }
        }
        refetch();
      } catch {
        // Error handled silently
      }
    },
    [actions, task, refetch]
  );

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim() || addingNote) return;
    try {
      setAddingNote(true);
      await actions.addNote(currentUser.id, noteText.trim());
      setNoteText("");
      refetch();
    } catch {
      // Error handled silently
    } finally {
      setAddingNote(false);
    }
  }, [noteText, addingNote, actions, currentUser.id, refetch]);

  const handlePhotoUpload = useCallback(
    async (file: File, photoType: HMPhotoType) => {
      try {
        setUploadingPhoto(true);
        await actions.addPhoto(currentUser.id, file, photoType);
        refetch();
      } catch {
        // Error handled silently
      } finally {
        setUploadingPhoto(false);
      }
    },
    [actions, currentUser.id, refetch]
  );

  const handleFileChange = useCallback(
    (photoType: HMPhotoType) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handlePhotoUpload(file, photoType);
        e.target.value = "";
      }
    },
    [handlePhotoUpload]
  );

  const handleStartTimer = useCallback(async () => {
    try {
      setTogglingTimer(true);
      await actions.startTimer(currentUser.id);
      refetch();
    } catch {
      // Error handled silently
    } finally {
      setTogglingTimer(false);
    }
  }, [actions, currentUser.id, refetch]);

  const handleStopTimer = useCallback(async () => {
    if (!activeTimer) return;
    try {
      setTogglingTimer(true);
      await actions.stopTimer(activeTimer.id);
      refetch();
    } catch {
      // Error handled silently
    } finally {
      setTogglingTimer(false);
    }
  }, [actions, activeTimer, refetch]);

  const handleAddTimeEntry = useCallback(async () => {
    if (!manualStart || !manualEnd || addingTime) return;
    try {
      setAddingTime(true);
      await actions.addTimeEntry(currentUser.id, {
        started_at: new Date(manualStart).toISOString(),
        ended_at: new Date(manualEnd).toISOString(),
        notes: manualNotes.trim() || undefined,
      });
      setManualStart("");
      setManualEnd("");
      setManualNotes("");
      refetch();
    } catch {
      // Error handled silently
    } finally {
      setAddingTime(false);
    }
  }, [manualStart, manualEnd, manualNotes, addingTime, actions, currentUser.id, refetch]);

  const handleAddMaterial = useCallback(async () => {
    if (!matName.trim() || addingMaterial) return;
    try {
      setAddingMaterial(true);
      await actions.addMaterial({
        name: matName.trim(),
        quantity: matQty ? parseFloat(matQty) : null,
        cost: matCost ? parseFloat(matCost) : null,
        notes: matNotes.trim() || null,
      });
      setMatName("");
      setMatQty("");
      setMatCost("");
      setMatNotes("");
      refetch();
    } catch {
      // Error handled silently
    } finally {
      setAddingMaterial(false);
    }
  }, [matName, matQty, matCost, matNotes, addingMaterial, actions, refetch]);

  const handleRemoveMaterial = useCallback(
    async (id: string) => {
      try {
        setRemovingMaterial(id);
        await actions.removeMaterial(id);
        refetch();
      } catch {
        // Error handled silently
      } finally {
        setRemovingMaterial(null);
      }
    },
    [actions, refetch]
  );

  if (loading) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="text-center">
          <svg
            className="animate-spin mx-auto mb-3"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div
        className="h-full flex items-center justify-center px-6"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="text-center">
          <p className="text-sm">{error || "Task not found"}</p>
          <button
            onClick={onBack}
            className="mt-3 px-4 min-h-[44px] rounded-lg text-sm font-medium"
            style={{ color: "var(--gold)" }}
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  // Compute totals
  const totalMinutes = timeLogs
    .filter((l) => l.duration_minutes !== null)
    .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const totalCost = materials.reduce((sum, m) => sum + (m.cost || 0), 0);

  const beforePhotos = photos.filter((p) => p.photo_type === "before");
  const duringPhotos = photos.filter((p) => p.photo_type === "during");
  const afterPhotos = photos.filter((p) => p.photo_type === "after");

  // Build request photos from the task's request
  const requestDescription = task.request?.description || task.description || "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Full screen photo overlay */}
      {fullScreenPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setFullScreenPhoto(null)}
        >
          <img
            src={fullScreenPhoto}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setFullScreenPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/20"
          >
            &times;
          </button>
        </div>
      )}

      {/* Task header */}
      <div
        className="flex-shrink-0 px-4 pt-3 pb-2 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <h2
          className="text-base font-bold m-0 mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          {task.title || "Maintenance Task"}
        </h2>
        {task.property && (
          <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>
            {task.property.name}
            {task.property.address ? ` - ${task.property.address}` : ""}
          </p>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex-shrink-0 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <TaskStatusBar
          currentStatus={task.status}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Tab bar */}
      <div
        className="flex-shrink-0 flex gap-1 px-4 py-2 overflow-x-auto border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className="flex-shrink-0 px-4 min-h-[36px] rounded-full text-xs font-medium transition-all whitespace-nowrap"
            style={{
              background:
                activeTab === tab.value
                  ? "rgba(212, 175, 55, 0.15)"
                  : "transparent",
              color:
                activeTab === tab.value ? "var(--gold)" : "var(--text-muted)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* ═══ DETAILS TAB ═══ */}
        {activeTab === "details" && (
          <div className="p-4 space-y-4">
            {/* Description */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Description
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {requestDescription || "No description provided"}
              </p>
              {requestDescription && (
                <TranslateButton text={requestDescription} />
              )}
            </div>

            {/* Request photos */}
            {task.request_id && (
              <RequestPhotosSection
                requestId={task.request_id}
                onViewPhoto={setFullScreenPhoto}
              />
            )}

            {/* Property info */}
            {task.property && (
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Property
                </h3>
                <div
                  className="rounded-xl border p-3"
                  style={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <p
                    className="text-sm font-medium m-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {task.property.name}
                  </p>
                  {task.property.address && (
                    <p
                      className="text-xs mt-0.5 m-0"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {task.property.address}
                      {task.property.city ? `, ${task.property.city}` : ""}
                      {task.property.state ? ` ${task.property.state}` : ""}
                      {task.property.zip ? ` ${task.property.zip}` : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Task metadata */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Info
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {task.request &&
                  (task.request as { category?: { label?: string } }).category?.label && (
                    <InfoCard
                      label="Category"
                      value={
                        (task.request as { category?: { label?: string } }).category!.label!
                      }
                    />
                  )}
                {task.request?.urgency && (
                  <InfoCard
                    label="Urgency"
                    value={task.request.urgency}
                  />
                )}
                {task.request &&
                  (task.request as { requester_type?: { label?: string } }).requester_type?.label && (
                    <InfoCard
                      label="Requester Type"
                      value={
                        (
                          task.request as {
                            requester_type?: { label?: string };
                          }
                        ).requester_type!.label!
                      }
                    />
                  )}
                <InfoCard label="Priority" value={task.priority} />
                {task.due_date && (
                  <InfoCard
                    label="Due Date"
                    value={new Date(task.due_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  />
                )}
                {task.assigned_user && (
                  <InfoCard
                    label="Assigned To"
                    value={task.assigned_user.name}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACTIVITY TAB ═══ */}
        {activeTab === "activity" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notes.length === 0 ? (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  No activity notes yet
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border p-3"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border-light)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--gold)" }}
                      >
                        {note.user?.name || "Unknown"}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatTimestamp(note.created_at)}
                      </span>
                    </div>
                    <p
                      className="text-sm m-0 leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {note.note}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add note form */}
            <div
              className="flex-shrink-0 p-4 border-t"
              style={{ borderColor: "var(--border-light)" }}
            >
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border-light)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim() || addingNote}
                className="mt-2 w-full min-h-[44px] rounded-xl text-sm font-semibold transition-opacity"
                style={{
                  background: "var(--gold)",
                  color: "#000",
                  opacity: !noteText.trim() || addingNote ? 0.5 : 1,
                }}
              >
                {addingNote ? "Adding..." : "Add Note"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ PHOTOS TAB ═══ */}
        {activeTab === "photos" && (
          <div className="p-4 space-y-6">
            {(
              [
                { type: "before" as HMPhotoType, label: "Before", list: beforePhotos, ref: beforeFileRef },
                { type: "during" as HMPhotoType, label: "During", list: duringPhotos, ref: duringFileRef },
                { type: "after" as HMPhotoType, label: "After", list: afterPhotos, ref: afterFileRef },
              ] as const
            ).map(({ type, label, list, ref }) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </h3>
                  <button
                    onClick={() => ref.current?.click()}
                    disabled={uploadingPhoto}
                    className="px-3 min-h-[36px] rounded-lg border text-xs font-medium transition-colors"
                    style={{
                      borderColor: "var(--border-light)",
                      color: "var(--text-secondary)",
                      background: "var(--input-bg)",
                      opacity: uploadingPhoto ? 0.5 : 1,
                    }}
                  >
                    {uploadingPhoto ? "Uploading..." : "+ Add Photo"}
                  </button>
                  <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange(type)}
                  />
                </div>

                {list.length === 0 ? (
                  <p
                    className="text-xs py-4 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No {label.toLowerCase()} photos
                  </p>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {list.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() =>
                          setFullScreenPhoto(storageUrl(photo.storage_path))
                        }
                        className="aspect-square rounded-lg overflow-hidden border"
                        style={{ borderColor: "var(--border-light)" }}
                      >
                        <img
                          src={storageUrl(photo.storage_path)}
                          alt={`${label} photo`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══ TIME TAB ═══ */}
        {activeTab === "time" && (
          <div className="p-4 space-y-6">
            {/* Timer */}
            <div className="flex flex-col items-center py-4">
              {activeTimer ? (
                <>
                  <p
                    className="text-3xl font-mono font-bold mb-4"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {elapsed}
                  </p>
                  <button
                    onClick={handleStopTimer}
                    disabled={togglingTimer}
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-sm transition-opacity"
                    style={{
                      background: "#ef4444",
                      opacity: togglingTimer ? 0.5 : 1,
                    }}
                  >
                    {togglingTimer ? "..." : "STOP"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartTimer}
                  disabled={togglingTimer}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-sm transition-opacity"
                  style={{
                    background: "#22c55e",
                    opacity: togglingTimer ? 0.5 : 1,
                  }}
                >
                  {togglingTimer ? "..." : "START"}
                </button>
              )}
            </div>

            {/* Total */}
            <div
              className="rounded-xl border p-3 text-center"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-light)",
              }}
            >
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                Total Time
              </p>
              <p
                className="text-lg font-bold m-0"
                style={{ color: "var(--text-primary)" }}
              >
                {formatDuration(totalMinutes)}
              </p>
            </div>

            {/* Manual entry */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Manual Entry
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className="block text-[10px] mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Start
                    </label>
                    <input
                      type="datetime-local"
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                      className="w-full rounded-lg border px-3 min-h-[40px] text-xs outline-none"
                      style={{
                        background: "var(--input-bg)",
                        borderColor: "var(--border-light)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-[10px] mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      End
                    </label>
                    <input
                      type="datetime-local"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      className="w-full rounded-lg border px-3 min-h-[40px] text-xs outline-none"
                      style={{
                        background: "var(--input-bg)",
                        borderColor: "var(--border-light)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-lg border px-3 min-h-[40px] text-xs outline-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={handleAddTimeEntry}
                  disabled={!manualStart || !manualEnd || addingTime}
                  className="w-full min-h-[44px] rounded-xl text-sm font-semibold transition-opacity"
                  style={{
                    background: "var(--gold)",
                    color: "#000",
                    opacity:
                      !manualStart || !manualEnd || addingTime ? 0.5 : 1,
                  }}
                >
                  {addingTime ? "Adding..." : "Add Entry"}
                </button>
              </div>
            </div>

            {/* Time log */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Log
              </h3>
              {timeLogs.filter((l) => l.ended_at).length === 0 ? (
                <p
                  className="text-xs text-center py-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  No time entries yet
                </p>
              ) : (
                <div className="space-y-2">
                  {timeLogs
                    .filter((l) => l.ended_at)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border p-3"
                        style={{
                          background: "var(--card-bg)",
                          borderColor: "var(--border-light)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {new Date(log.started_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {log.duration_minutes !== null
                              ? formatDuration(log.duration_minutes)
                              : "—"}
                          </span>
                        </div>
                        {log.notes && (
                          <p
                            className="text-xs mt-1 m-0"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {log.notes}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ MATERIALS TAB ═══ */}
        {activeTab === "materials" && (
          <div className="p-4 space-y-4">
            {/* Total cost */}
            {materials.length > 0 && (
              <div
                className="rounded-xl border p-3 text-center"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border-light)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Total Cost
                </p>
                <p
                  className="text-lg font-bold m-0"
                  style={{ color: "var(--text-primary)" }}
                >
                  ${totalCost.toFixed(2)}
                </p>
              </div>
            )}

            {/* Materials list */}
            {materials.length === 0 ? (
              <p
                className="text-sm text-center py-6"
                style={{ color: "var(--text-muted)" }}
              >
                No materials added yet
              </p>
            ) : (
              <div className="space-y-2">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="rounded-xl border p-3 flex items-start gap-3"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border-light)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium m-0"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {mat.name}
                      </p>
                      <div className="flex gap-3 mt-0.5">
                        {mat.quantity !== null && (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Qty: {mat.quantity}
                          </span>
                        )}
                        {mat.cost !== null && (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            ${mat.cost.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {mat.notes && (
                        <p
                          className="text-xs mt-1 m-0"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {mat.notes}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMaterial(mat.id)}
                      disabled={removingMaterial === mat.id}
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        color: "var(--text-muted)",
                        opacity: removingMaterial === mat.id ? 0.3 : 1,
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add material form */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Add Material
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={matName}
                  onChange={(e) => setMatName(e.target.value)}
                  placeholder="Material name"
                  className="w-full rounded-lg border px-3 min-h-[40px] text-sm outline-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={matQty}
                    onChange={(e) => setMatQty(e.target.value)}
                    placeholder="Quantity"
                    className="w-full rounded-lg border px-3 min-h-[40px] text-sm outline-none"
                    style={{
                      background: "var(--input-bg)",
                      borderColor: "var(--border-light)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <input
                    type="number"
                    value={matCost}
                    onChange={(e) => setMatCost(e.target.value)}
                    placeholder="Cost ($)"
                    step="0.01"
                    className="w-full rounded-lg border px-3 min-h-[40px] text-sm outline-none"
                    style={{
                      background: "var(--input-bg)",
                      borderColor: "var(--border-light)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={matNotes}
                  onChange={(e) => setMatNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-lg border px-3 min-h-[40px] text-sm outline-none"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={handleAddMaterial}
                  disabled={!matName.trim() || addingMaterial}
                  className="w-full min-h-[44px] rounded-xl text-sm font-semibold transition-opacity"
                  style={{
                    background: "var(--gold)",
                    color: "#000",
                    opacity: !matName.trim() || addingMaterial ? 0.5 : 1,
                  }}
                >
                  {addingMaterial ? "Adding..." : "Add Material"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--border-light)",
      }}
    >
      <p
        className="text-[10px] uppercase tracking-wider m-0"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-sm font-medium m-0 mt-0.5 capitalize"
        style={{ color: "var(--text-primary)" }}
      >
        {value.replace(/_/g, " ")}
      </p>
    </div>
  );
}

function RequestPhotosSection({
  requestId,
  onViewPhoto,
}: {
  requestId: string;
  onViewPhoto: (url: string) => void;
}) {
  const [requestPhotos, setRequestPhotos] = useState<{ id: string; storage_path: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("hm_request_photos")
          .select("id, storage_path")
          .eq("request_id", requestId)
          .order("created_at", { ascending: true });
        if (!cancelled && data) {
          setRequestPhotos(data as { id: string; storage_path: string }[]);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (!loaded || requestPhotos.length === 0) return null;

  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Request Photos
      </h3>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {requestPhotos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => onViewPhoto(storageUrl(photo.storage_path))}
            className="aspect-square rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--border-light)" }}
          >
            <img
              src={storageUrl(photo.storage_path)}
              alt="Request photo"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
