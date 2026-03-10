"use client";

import { useState, useCallback } from "react";

interface TranslateButtonProps {
  text: string;
}

export default function TranslateButton({ text }: TranslateButtonProps) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    if (translatedText) {
      setShowOriginal(!showOriginal);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/hospitality/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Translation failed");
        return;
      }
      setTranslatedText(data.translation);
      setShowOriginal(false);
    } catch {
      setError("Translation failed");
    } finally {
      setLoading(false);
    }
  }, [text, translatedText, showOriginal]);

  return (
    <div className="mt-2">
      <button
        onClick={handleTranslate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg border text-xs font-medium transition-colors"
        style={{
          borderColor: "var(--border-light)",
          color: "var(--text-secondary)",
          background: "var(--input-bg)",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Translating...
          </>
        ) : translatedText ? (
          showOriginal ? (
            "Traducir al Espanol"
          ) : (
            "Show Original"
          )
        ) : (
          <>
            <span>🌐</span>
            Traducir al Espanol
          </>
        )}
      </button>

      {error && (
        <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      {translatedText && !showOriginal && (
        <div
          className="mt-2 p-3 rounded-lg text-sm"
          style={{
            background: "var(--input-bg)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-light)",
          }}
        >
          {translatedText}
        </div>
      )}
    </div>
  );
}
