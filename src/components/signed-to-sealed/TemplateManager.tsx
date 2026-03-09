"use client";

import { useTemplates, duplicateTemplate } from "@/lib/signedToSealedHooks";

interface TemplateManagerProps {
  onBack: () => void;
  onNewTemplate: () => void;
  onEditTemplate: (templateId: string) => void;
  onUseTemplate: (templateId: string) => void;
}

export default function TemplateManager({ onBack, onNewTemplate, onEditTemplate, onUseTemplate }: TemplateManagerProps) {
  const { templates, loading, refetch, deleteTemplate } = useTemplates();

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to duplicate template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await deleteTemplate(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>Templates</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Save envelope configurations for reuse
          </p>
        </div>
        <button
          onClick={onNewTemplate}
          className="text-xs px-4 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
          style={{ background: "var(--gold)", color: "#0a0b0e" }}
        >
          + New Template
        </button>
      </div>

      {/* Template List */}
      {templates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg mb-2" style={{ color: "var(--text-muted)" }}>No templates yet</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Create templates to speed up envelope creation
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 p-4 rounded-lg border"
              style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
            >
              <span className="text-lg">{"\uD83D\uDCCB"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                {t.description && (
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                )}
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {t.envelope_config.roles?.length || 0} roles
                  {t.envelope_config.title && ` \u00B7 Default: \u201C${t.envelope_config.title}\u201D`}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => onEditTemplate(t.id)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(t.id)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                >
                  Duplicate
                </button>
                <button
                  onClick={() => onUseTemplate(t.id)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "var(--gold)" }}
                >
                  Use
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "#ef4444" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
