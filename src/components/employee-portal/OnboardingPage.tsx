"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function OnboardingPage() {
  const { user, loading, onboardingComplete, completeOnboarding } = useEmployeeAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [completing, setCompleting] = useState(false);

  if (!loading && !user) {
    router.replace("/employee");
    return null;
  }
  if (!loading && onboardingComplete) {
    router.replace("/employee/dashboard");
    return null;
  }

  const handleContinue = async () => {
    setCompleting(true);
    await completeOnboarding();
    router.replace("/employee/dashboard");
  };

  if (loading) {
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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 border text-center"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <Image
          src="/whb-legacy-vert-bw.png"
          alt="WHB Legacy"
          width={80}
          height={66}
          className="object-contain mx-auto"
          style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
        />
        <h1
          className="font-serif text-2xl mt-6"
          style={{ color: "var(--gold)" }}
        >
          Welcome to Preston
        </h1>
        <p
          className="font-sans text-sm mt-3 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          This is your employee portal. Here you can view your station lease,
          fees, and other account details across all your branch assignments.
        </p>

        <button
          onClick={handleContinue}
          disabled={completing}
          className="mt-8 w-full py-2.5 rounded-md font-sans text-sm font-medium tracking-wide transition-opacity"
          style={{
            background: "var(--gold)",
            color: "#0a0b0e",
            opacity: completing ? 0.6 : 1,
            cursor: completing ? "not-allowed" : "pointer",
          }}
        >
          {completing ? "Setting up..." : "Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}
