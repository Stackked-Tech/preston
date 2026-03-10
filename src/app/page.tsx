"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

const microApps = [
  {
    name: "Preston Brain Dump",
    description: "Project portfolio tracker & requirements manager",
    href: "/brain-dump",
    icon: "🧠",
    color: "#d4af37",
  },
  {
    name: "R Alexander Time Clock",
    description: "Employee time tracking & attendance management",
    href: "/time-clock",
    icon: "🕐",
    color: "#4dd0e1",
  },
  {
    name: "Signed to Sealed",
    description: "Document signature & envelope management",
    href: "/signed-to-sealed",
    icon: "✍️",
    color: "#8b5cf6",
  },
  {
    name: "New Customer Fee",
    description: "First-visit commission calculator",
    href: "/new-contact-commission",
    icon: "/wh-logo-circle-bw.png",
    color: "#b5a49d",
  },
  {
    name: "Payout Suite",
    description: "Payroll processing & NetSuite export",
    href: "/payout-suite",
    icon: "💲",
    color: "#22c55e",
  },
  {
    name: "Paramount Communications",
    description: "SMS messaging & bulk communications",
    href: "/paramount",
    icon: "/pica-logo-bw.png",
    color: "#f26539",
  },
  {
    name: "Employee Admin",
    description: "Manage staff configuration across all branches",
    href: "/employee-admin",
    icon: "👥",
    color: "#6366f1",
  },
  {
    name: "Hospitality Management",
    description: "Maintenance requests & task management",
    href: "/hospitality",
    icon: "🏠",
    color: "#d4af37",
  },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex flex-col items-center justify-center px-10 py-8 border-b relative"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Image
          src="/whb-legacy-vert-bw.png"
          alt="WHB Legacy"
          width={120}
          height={100}
          className="object-contain"
          style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
        />
        <p
          className="text-[11px] font-sans tracking-[2px] uppercase mt-3"
          style={{ color: "var(--text-muted)" }}
        >
          Command Center
        </p>
        <button
          onClick={toggleTheme}
          className="absolute right-10 top-1/2 -translate-y-1/2 border px-3 py-1.5 rounded-md text-xs font-sans tracking-[1px] uppercase transition-all"
          style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
        >
          {theme === "dark" ? "☀ Light" : "● Dark"}
        </button>
      </header>

      {/* App Grid */}
      <main className="flex-1 px-10 py-12">
        <p
          className="text-[11px] font-sans tracking-[2px] uppercase mb-8"
          style={{ color: "var(--text-muted)" }}
        >
          Applications
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {microApps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group flex flex-col items-center gap-4 p-8 rounded-xl border transition-all duration-200 no-underline"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border-light)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--card-hover)";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--card-bg)";
                e.currentTarget.style.borderColor = "var(--border-light)";
              }}
            >
              <span className="text-5xl group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                {app.icon.startsWith("/") ? (
                  <Image src={app.icon} alt={app.name} width={48} height={48} className="rounded-full" />
                ) : (
                  app.icon
                )}
              </span>
              <div className="text-center">
                <p
                  className="text-sm font-sans font-medium tracking-wide m-0"
                  style={{ color: "var(--text-primary)" }}
                >
                  {app.name}
                </p>
                <p
                  className="text-[10px] font-sans mt-1 m-0 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {app.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
