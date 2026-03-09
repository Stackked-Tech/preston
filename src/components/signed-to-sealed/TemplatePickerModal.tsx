"use client";

import { useTemplates } from "@/lib/signedToSealedHooks";

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlankEnvelope: () => void;
  onSelectTemplate: (templateId: string) => void;
}

export default function TemplatePickerModal({
  isOpen,
  onClose,
  onBlankEnvelope,
  onSelectTemplate,
}: TemplatePickerModalProps) {
  const { templates, loading } = useTemplates();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-lg border shadow-xl"
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-color)" }}
        >
          <h2
            className="text-base font-medium tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Create New Envelope
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-all hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Blank Envelope Option */}
          <button
            onClick={onBlankEnvelope}
            className="w-full text-left p-4 rounded-lg border transition-all hover:opacity-90"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border-light)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-light)";
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📄</span>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  Start with Blank Envelope
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Create from scratch
                </p>
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-light)" }}
            />
            <span
              className="text-[10px] tracking-[1px] uppercase whitespace-nowrap"
              style={{ color: "var(--text-muted)" }}
            >
              or start from a template
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-light)" }}
            />
          </div>

          {/* Template List */}
          {loading ? (
            <p
              className="text-sm text-center py-4"
              style={{ color: "var(--text-muted)" }}
            >
              Loading templates...
            </p>
          ) : templates.length === 0 ? (
            <p
              className="text-sm text-center py-4"
              style={{ color: "var(--text-muted)" }}
            >
              No templates yet
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const roleCount =
                  template.envelope_config?.roles?.length ?? 0;

                return (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className="w-full text-left p-4 rounded-lg border transition-all hover:opacity-90"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border-light)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-light)";
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📋</span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {template.name}
                        </p>
                        <p
                          className="text-xs mt-0.5 truncate"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {template.description || "No description"}
                          {roleCount > 0 && (
                            <span>
                              {" "}
                              &middot; {roleCount} role
                              {roleCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
