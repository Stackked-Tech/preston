"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import PropertyManager from "./PropertyManager";
import UserManager from "./UserManager";
import CategoryManager from "./CategoryManager";
import RequesterTypeManager from "./RequesterTypeManager";
import RecurringTaskManager from "./RecurringTaskManager";
import StatsDashboard from "./StatsDashboard";

type Tab = "properties" | "users" | "categories" | "requesters" | "recurring" | "dashboard";

const TABS: { key: Tab; label: string }[] = [
  { key: "properties", label: "Properties" },
  { key: "users", label: "Users" },
  { key: "categories", label: "Categories" },
  { key: "requesters", label: "Requester Types" },
  { key: "recurring", label: "Recurring Tasks" },
  { key: "dashboard", label: "Dashboard" },
];

export default function HospitalityAdmin() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("properties");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/hospitality"
            className="border px-2.5 py-1.5 rounded-md text-xs font-sans transition-all no-underline"
            style={{ borderColor: "var(--border-color)", color: "var(--gold)" }}
          >
            &larr; Hospitality
          </Link>
          <div>
            <h1
              className="text-[22px] font-light tracking-[3px] uppercase m-0"
              style={{ color: "var(--gold)" }}
            >
              Hospitality Admin
            </h1>
            <p
              className="text-[11px] font-sans tracking-[2px] uppercase mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Property &amp; Configuration Management
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="border px-3 py-1.5 rounded-md text-xs font-sans transition-all"
          style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>

      {/* Tab Bar */}
      <div
        className="border-b flex-shrink-0 overflow-x-auto"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <div className="flex gap-1 px-4 py-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-md text-sm font-sans transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.key ? "var(--gold)" : "transparent",
                color: activeTab === tab.key ? "#0a0b0e" : "var(--text-secondary)",
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "properties" && <PropertyManager />}
        {activeTab === "users" && <UserManager />}
        {activeTab === "categories" && <CategoryManager />}
        {activeTab === "requesters" && <RequesterTypeManager />}
        {activeTab === "recurring" && <RecurringTaskManager />}
        {activeTab === "dashboard" && <StatsDashboard />}
      </div>
    </div>
  );
}
