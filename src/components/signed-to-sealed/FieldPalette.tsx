"use client";

import type { STSRecipient, FieldType } from "@/types/signedtosealed";
import { FIELD_TYPE_LABELS } from "@/types/signedtosealed";

interface FieldPaletteProps {
  recipients: STSRecipient[];
  selectedRecipientId: string | null;
  onSelectRecipient: (id: string) => void;
  onRemoveField?: (fieldId: string) => void;
  fields?: { id: string; field_type: FieldType; recipient_id: string; page_number: number }[];
}

const FIELD_TYPES: { type: FieldType; icon: string }[] = [
  { type: "signature", icon: "✍️" },
  { type: "initials", icon: "🔤" },
  { type: "date_signed", icon: "📅" },
  { type: "text", icon: "📝" },
  { type: "checkbox", icon: "☑️" },
  { type: "dropdown", icon: "📋" },
];

export default function FieldPalette({
  recipients,
  selectedRecipientId,
  onSelectRecipient,
  onRemoveField,
  fields = [],
}: FieldPaletteProps) {
  const signers = recipients.filter((r) => r.role !== "cc");

  const handleDragStart = (e: React.DragEvent, fieldType: FieldType) => {
    if (!selectedRecipientId) return;
    e.dataTransfer.setData("fieldType", fieldType);
    e.dataTransfer.setData("recipientId", selectedRecipientId);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Recipient Selector */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <p className="text-[10px] tracking-[2px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
          Assign to Recipient
        </p>
        <div className="space-y-1">
          {signers.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRecipient(r.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all"
              style={{
                background: selectedRecipientId === r.id ? r.color_hex + "20" : "transparent",
                borderLeft: selectedRecipientId === r.id ? `3px solid ${r.color_hex}` : "3px solid transparent",
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: r.color_hex }}
              >
                {r.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                {r.name}
              </span>
            </button>
          ))}
          {signers.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Add recipients first</p>
          )}
        </div>
      </div>

      {/* Field Types */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <p className="text-[10px] tracking-[2px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
          Drag Fields to Document
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {FIELD_TYPES.map(({ type, icon }) => (
            <div
              key={type}
              draggable={!!selectedRecipientId}
              onDragStart={(e) => handleDragStart(e, type)}
              className="flex items-center gap-1.5 px-2 py-2 rounded border text-xs transition-all"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-light)",
                cursor: selectedRecipientId ? "grab" : "not-allowed",
                opacity: selectedRecipientId ? 1 : 0.5,
              }}
            >
              <span>{icon}</span>
              <span style={{ color: "var(--text-primary)" }}>{FIELD_TYPE_LABELS[type]}</span>
            </div>
          ))}
        </div>
        {!selectedRecipientId && (
          <p className="text-[10px] mt-2" style={{ color: "#f59e0b" }}>
            Select a recipient above first
          </p>
        )}
      </div>

      {/* Placed Fields List */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <p className="text-[10px] tracking-[2px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
          Placed Fields ({fields.length})
        </p>
        {fields.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Drag fields onto the document to place them
          </p>
        ) : (
          <div className="space-y-1">
            {fields.map((f) => {
              const r = recipients.find((rec) => rec.id === f.recipient_id);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                  style={{ background: "var(--card-bg)" }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: r?.color_hex || "#6b7280" }}
                  />
                  <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                    {FIELD_TYPE_LABELS[f.field_type]}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>P{f.page_number}</span>
                  {onRemoveField && (
                    <button
                      onClick={() => onRemoveField(f.id)}
                      className="text-[10px] hover:opacity-80"
                      style={{ color: "#ef4444" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
