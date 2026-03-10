"use client";

import { useState } from "react";
import type { HMTaskStatus } from "@/types/hospitality";

interface TaskStatusBarProps {
  currentStatus: HMTaskStatus;
  onStatusChange: (status: HMTaskStatus) => void;
}

const STATUS_STEPS: { value: HMTaskStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Ack" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Done" },
];

const STATUS_ORDER: Record<HMTaskStatus, number> = {
  new: 0,
  acknowledged: 1,
  in_progress: 2,
  on_hold: 3,
  completed: 4,
};

function getNextStatuses(current: HMTaskStatus): HMTaskStatus[] {
  switch (current) {
    case "new":
      return ["acknowledged"];
    case "acknowledged":
      return ["in_progress"];
    case "in_progress":
      return ["on_hold", "completed"];
    case "on_hold":
      return ["in_progress", "completed"];
    case "completed":
      return [];
    default:
      return [];
  }
}

export default function TaskStatusBar({
  currentStatus,
  onStatusChange,
}: TaskStatusBarProps) {
  const [confirming, setConfirming] = useState<HMTaskStatus | null>(null);

  const currentOrder = STATUS_ORDER[currentStatus];
  const allowedNext = getNextStatuses(currentStatus);

  const handleTap = (status: HMTaskStatus) => {
    if (!allowedNext.includes(status)) return;
    if (confirming === status) {
      onStatusChange(status);
      setConfirming(null);
    } else {
      setConfirming(status);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STATUS_STEPS.map((step, idx) => {
          const stepOrder = STATUS_ORDER[step.value];
          const isCurrent = step.value === currentStatus;
          const isCompleted = stepOrder < currentOrder;
          const isAllowed = allowedNext.includes(step.value);
          const isConfirming = confirming === step.value;

          return (
            <div key={step.value} className="flex items-center">
              {idx > 0 && (
                <div
                  className="w-4 h-0.5 flex-shrink-0"
                  style={{
                    background: isCompleted
                      ? "var(--gold)"
                      : "var(--border-light)",
                  }}
                />
              )}
              <button
                onClick={() => handleTap(step.value)}
                disabled={!isAllowed}
                className="flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-semibold transition-all whitespace-nowrap"
                style={{
                  minWidth: isCurrent ? 80 : 64,
                  minHeight: isCurrent ? 36 : 30,
                  background: isCompleted
                    ? "var(--gold)"
                    : isCurrent
                    ? "transparent"
                    : isConfirming
                    ? "rgba(212, 175, 55, 0.2)"
                    : "transparent",
                  color: isCompleted
                    ? "#000"
                    : isCurrent
                    ? "var(--gold)"
                    : isAllowed
                    ? "var(--text-secondary)"
                    : "var(--text-muted)",
                  border: isCurrent
                    ? "2px solid var(--gold)"
                    : isConfirming
                    ? "2px solid var(--gold)"
                    : isAllowed
                    ? "1px solid var(--border-light)"
                    : "1px solid var(--border-light)",
                  cursor: isAllowed ? "pointer" : "default",
                  opacity: !isAllowed && !isCurrent && !isCompleted ? 0.4 : 1,
                }}
              >
                {isCompleted ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isConfirming ? (
                  "Confirm?"
                ) : (
                  step.label
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
