"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function LoginPage() {
  const { user, loading, onboardingComplete, login } = useEmployeeAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace(onboardingComplete ? "/employee/dashboard" : "/employee/onboarding");
    }
  }, [loading, user, onboardingComplete, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const err = await login(email.trim(), password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <p style={{ color: "var(--text-muted)" }} className="font-sans text-sm">
          Loading...
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--input-bg)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "0.375rem",
    padding: "0.75rem 1rem",
    width: "100%",
    outline: "none",
    fontSize: "0.875rem",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8 border"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/whb-legacy-vert-bw.png"
            alt="WHB Legacy"
            width={80}
            height={66}
            className="object-contain"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
          <h1
            className="font-serif text-xl mt-4"
            style={{ color: "var(--gold)" }}
          >
            Employee Portal
          </h1>
          <p
            className="text-xs font-sans mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Sign in to view your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              className="block text-xs font-sans font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              style={inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label
              className="block text-xs font-sans font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-xs font-sans" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            className="w-full py-2.5 rounded-md font-sans text-sm font-medium tracking-wide transition-opacity"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
