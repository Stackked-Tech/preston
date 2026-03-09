"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEmployeeAuth } from "@/lib/employeeAuthHooks";
import { useEmployeeFees, useEmployeeRecord } from "@/lib/employeePortalHooks";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useEmployeeAuth();
  const { fees, loading: feesLoading, error } = useEmployeeFees(user?.email ?? undefined);
  const { record } = useEmployeeRecord(user?.email ?? undefined);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/employee");
    }
  }, [authLoading, user, router]);

  const loading = authLoading || feesLoading;

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

  const handleLogout = async () => {
    await logout();
    router.replace("/employee");
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/whb-legacy-vert-bw.png"
            alt="WHB Legacy"
            width={40}
            height={33}
            className="object-contain"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
          <div>
            <h1 className="font-serif text-lg m-0" style={{ color: "var(--gold)" }}>
              Employee Portal
            </h1>
            <p className="font-sans text-xs m-0" style={{ color: "var(--text-muted)" }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="font-sans text-xs px-3 py-1.5 rounded-md border transition-colors"
          style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          Sign Out
        </button>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2
          className="font-serif text-xl mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Your Fee Summary
        </h2>

        {record?.onboarding_envelope_id && (
          <div
            className="rounded-lg border p-5 mb-6"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
          >
            <h3
              className="font-serif text-base mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              Onboarding Documents
            </h3>
            <div className="flex items-center justify-between">
              <span className="font-sans text-sm" style={{ color: "var(--text-secondary)" }}>
                Onboarding Agreement
              </span>
              <div className="flex items-center gap-3">
                {record.status === "onboarding" ? (
                  <>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(212,175,55,0.1)",
                        color: "#d4af37",
                        border: "1px solid rgba(212,175,55,0.2)",
                      }}
                    >
                      Pending Signature
                    </span>
                    {record.onboarding_signing_token && (
                      <a
                        href={`/signed-to-sealed/sign?token=${record.onboarding_signing_token}`}
                        className="text-xs font-medium"
                        style={{ color: "var(--gold)" }}
                      >
                        Sign Now
                      </a>
                    )}
                  </>
                ) : (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(34,197,94,0.1)",
                      color: "#4ade80",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    Signed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            className="rounded-lg p-4 mb-6 border font-sans text-sm"
            style={{ borderColor: "#f87171", color: "#f87171", background: "rgba(248,113,113,0.08)" }}
          >
            {error}
          </div>
        )}

        {fees.length === 0 && !error ? (
          <div
            className="rounded-lg p-8 border text-center"
            style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
          >
            <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>
              No fee data found. Contact your administrator if you believe this is an error.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {fees.map((fee) => {
              const total =
                fee.station_lease +
                fee.financial_services +
                fee.phorest_fee +
                fee.refreshment;

              return (
                <div
                  key={fee.id}
                  className="rounded-lg border p-6"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border-light)" }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="font-serif text-lg m-0"
                      style={{ color: "var(--gold)" }}
                    >
                      {fee.branch_name}
                    </h3>
                    <span
                      className="font-sans text-xs px-2 py-0.5 rounded"
                      style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}
                    >
                      {fee.display_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FeeRow label="Station Lease" value={fee.station_lease} fmt={fmt} />
                    <FeeRow label="Financial Services" value={fee.financial_services} fmt={fmt} />
                    <FeeRow label="Phorest Fee" value={fee.phorest_fee} fmt={fmt} />
                    <FeeRow label="Refreshment" value={fee.refreshment} fmt={fmt} />
                  </div>

                  <div
                    className="mt-4 pt-4 flex justify-between items-center"
                    style={{ borderTop: "1px solid var(--border-light)" }}
                  >
                    <span className="font-sans text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      Total Fees
                    </span>
                    <span className="font-sans text-sm font-semibold" style={{ color: "var(--gold)" }}>
                      {fmt(total)}
                    </span>
                  </div>

                  {fee.associate_pay != null && (
                    <div className="mt-3 flex justify-between items-center">
                      <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>
                        Associate Pay
                      </span>
                      <span className="font-sans text-xs" style={{ color: "var(--text-secondary)" }}>
                        {fmt(fee.associate_pay)} &middot; Supervisor: {fee.supervisor ?? "\u2014"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function FeeRow({
  label,
  value,
  fmt,
}: {
  label: string;
  value: number;
  fmt: (n: number) => string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="font-sans text-sm" style={{ color: "var(--text-primary)" }}>
        {fmt(value)}
      </span>
    </div>
  );
}
