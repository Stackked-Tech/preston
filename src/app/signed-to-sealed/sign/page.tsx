"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SigningView from "@/components/signed-to-sealed/SigningView";
import { useSigningByToken } from "@/lib/signedToSealedHooks";

function SignPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { recipient, envelope, loading, error } = useSigningByToken(token);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center p-8 rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>Missing signing token</p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>Please use the link provided in your email.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: "var(--bg-primary)" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading signing session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center p-8 rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
          <p className="text-lg font-medium" style={{ color: "#ef4444" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!recipient || !envelope) return null;

  return (
    <SigningView
      envelope={envelope}
      recipient={recipient}
      isPublic={true}
    />
  );
}

export default function SignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: "var(--bg-primary)" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    }>
      <SignPageInner />
    </Suspense>
  );
}
