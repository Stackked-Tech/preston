"use client";

import { useState, useEffect, type ReactNode } from "react";

const CORRECT_PASSWORD = "Wilson26";
const SESSION_KEY = "pw-authed";

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      setAuthed(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  if (!mounted) return null;
  if (authed) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center font-sans"
      style={{ background: "var(--bg-primary)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-4 rounded-xl border p-8 shadow-2xl"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
          minWidth: 320,
        }}
      >
        <h2
          className="text-lg font-semibold tracking-wide"
          style={{ color: "var(--gold)" }}
        >
          Password Required
        </h2>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          placeholder="Enter password"
          autoFocus
          className="w-full rounded-lg border px-4 py-2 text-sm outline-none transition-colors"
          style={{
            background: "var(--input-bg)",
            borderColor: error ? "#ef4444" : "var(--border-color)",
            color: "var(--text-primary)",
          }}
        />
        {error && (
          <p className="text-sm" style={{ color: "#ef4444" }}>
            Incorrect password
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--gold)",
            color: "#0a0b0e",
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}
