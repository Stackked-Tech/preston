"use client";

import Link from "next/link";
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
        className="flex items-center justify-between px-10 py-6 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div>
          <h1
            className="text-[26px] font-light tracking-[4px] uppercase m-0"
            style={{ color: "var(--gold)" }}
          >
            WHB Companies
          </h1>
          <p
            className="text-[11px] font-sans tracking-[2px] uppercase mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Command Center
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="border px-3 py-1.5 rounded-md text-xs font-sans tracking-[1px] uppercase transition-all"
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
              <span className="text-5xl group-hover:scale-110 transition-transform duration-200">
                {app.icon}
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
