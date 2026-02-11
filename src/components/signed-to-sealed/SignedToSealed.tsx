"use client";

import { useState, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import { useEnvelopes } from "@/lib/signedToSealedHooks";
import type { STSView } from "@/types/signedtosealed";
import Dashboard from "./Dashboard";
import EnvelopeWizard from "./EnvelopeWizard";
import EnvelopeDetail from "./EnvelopeDetail";
import TemplateManager from "./TemplateManager";

export default function SignedToSealed() {
  const { theme, toggleTheme } = useTheme();
  const envelopesHook = useEnvelopes();
  const [view, setView] = useState<STSView>("dashboard");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);

  const handleCreateNew = useCallback(() => {
    setSelectedEnvelopeId(null);
    setView("create");
  }, []);

  const handleOpenEnvelope = useCallback((id: string) => {
    setSelectedEnvelopeId(id);
    setView("detail");
  }, []);

  const handleEditEnvelope = useCallback((id: string) => {
    setSelectedEnvelopeId(id);
    setView("create");
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setSelectedEnvelopeId(null);
    setView("dashboard");
    envelopesHook.refetch();
  }, [envelopesHook]);

  const handleWizardComplete = useCallback((sentEnvelopeId?: string) => {
    if (sentEnvelopeId) {
      // After sending, go to detail view so user can copy signing links
      setSelectedEnvelopeId(sentEnvelopeId);
      setView("detail");
      envelopesHook.refetch();
    } else {
      handleBackToDashboard();
    }
  }, [envelopesHook, handleBackToDashboard]);

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 sm:px-10 py-5 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-4">
          {view !== "dashboard" && (
            <button
              onClick={handleBackToDashboard}
              className="text-sm px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
              style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
            >
              &larr; Back
            </button>
          )}
          <div>
            <h1
              className="text-[22px] font-light tracking-[3px] uppercase m-0"
              style={{ color: "var(--gold)" }}
            >
              Signed to Sealed
            </h1>
            <p
              className="text-[10px] tracking-[2px] uppercase mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Document Signature Management
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view === "dashboard" && (
            <>
              <button
                onClick={() => setView("templates")}
                className="text-xs px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                Templates
              </button>
              <button
                onClick={handleCreateNew}
                className="text-xs px-4 py-1.5 rounded-md font-medium transition-all hover:opacity-90"
                style={{ background: "var(--gold)", color: "#0a0b0e" }}
              >
                + New Envelope
              </button>
            </>
          )}
          <button
            onClick={toggleTheme}
            className="border px-3 py-1.5 rounded-md text-xs tracking-[1px] uppercase transition-all"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            {theme === "dark" ? "☀ Light" : "● Dark"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {view === "dashboard" && (
          <Dashboard
            envelopes={envelopesHook.envelopes}
            loading={envelopesHook.loading}
            onOpen={handleOpenEnvelope}
            onCreate={handleCreateNew}
            onDelete={envelopesHook.deleteEnvelope}
          />
        )}
        {view === "create" && (
          <EnvelopeWizard
            envelopeId={selectedEnvelopeId}
            onComplete={handleWizardComplete}
            onCancel={handleBackToDashboard}
          />
        )}
        {view === "detail" && selectedEnvelopeId && (
          <EnvelopeDetail
            envelopeId={selectedEnvelopeId}
            onBack={handleBackToDashboard}
            onEdit={() => handleEditEnvelope(selectedEnvelopeId)}
          />
        )}
        {view === "templates" && (
          <TemplateManager onBack={handleBackToDashboard} />
        )}
      </main>
    </div>
  );
}
