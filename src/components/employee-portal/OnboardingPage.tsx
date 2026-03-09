"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import { useEmployeeRecord } from "@/lib/employeePortalHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function OnboardingPage() {
  const { user, loading: authLoading, onboardingComplete } = useEmployeeAuth();
  const { record, loading: recordLoading } = useEmployeeRecord(user?.email ?? undefined);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/employee");
    } else if (!authLoading && onboardingComplete) {
      router.replace("/employee/dashboard");
    }
  }, [authLoading, user, onboardingComplete, router]);

  const loading = authLoading || recordLoading;

  if (loading || !user) {
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

  const signingUrl = record?.onboarding_signing_token
    ? `/signed-to-sealed/sign?token=${record.onboarding_signing_token}`
    : null;

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
          Welcome to WHB Companies
        </h1>
        <p
          className="font-sans text-sm mt-3 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {record?.display_name
            ? `Hi ${record.display_name}, before you can access your dashboard, please review and sign your onboarding document.`
            : "Before you can access your dashboard, please review and sign your onboarding document."}
        </p>

        {record?.ea_branches?.name && (
          <p className="font-sans text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Branch: {record.ea_branches.name}
          </p>
        )}

        {signingUrl ? (
          <a
            href={signingUrl}
            className="mt-8 w-full py-2.5 rounded-md font-sans text-sm font-medium tracking-wide transition-opacity inline-block"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              textDecoration: "none",
            }}
          >
            Review &amp; Sign Your Document
          </a>
        ) : (
          <p className="mt-8 font-sans text-sm" style={{ color: "var(--text-muted)" }}>
            No onboarding document assigned. Please contact your administrator.
          </p>
        )}
      </div>
    </div>
  );
}
